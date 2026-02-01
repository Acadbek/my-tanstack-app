import OpenAI from 'openai';
import { getConfig } from '../../../config/index.ts';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage.ts';
import type { AccountCommentDemand } from '../../../config/schema';
import { parseAccountCommentDemandResponse } from './parsers.ts';

export async function analyzeAccountWithOpenAI(
  username: string,
  reelsCount: number,
  totalComments: number,
  prompt: string,
): Promise<AccountCommentDemand> {
  const config = getConfig();
  console.log('[account-comments] provider=openai model=gpt-4o user=%s posts=%s comments=%s', username, reelsCount, totalComments);
  
  const openai = new OpenAI({ apiKey: config.openaiApiKey });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1400,
    temperature: 0.2,
  });
  const response = completion.choices[0]?.message?.content ?? '';
  
  const inputTokens = estimateTokenCount(prompt);
  const outputTokens = estimateTokenCount(response);
  await recordAIUsage({
    organizationId: 1,
    provider: 'openai',
    model: 'gpt-4o',
    operationType: 'account_analysis',
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostCents: calculateCost('openai', 'gpt-4o', inputTokens, outputTokens),
  });
  
  return parseAccountCommentDemandResponse(response, username, reelsCount, totalComments);
}
