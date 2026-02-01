import { ApifyClient } from 'apify-client';
import { getConfig } from '../../config/index.ts';
import type { ScrapedData, Reel, Comment } from '../../config/schema';
import { CommentSchema } from '../../config/schema';
import { normalizeReel } from './normalizers.ts';
import { listDatasetItemsPaged, normalizeTimestamp } from './utils.ts';
import type { ApifyReelItem, ApifyCommentItem } from './types.ts';

export const scrapeInstagramAccountLatestPosts = async (options: {
  username: string;
  postCount?: number;
  commentsPerPost?: number;
}): Promise<ScrapedData> => {
  const username = options.username.replace(/^@/, '').trim();
  if (!username) throw new Error('Instagram username is required');

  const postCount = options.postCount ?? 2;
  const commentsPerPost = options.commentsPerPost ?? 200;

  const config = getConfig();
  const client = new ApifyClient({ token: config.apifyToken });

  const actorId = 'apify/instagram-scraper';
  const profileUrl = `https://www.instagram.com/${username}/`;

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
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const reels = (items as ApifyReelItem[])
    .filter((item) => (item.videoUrl ?? item.url ?? item.permalink))
    .map(normalizeReel)
    .filter((reel): reel is Reel => reel !== null)
    .slice(0, postCount);

  for (const reel of reels) {
    try {
      console.log(`Scraping comments for post: ${reel.videoUrl}`);
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
      );

      const commentItems = await listDatasetItemsPaged<ApifyCommentItem>(
        client,
        commentsRun.defaultDatasetId,
        commentsPerPost,
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
        .slice(0, commentsPerPost);

      reel.comments = comments;
      reel.commentsCount = Math.max(reel.commentsCount ?? 0, comments.length);
      console.log(`Successfully scraped ${comments.length} comments from post`);
    } catch (error) {
      console.log(`Skipping post due to error: ${reel.videoUrl}`, error);
    }
  }

  return {
    hashtag: '',
    scrapedAt: new Date().toISOString(),
    totalFound: reels.length,
    reels,
  };
};
