/**
 * OpenAI Provider
 * 
 * OpenAI GPT-4o provider implementation
 */

import OpenAI from 'openai';
import { getConfig } from '../../../config';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage';
import type { AIProvider, InlineImage } from '../types';
import type { Reel, VideoAnalysis } from '../../../config/schema';
import { buildAnalysisPrompt } from '../prompts/video-analysis';
import { parseAIResponse } from '../parsers';

export function createOpenAIProvider(): AIProvider {
  const config = getConfig();
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  return {
    async analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis> {
      const prompt = buildAnalysisPrompt(reel);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: thumbnail
            ? [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${thumbnail.mimeType};base64,${thumbnail.data}`,
                  },
                },
              ]
            : prompt,
        },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2000,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content ?? '';
      
      // Record AI usage
      const inputTokens = estimateTokenCount(prompt);
      const outputTokens = estimateTokenCount(response);
      await recordAIUsage({
        organizationId: 1,
        provider: 'openai',
        model: 'gpt-4o',
        operationType: 'video_analysis',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostCents: calculateCost('openai', 'gpt-4o', inputTokens, outputTokens),
      });
      
      return parseAIResponse(response, reel.id);
    },
  };
}
