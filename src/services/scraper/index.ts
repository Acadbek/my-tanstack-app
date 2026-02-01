/**
 * Instagram Scraper - Main Entry Point
 */

export type { ApifyReelItem, ApifyCommentItem, ScrapeOptions } from './types.ts';

export { scrapeInstagramReels } from './hashtag-scraper.ts';
export { scrapeInstagramReelFromUrl } from './url-scraper.ts';
export { scrapeInstagramAccountLatestPosts } from './account-scraper.ts';
export { scrapeWithRapidAPI } from './rapidapi-scraper.ts';

// Re-export utility functions for advanced usage
export { toAbsoluteInstagramUrl, normalizeTimestamp, listDatasetItemsPaged, buildDirectUrls } from './utils.ts';
export { normalizeComment, normalizeReel, isLikelyReel, parseApifyComment } from './normalizers.ts';
export { filterByViews, filterByEngagementFallback, sortByEngagement } from './filters.ts';
