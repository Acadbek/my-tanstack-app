import { z } from 'zod';

// ============================================
// Input Schemas
// ============================================

export const AgentInputSchema = z.object({
  hashtag: z
    .string()
    .min(1, 'Hashtag is required')
    .transform((val) => val.replace(/^#/, '')), // Remove leading # if present
  videoCount: z
    .number()
    .int()
    .min(1, 'Video count must be at least 1')
    .max(50, 'Video count must be at most 50')
    .default(10),
  minViews: z
    .number()
    .int()
    .min(0)
    .default(10000), // 10k minimum views constraint
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

// ============================================
// Instagram Reel Schemas
// ============================================

export const CommentSchema = z.object({
  id: z.string(),
  text: z.string(),
  ownerUsername: z.string().optional(),
  likesCount: z.number().default(0),
  timestamp: z.string().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

export const ReelSchema = z.object({
  id: z.string(),
  shortCode: z.string(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().nullable().default(''),
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  viewsCount: z.number().default(0),
  ownerUsername: z.string(),
  ownerFullName: z.string().optional(),
  timestamp: z.string().optional(),
  duration: z.number().optional(),
  comments: z.array(CommentSchema).default([]),
});

export type Reel = z.infer<typeof ReelSchema>;

export const ScrapedDataSchema = z.object({
  hashtag: z.string(),
  scrapedAt: z.string(),
  totalFound: z.number(),
  reels: z.array(ReelSchema),
});

export type ScrapedData = z.infer<typeof ScrapedDataSchema>;

// ============================================
// AI Analysis Schemas
// ============================================

export const HookAnalysisSchema = z.object({
  visualElements: z.array(z.string()),
  audioElements: z.array(z.string()).optional(),
  textOverlay: z.string().optional(),
  emotionalTrigger: z.string(),
  hookDuration: z.string().default('0-3 seconds'),
});

export type HookAnalysis = z.infer<typeof HookAnalysisSchema>;

export const AudienceInsightSchema = z.object({
  painPoints: z.array(z.string()),
  commonQuestions: z.array(z.string()),
  objections: z.array(z.string()),
  desires: z.array(z.string()),
});

export type AudienceInsight = z.infer<typeof AudienceInsightSchema>;

export const VideoAnalysisSchema = z.object({
  reelId: z.string(),
  hook: HookAnalysisSchema,
  problemSolved: z.string(),
  callToAction: z.string().optional(),
  contentStructure: z.string(),
  audienceInsights: AudienceInsightSchema,
  viralFactors: z.array(z.string()),
  suggestedRemix: z.string(),
});

export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

export const CommentGroupSchema = z.object({
  label: z.string(),
  count: z.number(),
  examples: z.array(z.string()),
});

export const CommentInsightsSchema = z.object({
  reelId: z.string(),
  totalComments: z.number(),
  summary: z.string(),
  groups: z.array(CommentGroupSchema),
});

export type CommentInsights = z.infer<typeof CommentInsightsSchema>;

export const LeadSchema = z.object({
  ownerUsername: z.string(),
  commentText: z.string(),
  reason: z.string().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const MerchantCommentInsightsSchema = CommentInsightsSchema.extend({
  merchantSummary: z.string(),
  dmTemplate: z.string(),
  priceLeads: z.array(LeadSchema),
});

export type MerchantCommentInsights = z.infer<typeof MerchantCommentInsightsSchema>;

export const AccountCommentDemandSchema = z.object({
  accountUsername: z.string(),
  totalPosts: z.number(),
  totalComments: z.number(),
  summary: z.string(),
  dmTemplate: z.string(),
  topRequests: z.array(
    z.object({
      topic: z.string(),
      count: z.number(),
      examples: z.array(z.string()),
      requesters: z.array(z.string()).optional(),
    }),
  ),
  hotLeads: z.array(LeadSchema),
});

export type AccountCommentDemand = z.infer<typeof AccountCommentDemandSchema>;

// ============================================
// Creative Brief Schemas
// ============================================

export const CreativeBriefSchema = z.object({
  generatedAt: z.string(),
  hashtag: z.string(),
  totalReelsAnalyzed: z.number(),
  winningHookPatterns: z.array(
    z.object({
      pattern: z.string(),
      frequency: z.number(),
      examples: z.array(z.string()),
    })
  ),
  audiencePainPoints: z.array(
    z.object({
      painPoint: z.string(),
      frequency: z.number(),
      sourceReels: z.array(z.string()),
    })
  ),
  topPerformingFormats: z.array(z.string()),
  scriptConcepts: z.array(
    z.object({
      title: z.string(),
      hook: z.string(),
      body: z.string(),
      cta: z.string(),
      inspiredBy: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
});

export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

// ============================================
// Config Schema
// ============================================

export const ConfigSchema = z.object({
  apifyToken: z.string().min(1, 'APIFY_API_TOKEN is required'),
  aiProvider: z.enum(['gemini', 'openai']).default('gemini'),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().optional(),
  geminiModels: z.array(z.string()).optional(),
  openaiApiKey: z.string().optional(),
}).refine(
  (data) => {
    if (data.aiProvider === 'gemini') {
      return !!data.geminiApiKey;
    }
    if (data.aiProvider === 'openai') {
      return !!data.openaiApiKey;
    }
    return false;
  },
  {
    message: 'API key for selected AI provider is required',
  }
);

export type Config = z.infer<typeof ConfigSchema>;
