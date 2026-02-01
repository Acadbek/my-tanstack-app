import type { Reel, VideoAnalysis, MerchantCommentInsights, AccountCommentDemand } from '@/config/schema';

export interface InlineImage {
  data: string;
  mimeType: string;
}

export interface AIProvider {
  analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis>;
}

export interface Lead {
  ownerUsername: string;
  commentText: string;
  reason: string;
}

export type OperationType = 'video_analysis' | 'comment_analysis' | 'account_analysis';
