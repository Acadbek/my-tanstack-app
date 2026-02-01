import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../../../config/index.ts';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage.ts';
import type { Reel, MerchantCommentInsights, Lead } from '../../../config/schema';
import { parseMerchantInsightsResponse } from './parsers.ts';

export async function analyzeWithGemini(
  reel: Reel,
  prompt: string,
  regexLeads: Lead[],
): Promise<MerchantCommentInsights> {
  const config = getConfig();
  const genAI = new GoogleGenerativeAI(config.geminiApiKey!);
  
  const fallbackModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  const configuredModel = config.geminiModel ?? config.geminiModels?.[0];
  const modelCandidates = configuredModel 
    ? [configuredModel, ...fallbackModels.filter(m => m !== configuredModel)]
    : fallbackModels;
  
  let response = '';
  let usedModel = '';
  
  for (const modelName of modelCandidates) {
    try {
      console.log('[comments] trying model=%s reelId=%s comments=%s', modelName, reel.id, reel.comments.length);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      });
      const result = await model.generateContent([{ text: prompt }]);
      response = result.response.text();
      usedModel = modelName;
      break;
    } catch (e) {
      console.log('[comments] model %s failed:', modelName, e instanceof Error ? e.message : e);
      if (modelName === modelCandidates[modelCandidates.length - 1]) {
        throw e;
      }
    }
  }
  
  const inputTokens = estimateTokenCount(prompt);
  const outputTokens = estimateTokenCount(response);
  await recordAIUsage({
    organizationId: 1,
    provider: 'gemini',
    model: usedModel,
    operationType: 'comment_analysis',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostCents: calculateCost('gemini', usedModel, inputTokens, outputTokens),
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
