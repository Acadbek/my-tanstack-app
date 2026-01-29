import { ApifyClient } from 'apify-client';
import { getConfig } from '../config';
import {
  type Reel,
  type ScrapedData,
  type Comment,
  ReelSchema,
  CommentSchema,
} from '../config/schema';

interface ApifyReelItem {
  id?: string;
  shortCode?: string;
  videoUrl?: string;
  url?: string;
  permalink?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  type?: string;
  productType?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  owner?: {
    username?: string;
    fullName?: string;
  };
  timestamp?: string;
  videoDuration?: number;
  latestComments?: Array<{
    id?: string;
    text?: string;
    ownerUsername?: string;
    likesCount?: number;
    timestamp?: string;
  }>;
}

interface ApifyCommentItem {
  id?: string;
  postId?: string;
  text?: string;
  position?: number;
  timestamp?: string;
  ownerUsername?: string;
  ownerId?: string;
  ownerIsVerified?: boolean;
  ownerProfilePicUrl?: string;
}

// ============================================
// Helper Functions
// ============================================

const toAbsoluteInstagramUrl = (maybeUrl: string): string => {
  const trimmed = maybeUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://www.instagram.com${trimmed}`;
  // Fallback: treat as path-like
  return `https://www.instagram.com/${trimmed}`;
};

const normalizeTimestamp = (ts: unknown): string | undefined => {
  if (!ts) return undefined;
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'number') {
    const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
};

const listDatasetItemsPaged = async <T>(
  client: ApifyClient,
  datasetId: string,
  maxItems: number,
): Promise<T[]> => {
  const dataset = client.dataset(datasetId)
  const pageSize = 250

  const all: T[] = []
  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const { items } = await dataset.listItems({
      offset,
      limit: Math.min(pageSize, maxItems - offset),
    })

    const chunk = items as T[]
    all.push(...chunk)

    if (chunk.length === 0) break
    if (chunk.length < Math.min(pageSize, maxItems - offset)) break
    if (all.length >= maxItems) break
  }
  return all.slice(0, maxItems)
}

const normalizeComment = (
  raw: {
    id?: string;
    text?: string;
    ownerUsername?: string;
    likesCount?: number;
    timestamp?: string;
  } | undefined
): Comment | null => {
  try {
    const comment = CommentSchema.parse({
      id: raw?.id ?? `comment-${Date.now()}-${Math.random()}`,
      text: raw?.text ?? '',
      ownerUsername: raw?.ownerUsername,
      likesCount: raw?.likesCount ?? 0,
      timestamp: normalizeTimestamp(raw?.timestamp),
    });
    return comment;
  } catch {
    return null;
  }
};

