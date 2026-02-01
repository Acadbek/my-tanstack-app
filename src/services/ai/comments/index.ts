/**
 * Merchant Comments Analysis - Main Entry Point
 */

import { getConfig } from '../../../config/index.ts';
import type { Reel, MerchantCommentInsights } from '../../../config/schema';
import { extractRegexPriceLeads } from './utils.ts';
import { buildMerchantCommentInsightsPrompt } from './prompts.ts';
import { fallbackMerchantInsights } from './fallback.ts';
import { analyzeWithOpenAI } from './openai-provider.ts';
import { analyzeWithGemini } from './gemini-provider.ts';
import { analyzeWithGroq } from './groq-provider.ts';

export async function analyzeComments(reel: Reel): Promise<MerchantCommentInsights> {
  if (!reel.comments.length) {
    return {
      reelId: reel.id,
      totalComments: 0,
      summary: 'Comment topilmadi.',
      merchantSummary: 'Comment topilmadi.',
      dmTemplate: "Assalomu alaykum! Narx va batafsil ma'lumot uchun DM qoldiring.",
      priceLeads: [],
      groups: [],
    };
  }

  const config = getConfig();
  const prompt = buildMerchantCommentInsightsPrompt(reel);
  const regexLeads = extractRegexPriceLeads(reel, 50);

  try {
    if (config.aiProvider === 'openai') {
      return await analyzeWithOpenAI(reel, prompt, regexLeads);
    }

    if (config.aiProvider === 'groq') {
      return await analyzeWithGroq(reel, prompt, regexLeads);
    }

    return await analyzeWithGemini(reel, prompt, regexLeads);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[comments] fallback reelId=%s reason=%s', reel.id, msg);
    return fallbackMerchantInsights(reel);
  }
}

// Re-export for backwards compatibility
export { extractRegexPriceLeads } from './utils.ts';
export { buildMerchantCommentInsightsPrompt } from './prompts.ts';
export { parseMerchantInsightsResponse } from './parsers.ts';
export { fallbackMerchantInsights } from './fallback.ts';
