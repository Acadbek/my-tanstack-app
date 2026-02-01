/**
 * AI Analyzer Types
 * 
 * Type definitions and interfaces for AI analysis functionality
 */

import type { Reel, VideoAnalysis, MerchantCommentInsights, AccountCommentDemand } from '../../../config/schema';

export interface AIProvider {
  analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis>;
}

export interface InlineImage {
  data: string;
  mimeType: string;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  reelId: string;
}

export interface Lead {
  ownerUsername: string;
  commentText: string;
  reason: string;
}
