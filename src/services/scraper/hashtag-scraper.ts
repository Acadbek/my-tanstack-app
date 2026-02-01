import { ApifyClient } from 'apify-client';
import { getConfig } from '../../config/index.ts';
import type { ScrapedData, Reel } from '../../config/schema';
import { normalizeReel, isLikelyReel } from './normalizers.ts';
import { filterByViews, filterByEngagementFallback, sortByEngagement } from './filters.ts';
import { buildDirectUrls } from './utils.ts';
import type { ApifyReelItem, ScrapeOptions } from './types.ts';

export const scrapeInstagramReels = async (
  options: ScrapeOptions
): Promise<ScrapedData> => {
  const config = getConfig();
  const client = new ApifyClient({ token: config.apifyToken });

  const actorId = 'apify/instagram-hashtag-scraper';

  const input = {
    hashtags: [options.hashtag],
    resultsLimit: options.videoCount * 3,
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
    waitSecs: 300,
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
