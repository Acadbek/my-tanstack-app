import { config as dotenvConfig } from 'dotenv';
import { ConfigSchema, type Config } from './schema';

dotenvConfig();

export const loadConfig = (): Config => {
  const geminiModelsRaw = process.env.GEMINI_MODELS;
  const geminiModels = geminiModelsRaw
    ? geminiModelsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    : undefined;
  const groqModelsRaw = process.env.GROQ_MODELS;
  const groqModels = groqModelsRaw
    ? groqModelsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    : undefined;

  const rawConfig = {
    apifyToken: process.env.APIFY_API_TOKEN ?? '',
    aiProvider: (process.env.AI_PROVIDER ?? 'gemini') as 'gemini' | 'openai' | 'groq',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    geminiModels,
    openaiApiKey: process.env.OPENAI_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL,
    groqModels,
  };

  const result = ConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
};

let runtimeAIProvider: Config['aiProvider'] | null = null;
let cachedConfig: Config | null = null;

export const getConfig = (() => {
  return (): Config => {
    if (!cachedConfig) {
      cachedConfig = loadConfig();
    }
    if (runtimeAIProvider) {
      cachedConfig = { ...cachedConfig, aiProvider: runtimeAIProvider };
    }
    return cachedConfig;
  };
})();

export const setAIProviderRuntime = (provider: Config['aiProvider'] | null) => {
  runtimeAIProvider = provider;
  cachedConfig = null;
};
