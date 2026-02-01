import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import type {
  AccountCommentDemand,
  MerchantCommentInsights,
  ScrapedData,
  VideoAnalysis,
} from '../config/schema'
import { getAIUsageStatsFn } from './api/ai-usage'
import type { AIUsageStats } from '@/lib/ai-usage'
import { AnalyzerHeader, InputForm, AIUsageStats as AIUsageStatsComponent, AccountDemandCard, ReelCard } from './analyzer/components'
import { setAIProviderRuntime } from '../config'

export const Route = createFileRoute('/')({ component: App })

const AnalyzeInputSchema = z.object({
  mode: z.enum(['auto', 'username']),
  input: z.string().min(1),
  aiProvider: z.enum(['gemini', 'openai', 'groq']).optional(),
})

const analyzeServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => AnalyzeInputSchema.parse(d))
  .handler(async ({ data }: { data: z.infer<typeof AnalyzeInputSchema> }) => {
    // allow per-request override
    setAIProviderRuntime(data.aiProvider ?? null)
    const raw = data.input.trim()

    const { analyzeReels, analyzeComments, analyzeAccountCommentDemand } = await import(
      '../services/ai-analizer'
    )
    const {
      scrapeInstagramAccountLatestPosts,
      scrapeInstagramReelFromUrl,
      scrapeInstagramReels,
    } = await import('../services/scraper')
    const {
      saveCompleteAnalysis,
      saveAccountAnalysisComplete,
    } = await import('../db/db-helpers')

    const isUrl = /^https?:\/\//i.test(raw)
    const isUsernameMode = data.mode === 'username'
    const scraped = isUsernameMode
      ? await scrapeInstagramAccountLatestPosts({
          username: raw,
          postCount: 10,
          commentsPerPost: 200,
        })
      : isUrl
        ? await scrapeInstagramReelFromUrl(raw)
        : await scrapeInstagramReels({
            hashtag: raw.replace(/^#/, ''),
            accounts: [],
            videoCount: 5,
            minViews: 0,
          })

    console.log('[analyze] input:', raw)
    console.log('[analyze] scraped reels:', scraped.reels.length)

    const analyses = isUsernameMode ? [] : await analyzeReels(scraped.reels)

    const commentInsights = await Promise.all(
      scraped.reels.map(async (reel) => await analyzeComments(reel)),
    )
    
    console.log('[analyze] commentInsights:', commentInsights.length)
    console.log('[analyze] first insight sample:', commentInsights[0] ? {
      reelId: commentInsights[0].reelId,
      totalComments: commentInsights[0].totalComments,
      hasSummary: !!commentInsights[0].summary,
      hasMerchantSummary: !!commentInsights[0].merchantSummary,
      hasDmTemplate: !!commentInsights[0].dmTemplate,
    } : 'none')

    const accountDemand = isUsernameMode
      ? await analyzeAccountCommentDemand(raw, scraped.reels)
      : null

    console.log('[analyze] analyses:', analyses.length)

    try {
      if (isUsernameMode && accountDemand) {
        console.log('[analyze] saving account analysis to database...')
        await saveAccountAnalysisComplete(
          raw.replace(/^@/, ''),
          scraped.reels,
          accountDemand,
          analyses,
          commentInsights,
        )
        console.log('[analyze] account analysis saved successfully')
      } else if (scraped.reels.length === 1 && analyses.length === 1) {
        console.log('[analyze] saving single reel analysis to database...')
        const sessionType = isUrl ? 'url' : 'hashtag'
        const hashtag = !isUrl ? raw.replace(/^#/, '') : undefined
        await saveCompleteAnalysis(
          scraped.reels[0],
          analyses[0],
          commentInsights[0],
          sessionType,
          raw,
          hashtag,
        )
        console.log('[analyze] single reel analysis saved successfully')
      } else if (scraped.reels.length > 1) {
        console.log('[analyze] saving multiple reels analysis to database...')
        for (let i = 0; i < scraped.reels.length; i++) {
          const reel = scraped.reels[i]
          const analysis = analyses[i]
          const insights = commentInsights[i]
          if (analysis && insights) {
            await saveCompleteAnalysis(
              reel,
              analysis,
              insights,
              'hashtag',
              raw,
              raw.replace(/^#/, ''),
            )
          }
        }
        console.log('[analyze] multiple reels analysis saved successfully')
      }
    } catch (dbError) {
      console.error('[analyze] database save error:', dbError)
    }

    // reset override after processing
    setAIProviderRuntime(null)
    return { scraped, analyses, commentInsights, accountDemand }
  })

function App() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'auto' | 'username'>('auto')
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'groq'>(() => {
    if (typeof window === 'undefined') return 'gemini'
    const stored = window.localStorage.getItem('aiProvider') as 'gemini' | 'openai' | 'groq' | null
    return stored ?? 'gemini'
  })
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [aiStats, setAiStats] = useState<AIUsageStats | null>(null)
  const [result, setResult] = useState<
    | {
        scraped: ScrapedData
        analyses: VideoAnalysis[]
        commentInsights: MerchantCommentInsights[]
        accountDemand: AccountCommentDemand | null
      }
    | null
  >(null)

  useEffect(() => {
    getAIUsageStatsFn()
      .then(setAiStats)
      .catch((e) => console.error('[AI Stats] Failed to load:', e))
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aiProvider', aiProvider)
    }
  }, [aiProvider])

  const onAnalyze = useCallback(async () => {
    setStatus('running')
    setError(null)
    setResult(null)

    try {
      const res = await analyzeServerFn({ data: { input, mode, aiProvider } })
      setResult(res)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [input, mode, aiProvider])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <AnalyzerHeader />
        <AIUsageStatsComponent stats={aiStats} />
        <InputForm
          input={input}
          setInput={setInput}
          mode={mode}
          setMode={setMode}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          status={status}
          error={error}
          onAnalyze={onAnalyze}
        />

        {result ? (
          <div className="mt-8 space-y-6">
            {result.accountDemand && <AccountDemandCard accountDemand={result.accountDemand} />}

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
              <div className="text-2xl font-bold">Scraped Reels: {result.scraped.reels.length}</div>
            </div>

            {result.scraped.reels.map((reel) => {
              const analysis = result.analyses.find((a) => a.reelId === reel.id)
              const insights = result.commentInsights.find((c) => c.reelId === reel.id)
              return (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  analysis={analysis}
                  insights={insights}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
