import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../../../config/index.ts';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage.ts';
import type { AccountCommentDemand } from '../../../config/schema';
import { parseAccountCommentDemandResponse } from './parsers.ts';

export async function analyzeAccountWithGemini(
  username: string,
  reelsCount: number,
  totalComments: number,
  prompt: string,
): Promise<AccountCommentDemand> {
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
      console.log('[account-comments] trying model=%s user=%s posts=%s comments=%s', modelName, username, reelsCount, totalComments);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      });
      const result = await model.generateContent([{ text: prompt }]);
      response = result.response.text();
      usedModel = modelName;
      break;
    } catch (e) {
      console.log('[account-comments] model %s failed:', modelName, e instanceof Error ? e.message : e);
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
    operationType: 'account_analysis',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostCents: calculateCost('gemini', usedModel, inputTokens, outputTokens),
  });
  
  return parseAccountCommentDemandResponse(response, username, reelsCount, totalComments);
}
