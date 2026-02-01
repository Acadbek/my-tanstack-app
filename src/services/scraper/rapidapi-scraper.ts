import type { ScrapedData, Reel } from '../../config/schema';
import { normalizeReel } from './normalizers.ts';
import { filterByViews, filterByEngagementFallback, sortByEngagement } from './filters.ts';
import type { ApifyReelItem, ScrapeOptions } from './types.ts';

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
