/**
 * AI Analyzer Service
 * 
 * Main entry point for AI analysis functionality.
 * All implementation details have been moved to modular subdirectories.
 * 
 * @deprecated Import directly from './ai/' submodules for tree-shaking benefits
 */

// Re-export all public APIs from modular structure
export type { 
  AIProvider, 
  InlineImage, 
  AnalysisProgress, 
  Lead 
} from './ai/types/index';

export { createAIProvider } from './ai/providers/index';

export { analyzeReels } from './ai/services/batch-analysis';

export { 
  fetchThumbnailAsBase64, 
  fetchThumbnailInlineImage 
} from './ai/utils/thumbnails';

export { buildFallbackAnalysis } from './ai/utils/fallback-analysis';

export { 
  parseAIResponse, 
  parseMerchantInsightsResponse, 
  parseAccountCommentDemandResponse 
} from './ai/parsers/index';

// Legacy exports for backwards compatibility
export { analyzeComments } from './ai/services/merchant-comments';
export { analyzeAccountCommentDemand } from './ai/services/account-comments';
