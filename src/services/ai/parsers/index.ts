/**
 * Response Parser Utilities
 * 
 * Parse AI responses into structured data
 */

import type { VideoAnalysis, HookAnalysis, AudienceInsight, MerchantCommentInsights, AccountCommentDemand } from '../../../config/schema';

export function parseAIResponse(response: string, reelId: string): VideoAnalysis {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse AI response as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    reelId,
    hook: {
      visualElements: parsed.hook?.visualElements ?? [],
      audioElements: parsed.hook?.audioElements ?? [],
      textOverlay: parsed.hook?.textOverlay,
      emotionalTrigger: parsed.hook?.emotionalTrigger ?? 'unknown',
      hookDuration: parsed.hook?.hookDuration ?? '0-3 seconds',
    } as HookAnalysis,
    problemSolved: parsed.problemSolved ?? 'Not identified',
    callToAction: parsed.callToAction,
    contentStructure: parsed.contentStructure ?? 'Not analyzed',
    audienceInsights: {
      painPoints: parsed.audienceInsights?.painPoints ?? [],
      commonQuestions: parsed.audienceInsights?.commonQuestions ?? [],
      objections: parsed.audienceInsights?.objections ?? [],
      desires: parsed.audienceInsights?.desires ?? [],
    } as AudienceInsight,
    viralFactors: parsed.viralFactors ?? [],
    suggestedRemix: parsed.suggestedRemix ?? 'No suggestion provided',
  };
}

export function parseMerchantInsightsResponse(
  response: string,
  reelId: string,
  totalComments: number,
): MerchantCommentInsights {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse merchant insights as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    reelId,
    totalComments,
    summary: parsed.summary ?? 'Summary yoq',
    merchantSummary: parsed.merchantSummary ?? 'Merchant summary yoq',
    dmTemplate:
      parsed.dmTemplate ??
      'Assalomu alaykum! Narx va batafsil ma\'lumot uchun DM qoldiring.',
    priceLeads: Array.isArray(parsed.priceLeads) ? parsed.priceLeads : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
  };
}

export function parseAccountCommentDemandResponse(
  response: string,
  accountUsername: string,
  totalPosts: number,
  totalComments: number,
): AccountCommentDemand {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse account demand as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    accountUsername,
    totalPosts,
    totalComments,
    summary: parsed.summary ?? 'Xulosa yo‘q.',
    dmTemplate:
      parsed.dmTemplate ??
      'Assalomu alaykum! Qiziqishingiz uchun rahmat. Narx, yetkazib berish va buyurtma qilish bo‘yicha batafsil ma’lumot beraman. Qaysi model/razmer kerakligini yozib yuboring.',
    topRequests: Array.isArray(parsed.topRequests) ? parsed.topRequests : [],
    hotLeads: Array.isArray(parsed.hotLeads) ? parsed.hotLeads : [],
  };
}
