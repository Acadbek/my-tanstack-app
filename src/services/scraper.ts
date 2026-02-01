/**
 * Instagram Scraper Service
 * 
 * This file re-exports from modular files in the scraper/ directory.
 * 
 * @deprecated Import directly from './scraper/' submodules for tree-shaking benefits
 */

export type { ApifyReelItem, ApifyCommentItem, ScrapeOptions } from './scraper/types.ts';

export {
  scrapeInstagramReels,
  scrapeInstagramReelFromUrl,
  scrapeInstagramAccountLatestPosts,
  scrapeWithRapidAPI,
} from './scraper/index.ts';
