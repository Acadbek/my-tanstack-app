/**
 * Account Comments Analysis - Main Entry Point
 */

import { getConfig } from '../../../config/index.ts';
import type { Reel, AccountCommentDemand } from '../../../config/schema';
import { buildAccountCommentDemandPrompt } from './prompts.ts';
import { fallbackAccountCommentDemand } from './fallback.ts';
import { analyzeAccountWithOpenAI } from './openai-provider.ts';
import { analyzeAccountWithGemini } from './gemini-provider.ts';

export async function analyzeAccountCommentDemand(username: string, reels: Reel[]): Promise<AccountCommentDemand> {
  const safeUsername = username.replace(/^@/, '').trim();
  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0);

  if (!safeUsername || reels.length === 0) {
    return {
      accountUsername: safeUsername || username,
      totalPosts: reels.length,
      totalComments,
      summary: "Post topilmadi yoki username noto'g'ri.",
      dmTemplate:
        "Assalomu alaykum! Qiziqishingiz uchun rahmat. Narx va batafsil ma'lumot uchun qaysi mahsulot kerakligini yozib yuboring.",
      topRequests: [],
      hotLeads: [],
    };
  }

  const config = getConfig();
  const prompt = buildAccountCommentDemandPrompt(safeUsername, reels);

  try {
    if (config.aiProvider === 'openai') {
      return await analyzeAccountWithOpenAI(safeUsername, reels.length, totalComments, prompt);
    }

    return await analyzeAccountWithGemini(safeUsername, reels.length, totalComments, prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('[account-comments] fallback user=%s reason=%s', safeUsername, msg);
    return fallbackAccountCommentDemand(safeUsername, reels);
  }
}

// Re-export for backwards compatibility
export { buildAccountCommentDemandPrompt } from './prompts.ts';
export { parseAccountCommentDemandResponse } from './parsers.ts';
export { fallbackAccountCommentDemand } from './fallback.ts';
