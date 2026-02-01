import { getConfig } from '../../../config/index.ts';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage.ts';
import type { Reel, MerchantCommentInsights, Lead } from '../../../config/schema';
import { parseMerchantInsightsResponse } from './parsers.ts';

export async function analyzeWithGroq(
  reel: Reel,
  prompt: string,
  regexLeads: Lead[],
): Promise<MerchantCommentInsights> {
  const config = getConfig();
  const fallbackModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  const configuredModel = config.groqModel ?? config.groqModels?.[0];
  const bannedModels = new Set(['llama-3.1-70b-versatile', 'mixtral-8x7b-32768']);

  const initialCandidates = configuredModel
    ? [configuredModel, ...fallbackModels.filter((m) => m !== configuredModel)]
    : fallbackModels;

  const modelCandidates = initialCandidates.filter((m) => !bannedModels.has(m));
  if (modelCandidates.length === 0) {
    modelCandidates.push(...fallbackModels);
  }

  let response = '';
  let usedModel = '';

  for (const modelName of modelCandidates) {
    try {
      console.log('[comments-groq] trying model=%s reelId=%s comments=%s', modelName, reel.id, reel.comments.length);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Groq ${res.status}] ${errText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Groq response empty');

      response = content;
      usedModel = modelName;
      break;
    } catch (e) {
      console.log('[comments-groq] model %s failed:', modelName, e instanceof Error ? e.message : e);
      if (modelName === modelCandidates[modelCandidates.length - 1]) throw e;
    }
  }

  const inputTokens = estimateTokenCount(prompt);
  const outputTokens = estimateTokenCount(response);
  await recordAIUsage({
    organizationId: 1,
    provider: 'groq',
    model: usedModel,
    operationType: 'comment_analysis',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostCents: calculateCost('groq', usedModel, inputTokens, outputTokens),
  });

  const ai = parseMerchantInsightsResponse(response, reel.id, reel.comments.length);
  const merged = [...(ai.priceLeads ?? []), ...regexLeads]
    .filter((l) => !!l.ownerUsername)
    .filter((l) => !!l.commentText);
  const deduped = Array.from(new Map(merged.map((l) => [`${l.ownerUsername}:${l.commentText}`, l])).values());
  return { ...ai, priceLeads: deduped };
}
