/**
 * Database Helpers
 * 
 * All functions have been moved to modular files in the helpers/ directory.
 * This file now re-exports for backwards compatibility.
 * 
 * @deprecated Import directly from './helpers/' submodules for tree-shaking benefits
 */

export {
  saveInstagramAccount,
  saveInstagramReel,
  saveReelComments,
  saveScrapeSession,
  saveVideoAnalysis,
  saveCommentInsights,
  saveAccountAnalysis,
  saveCompleteAnalysis,
  saveAccountAnalysisComplete,
} from './helpers/index.ts';
