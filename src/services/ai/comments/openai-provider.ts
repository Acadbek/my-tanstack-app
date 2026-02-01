import OpenAI from 'openai';
import { getConfig } from '../../../config/index.ts';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage.ts';
import type { Reel, MerchantCommentInsights, Lead } from '../../../config/schema';
import { parseMerchantInsightsResponse } from './parsers.ts';

export async function analyzeWithOpenAI(
  reel: Reel,
  prompt: string,
  regexLeads: Lead[],
): Promise<MerchantCommentInsights> {
  const config = getConfig();
  console.log('[comments] provider=openai model=gpt-4o reelId=%s comments=%s', reel.id, reel.comments.length);
  
  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.2,
  });
  const response = completion.choices[0]?.message?.content ?? '';
  
  const inputTokens = estimateTokenCount(prompt);
  const outputTokens = estimateTokenCount(response);
  await recordAIUsage({
    organizationId: 1,
    provider: 'openai',
    model: 'gpt-4o',
    operationType: 'comment_analysis',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostCents: calculateCost('openai', 'gpt-4o', inputTokens, outputTokens),
  });
  
  const ai = parseMerchantInsightsResponse(response, reel.id, reel.comments.length);
  const merged = [...(ai.priceLeads ?? []), ...regexLeads]
    .filter((l) => !!l.ownerUsername)
    .filter((l) => !!l.commentText);
  const deduped = Array.from(
    new Map(merged.map((l) => [`${l.ownerUsername}:${l.commentText}`, l])).values(),
  );
  return {
    ...ai,
    priceLeads: deduped,
  };
}
