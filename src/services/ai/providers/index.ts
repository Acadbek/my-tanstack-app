/**
 * AI Provider Factory
 * 
 * Factory function to create the appropriate AI provider
 */

import { getConfig } from '../../../config';
import { createGeminiProvider } from './gemini';
import { createOpenAIProvider } from './openai';
import { createGroqProvider } from './groq';
import type { AIProvider } from '../types';

export function createAIProvider(): AIProvider {
  const config = getConfig();

  if (config.aiProvider === 'gemini') {
    return createGeminiProvider();
  }

  if (config.aiProvider === 'groq') {
    return createGroqProvider();
  }

  return createOpenAIProvider();
}
