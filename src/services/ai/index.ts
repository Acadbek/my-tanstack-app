/**
 * AI Service Index
 * 
 * Main exports for AI analysis functionality
 */

// Types
export type { AIProvider, InlineImage, AnalysisProgress, Lead } from './types/index';

// Providers
export { createAIProvider } from './providers';

// Services
export { analyzeReels } from './services/batch-analysis';

// Utils
export { 
  fetchThumbnailAsBase64, 
  fetchThumbnailInlineImage 
} from './utils/thumbnails';

export { buildFallbackAnalysis } from './utils/fallback-analysis';

// Parsers
export { 
  parseAIResponse, 
  parseMerchantInsightsResponse, 
  parseAccountCommentDemandResponse 
} from './parsers';
