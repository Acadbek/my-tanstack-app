/**
 * Gemini AI Provider
 * 
 * Google Gemini AI provider implementation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getConfig } from '../../../config';
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage';
import type { AIProvider, InlineImage } from '../types';
import type { Reel, VideoAnalysis } from '../../../config/schema';
import { buildAnalysisPrompt } from '../prompts/video-analysis';
import { parseAIResponse } from '../parsers';

export function createGeminiProvider(): AIProvider {
  const config = getConfig();
  
  // Debug logging
  console.log('[gemini] API key exists:', !!config.geminiApiKey);
  console.log('[gemini] API key length:', config.geminiApiKey?.length || 0);
  console.log('[gemini] Configured model:', config.geminiModel);
  console.log('[gemini] Configured models:', config.geminiModels);
  
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  
  const getModel = (modelName: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
      },
    });

  return {
    async analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis> {
      const prompt = buildAnalysisPrompt(reel);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
      ];

      const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const safeThumbnail = thumbnail && supportedMimeTypes.has(thumbnail.mimeType) ? thumbnail : undefined;

      if (safeThumbnail) {
        parts.push({
          inlineData: {
            mimeType: safeThumbnail.mimeType,
            data: safeThumbnail.data,
          },
        });
      }

      // Always include fallback models in case configured model is deprecated
      const fallbackModels = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];
      const configuredModels = config.geminiModels && config.geminiModels.length > 0
        ? config.geminiModels
        : config.geminiModel
          ? [config.geminiModel]
          : [];
      
      // Merge configured models with fallbacks, removing duplicates
      const modelCandidates = [...new Set([...configuredModels, ...fallbackModels])];

      console.log('[gemini] Model candidates:', modelCandidates);
      console.log('[gemini] Analyzing reel:', reel.id, '@' + reel.ownerUsername);

      let lastError: unknown;
      for (const modelName of modelCandidates) {
        console.log('[gemini] Trying model:', modelName);
        const model = getModel(modelName);
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            console.log('[gemini] Attempt', attempt + 1, 'for model', modelName);
            const result = await model.generateContent(parts);
            const response = result.response.text();
            
            // Record AI usage
            const promptText = typeof parts[0] === 'object' && 'text' in parts[0] ? parts[0].text : '';
            const inputTokens = estimateTokenCount(promptText);
            const outputTokens = estimateTokenCount(response);
            await recordAIUsage({
              organizationId: 1,
              provider: 'gemini',
              model: modelName,
              operationType: 'video_analysis',
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              estimatedCostCents: calculateCost('gemini', modelName, inputTokens, outputTokens),
            });
            
            return parseAIResponse(response, reel.id);
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.log('[gemini] Error on attempt', attempt + 1, 'model', modelName, ':', errMsg);
            lastError = e;
            await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
          }
        }
      }

      const lastMsg = lastError instanceof Error ? lastError.message : String(lastError);
      console.error('[gemini] All attempts failed. Last error:', lastMsg);
      throw new Error(
        `Gemini generateContent failed for models: ${modelCandidates.join(', ')}. Last error: ${lastMsg}`
      );
    },
  };
}
