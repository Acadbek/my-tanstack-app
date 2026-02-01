import { getConfig } from '../../../config'
import { recordAIUsage, estimateTokenCount, calculateCost } from '../../../lib/ai-usage'
import type { AIProvider, InlineImage } from '../types'
import type { Reel, VideoAnalysis } from '../../../config/schema'
import { buildAnalysisPrompt } from '../prompts/video-analysis'
import { parseAIResponse } from '../parsers'

type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqCompletionOptions {
  temperature?: number
  maxTokens?: number
}

const DEFAULT_GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

async function callGroqChat(messages: GroqMessage[], options?: GroqCompletionOptions): Promise<{ content: string; modelName: string }> {
  const config = getConfig()

  if (!config.groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const configuredModels = config.groqModels && config.groqModels.length > 0
    ? config.groqModels
    : config.groqModel
      ? [config.groqModel]
      : []

  const modelCandidates = Array.from(new Set([...configuredModels, ...DEFAULT_GROQ_MODELS]))

  if (modelCandidates.length === 0) {
    modelCandidates.push(...DEFAULT_GROQ_MODELS)
  }

  let lastError: unknown = null

  for (const modelName of modelCandidates) {
    try {
      const response = await fetch(GROQ_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 2000,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[Groq ${response.status}] ${errorText}`)
      }

      const data = await response.json()
      const content: string | undefined = data?.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('Groq response was empty')
      }

      return { content, modelName }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function groqTextCompletion(prompt: string, options?: GroqCompletionOptions) {
  const messages: GroqMessage[] = [{ role: 'user', content: prompt }]
  return callGroqChat(messages, options)
}

export function createGroqProvider(): AIProvider {
  return {
    async analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis> {
      const prompt = buildAnalysisPrompt(reel)
      const thumbnailSnippet = thumbnail
        ? `\n\nThumbnail (base64, truncated): ${thumbnail.data.slice(0, 4000)}`
        : ''
      const { content, modelName } = await callGroqChat(
        [
          {
            role: 'user',
            content: `${prompt}${thumbnailSnippet}`,
          },
        ],
      )

      const inputTokens = estimateTokenCount(prompt)
      const outputTokens = estimateTokenCount(content)
      await recordAIUsage({
        organizationId: 1,
        provider: 'groq',
        model: modelName,
        operationType: 'video_analysis',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostCents: calculateCost('groq', modelName, inputTokens, outputTokens),
      })

      return parseAIResponse(content, reel.id)
    },
  }
}