const normalizeReel = (item: ApifyReelItem): Reel | null => {
  try {
    // Prefer canonical Instagram page URL (reel/p) over raw video file URL.
    const rawUrl = item.url ?? item.permalink ?? item.videoUrl;
    const candidateUrl = rawUrl ? toAbsoluteInstagramUrl(rawUrl) : undefined;
    if (!candidateUrl) return null;

    const shortCodeFromUrl = (() => {
      const match = candidateUrl.match(/instagram\.com\/(reel|p)\/([^/?#]+)/i);
      return match?.[2];
    })();

    const comments = (item.latestComments ?? [])
      .map(normalizeComment)
      .filter((c): c is Comment => c !== null)
      .slice(0, 10);

    const reel = ReelSchema.parse({
      id: item.id ?? item.shortCode ?? `reel-${Date.now()}`,
      shortCode: item.shortCode ?? shortCodeFromUrl ?? '',
      videoUrl: candidateUrl,
      thumbnailUrl: (item.thumbnailUrl ?? item.displayUrl)
        ? toAbsoluteInstagramUrl(item.thumbnailUrl ?? item.displayUrl!)
        : undefined,
      caption: item.caption ?? '',
      likesCount: item.likesCount ?? 0,
      commentsCount: item.commentsCount ?? 0,
      viewsCount: item.videoViewCount ?? item.videoPlayCount ?? 0,
      ownerUsername: item.ownerUsername ?? item.owner?.username ?? 'unknown',
      ownerFullName: item.ownerFullName ?? item.owner?.fullName,
      timestamp: item.timestamp,
      duration: item.videoDuration,
      comments,
    });

    return reel;
  } catch {
    return null;
  }
};

const filterByViews = (reels: Reel[], minViews: number): Reel[] => {
  // Some scraping tiers/endpoints do not provide view counts for reels.
  // In that case, keep items instead of filtering everything out.
  const hasAnyViews = reels.some((r) => (r.viewsCount ?? 0) > 0);
  if (!hasAnyViews) return reels;
  return reels.filter((reel) => reel.viewsCount >= minViews);
};

const filterByEngagementFallback = (reels: Reel[]): Reel[] => {
  // If view counts are missing, keep only reasonably engaged posts.
  // This is a soft guardrail to avoid extremely low-signal results.
  return reels.filter((r) => (r.likesCount ?? 0) >= 200 || (r.commentsCount ?? 0) >= 20);
};

const sortByEngagement = (reels: Reel[]): Reel[] =>
  [...reels].sort((a, b) => {
    const engagementA = a.viewsCount + a.likesCount * 10 + a.commentsCount * 20;
    const engagementB = b.viewsCount + b.likesCount * 10 + b.commentsCount * 20;
    return engagementB - engagementA;
  });

const isLikelyReel = (item: ApifyReelItem): boolean => {
  const u = (item.videoUrl ?? item.url ?? item.permalink ?? '').toLowerCase();
  const byUrl = u.includes('/reel/');
  const byPostUrl = u.includes('/p/');
  const byType = (item.type ?? '').toLowerCase().includes('video');
  const byProduct = (item.productType ?? '').toLowerCase().includes('clips');
  // Some endpoints do not label reels clearly; allow /p/ when it is a video.
  return byUrl || byProduct || byType || byPostUrl;
};

// ============================================
// Main Scraper Function
// ============================================

export interface ScrapeOptions {
  hashtag: string;
  accounts?: string[];
  videoCount: number;
  minViews: number;
}

const buildDirectUrls = (hashtag: string, accounts?: string[]): string[] => {
  const urls: string[] = [];
  if (hashtag) {
    urls.push(`https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}`);
  }
  (accounts ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
    .forEach((username) => {
      urls.push(`https://www.instagram.com/${username}/reels/`);
      urls.push(`https://www.instagram.com/${username}/`);
    });
  return Array.from(new Set(urls));
};

export const scrapeInstagramReels = async (
  options: ScrapeOptions
): Promise<ScrapedData> => {
  const config = getConfig();
  const client = new ApifyClient({ token: config.apifyToken });

  const actorId = 'apify/instagram-hashtag-scraper';

  const input = {
    hashtags: [options.hashtag],
    resultsLimit: options.videoCount * 3, // Fetch more to account for filtering
    resultsType: 'posts',
    searchType: 'hashtag',
    addParentData: false,
    directUrls: buildDirectUrls(options.hashtag, options.accounts),
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
    },
  };

  const run = await client.actor(actorId).call(input, {
    waitSecs: 300, // Wait up to 5 minutes
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const allReels = (items as ApifyReelItem[])
    .filter((item) => (item.videoUrl ?? item.url ?? item.permalink))
    .filter(isLikelyReel)
    .map(normalizeReel)
    .filter((reel): reel is Reel => reel !== null);

  const byViews = filterByViews(allReels, options.minViews);
  const filteredReels = byViews.length === 0 ? filterByEngagementFallback(allReels) : byViews;
  const sortedReels = sortByEngagement(filteredReels);
  const finalReels = sortedReels.slice(0, options.videoCount);

  return {
    hashtag: options.hashtag,
    scrapedAt: new Date().toISOString(),
    totalFound: allReels.length,
    reels: finalReels,
  };
};

export const scrapeInstagramReelFromUrl = async (url: string): Promise<ScrapedData> => {
  const config = getConfig();
  const client = new ApifyClient({ token: config.apifyToken });

  const actorId = 'apify/instagram-scraper';

  const run = await client.actor(actorId).call(
    {
      directUrls: [url],
      resultsType: 'posts',
      resultsLimit: 5,
    },
    {
      waitSecs: 300,
    },
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const reels = (items as ApifyReelItem[])
    .filter((item) => (item.videoUrl ?? item.url ?? item.permalink))
    .map(normalizeReel)
    .filter((reel): reel is Reel => reel !== null)
    .slice(0, 1);

  const reel = reels[0];

  if (reel) {
    const commentsRun = await client.actor('apify/instagram-comment-scraper').call(
      {
        directUrls: [url],
        resultsLimit: 500,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
        },
      },
      {
        waitSecs: 300,
      },
    );

    const commentItems = await listDatasetItemsPaged<ApifyCommentItem>(
      client,
      commentsRun.defaultDatasetId,
      500,
    )

    const comments = (commentItems as ApifyCommentItem[])
      .map((c) => {
        try {
          return CommentSchema.parse({
            id: c.id ?? `comment-${Date.now()}-${Math.random()}`,
            text: c.text ?? '',
            ownerUsername: c.ownerUsername,
            likesCount: 0,
            timestamp: normalizeTimestamp(c.timestamp),
          });
        } catch {
          return null;
        }
      })
      .filter((c): c is Comment => c !== null)
      .slice(0, 500);

    reels[0] = {
      ...reel,
      comments,
      commentsCount: Math.max(reel.commentsCount ?? 0, comments.length),
    };
  }

  return {
    hashtag: '',
    scrapedAt: new Date().toISOString(),
    totalFound: reels.length,
    reels,
  };
};

export const scrapeInstagramAccountLatestPosts = async (options: {
  username: string
  postCount?: number
  commentsPerPost?: number
}): Promise<ScrapedData> => {
  const username = options.username.replace(/^@/, '').trim()
  if (!username) throw new Error('Instagram username is required')

  const postCount = options.postCount ?? 2
  const commentsPerPost = options.commentsPerPost ?? 200

  const config = getConfig()
  const client = new ApifyClient({ token: config.apifyToken })

  const actorId = 'apify/instagram-scraper'
  const profileUrl = `https://www.instagram.com/${username}/`

  const run = await client.actor(actorId).call(
    {
      directUrls: [profileUrl],
      resultsType: 'posts',
      resultsLimit: postCount,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    },
    {
      waitSecs: 300,
    },
  )

  const { items } = await client.dataset(run.defaultDatasetId).listItems()

  const reels = (items as ApifyReelItem[])
    .filter((item) => (item.videoUrl ?? item.url ?? item.permalink))
    .map(normalizeReel)
    .filter((reel): reel is Reel => reel !== null)
    .slice(0, postCount)

  for (const reel of reels) {
    try {
      console.log(`Scraping comments for post: ${reel.videoUrl}`)
      const commentsRun = await client.actor('apify/instagram-comment-scraper').call(
        {
          directUrls: [reel.videoUrl],
          resultsLimit: commentsPerPost,
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
          },
        },
        {
          waitSecs: 60,
        },
      )

      const commentItems = await listDatasetItemsPaged<ApifyCommentItem>(
        client,
        commentsRun.defaultDatasetId,
        commentsPerPost,
      )

      const comments = (commentItems as ApifyCommentItem[])
        .map((c) => {
          try {
            return CommentSchema.parse({
              id: c.id ?? `comment-${Date.now()}-${Math.random()}`,
              text: c.text ?? '',
              ownerUsername: c.ownerUsername,
              likesCount: 0,
              timestamp: normalizeTimestamp(c.timestamp),
            })
          } catch {
            return null
          }
        })
        .filter((c): c is Comment => c !== null)
        .slice(0, commentsPerPost)

      reel.comments = comments
      reel.commentsCount = Math.max(reel.commentsCount ?? 0, comments.length)
      console.log(`Successfully scraped ${comments.length} comments from post`)
    } catch (error) {
      console.log(`Skipping post due to error: ${reel.videoUrl}`, error)
    }
  }

  return {
    hashtag: '',
    scrapedAt: new Date().toISOString(),
    totalFound: reels.length,
    reels,
  }
}

// ============================================
// Alternative: RapidAPI Scraper (Fallback)
// ============================================

export const scrapeWithRapidAPI = async (
  options: ScrapeOptions
): Promise<ScrapedData> => {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST ?? 'instagram-scraper-api2.p.rapidapi.com';

  if (!rapidApiKey) {
    throw new Error('RAPIDAPI_KEY is required for RapidAPI scraping');
  }

  const response = await fetch(
    `https://${rapidApiHost}/v1/hashtag?hashtag=${encodeURIComponent(options.hashtag)}`,
    {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`RapidAPI request failed: ${response.statusText}`);
  }

  const data: unknown = await response.json();

  const items = (data as any)?.data?.items ?? [];
  const allReels = items
    .filter((item: ApifyReelItem) => item.videoUrl)
    .map(normalizeReel)
    .filter((reel: Reel | null): reel is Reel => reel !== null);

  const byViews = filterByViews(allReels, options.minViews);
  const filteredReels = byViews.length === 0 ? filterByEngagementFallback(allReels) : byViews;
  const sortedReels = sortByEngagement(filteredReels);
  const finalReels = sortedReels.slice(0, options.videoCount);

  return {
    hashtag: options.hashtag,
    scrapedAt: new Date().toISOString(),
    totalFound: allReels.length,
    reels: finalReels,
  };
};
