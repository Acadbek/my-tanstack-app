import { ApifyClient } from 'apify-client';
import { getConfig } from '../../config/index.ts';
import type { ScrapedData, Reel, Comment } from '../../config/schema';
import { CommentSchema } from '../../config/schema';
import { normalizeReel } from './normalizers.ts';
import { listDatasetItemsPaged, normalizeTimestamp } from './utils.ts';
import type { ApifyReelItem, ApifyCommentItem } from './types.ts';

export const scrapeInstagramReelFromUrl = async (url: string): Promise<ScrapedData> => {
  const config = getConfig();
  const client = new ApifyClient({ token: config.apifyToken });

  const normalizedUrl = url.replace(/\/reels\/([^/?]+)/, '/p/$1');
  console.log('[scraper] Original URL:', url);
  console.log('[scraper] Normalized URL:', normalizedUrl);

  const actorId = 'apify/instagram-scraper';

  const run = await client.actor(actorId).call(
    {
      directUrls: [normalizedUrl],
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
        directUrls: [normalizedUrl],
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
    );

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
