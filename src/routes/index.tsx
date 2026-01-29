import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import type {
  AccountCommentDemand,
  MerchantCommentInsights,
  ScrapedData,
  VideoAnalysis,
} from '../config/schema'
import { formatRelativeTime } from '../utils/relativeTime'

export const Route = createFileRoute('/')({ component: App })

const AnalyzeInputSchema = z.object({
  mode: z.enum(['auto', 'username']),
  input: z.string().min(1),
})

const analyzeServerFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => AnalyzeInputSchema.parse(d))
  .handler(async ({ data }: { data: z.infer<typeof AnalyzeInputSchema> }) => {
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
    console.log(
      '[analyze] scraped preview:',
      scraped.reels.map((r) => ({
        id: r.id,
        ownerUsername: r.ownerUsername,
        viewsCount: r.viewsCount,
        likesCount: r.likesCount,
        commentsCount: r.commentsCount,
        scrapedComments: r.comments.length,
        videoUrl: r.videoUrl,
      })),
    )

    const analyses = isUsernameMode ? [] : await analyzeReels(scraped.reels)

    const commentInsights = await Promise.all(
      scraped.reels.map(async (reel) => await analyzeComments(reel)),
    )

    const accountDemand = isUsernameMode
      ? await analyzeAccountCommentDemand(raw, scraped.reels)
      : null

    console.log('[analyze] analyses:', analyses.length)
    console.log(
      '[analyze] analyses preview:',
      analyses.map((a) => ({
        reelId: a.reelId,
        trigger: a.hook.emotionalTrigger,
        viralFactors: a.viralFactors.slice(0, 3),
      })),
    )

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

    return { scraped, analyses, commentInsights, accountDemand }
  })

function App() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'auto' | 'username'>('auto')
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [result, setResult] = useState<
    | {
        scraped: ScrapedData
        analyses: VideoAnalysis[]
        commentInsights: MerchantCommentInsights[]
        accountDemand: AccountCommentDemand | null
      }
    | null
  >(null)

  const onAnalyze = useCallback(async () => {
    setStatus('running')
    setError(null)
    setResult(null)

    try {
      const res = await analyzeServerFn({ data: { input, mode } })
      setResult(res)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [input, mode])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold tracking-tight">Instagram Reels Analyzer</h1>
            <Link
              to="/comments"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Comments
            </Link>
          </div>
          <p className="mt-2 text-zinc-300">
            Reel/Post link yoki hashtag kiriting. Keyin tahlilni boshlang.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <fieldset className="space-y-3">
            <legend className="text-sm text-zinc-300">Input turi</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="radio"
                  name="mode"
                  value="auto"
                  checked={mode === 'auto'}
                  onChange={() => setMode('auto')}
                  className="h-4 w-4"
                />
                <span>Link yoki Hashtag</span>
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="radio"
                  name="mode"
                  value="username"
                  checked={mode === 'username'}
                  onChange={() => setMode('username')}
                  className="h-4 w-4"
                />
                <span>Username (oxirgi 2 post)</span>
              </label>
            </div>
          </fieldset>

          <label htmlFor="ig-input" className="mt-4 block text-sm text-zinc-300">
            {mode === 'username' ? 'Instagram username' : 'Instagram URL yoki #hashtag'}
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="ig-input"
              name="ig-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAnalyze()
              }}
              placeholder={
                mode === 'username'
                  ? '@username yoki username'
                  : 'https://www.instagram.com/reel/... yoki skincarehacks'
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onAnalyze}
              disabled={status === 'running' || input.trim().length === 0}
              className="rounded-xl bg-blue-600 px-5 py-3 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'running' ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-8 space-y-6">
            {result.accountDemand ? (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-zinc-400">Account Analysis</div>
                    <div className="text-xl font-bold">@{result.accountDemand.accountUsername}</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="text-xs font-medium text-zinc-400">Posts Analyzed</div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {result.accountDemand.totalPosts}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div className="text-xs font-medium text-zinc-400">Comments Scraped</div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {result.accountDemand.totalComments}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                      <div className="text-xs font-medium text-zinc-400">Hot Leads</div>
                    </div>
                    <div className="mt-2 text-2xl font-bold tabular-nums">
                      {result.accountDemand.hotLeads.length}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/5 p-5">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="text-base font-semibold">Mijozlar ko'proq nimalarni so'rayapti?</div>
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-zinc-200">{result.accountDemand.summary}</div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <div className="text-base font-semibold">Top so'rovlar</div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {result.accountDemand.topRequests.slice(0, 8).map((t, idx) => (
                        <div key={t.topic} className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 hover:border-white/20 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold">
                                {idx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white">{t.topic}</div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                                  <span className="inline-flex items-center gap-1">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    {t.count} so'rov
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {t.examples?.length ? (
                            <div className="mt-3 space-y-2">
                              {t.examples.slice(0, 3).map((ex) => (
                                <div key={ex} className="rounded-md border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-300 break-words">
                                  <span className="text-zinc-500">"</span>{ex}<span className="text-zinc-500">"</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {t.requesters?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {t.requesters.slice(0, 10).map((u) => (
                                <a
                                  key={u}
                                  href={`https://www.instagram.com/${u}/`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-3 py-1 text-xs font-medium text-blue-200 hover:border-blue-400/50 hover:from-blue-500/30 hover:to-purple-500/30 transition-all"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  @{u}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div className="text-base font-semibold">DM Template</div>
                    </div>
                    <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {result.accountDemand.dmTemplate}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(result.accountDemand!.dmTemplate)
                      }}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold hover:from-blue-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy message
                    </button>

                    {result.accountDemand.hotLeads.length ? (
                      <div className="mt-5">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          </svg>
                          <div className="text-base font-semibold">Hot Leads</div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {result.accountDemand.hotLeads.slice(0, 20).map((l) => (
                            <div
                              key={`${l.ownerUsername}:${l.commentText}`}
                              className="rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-red-500/5 p-4 hover:border-orange-400/30 transition-colors"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600">
                                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                    <div className="font-semibold text-white">@{l.ownerUsername}</div>
                                  </div>
                                  <div className="mt-2 rounded-md border border-white/5 bg-black/20 px-3 py-2 text-sm text-zinc-200 break-words">{l.commentText}</div>
                                </div>
                                <a
                                  href={`https://www.instagram.com/${l.ownerUsername}/`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium hover:from-blue-500 hover:to-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  Chat
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div>
                  <div className="text-sm text-zinc-400">Scraped Reels</div>
                  <div className="text-2xl font-bold">{result.scraped.reels.length}</div>
                </div>
              </div>
            </div>

            {result.scraped.reels.map((reel) => {
              const analysis = result.analyses.find((a) => a.reelId === reel.id)
              const insights = result.commentInsights.find((c) => c.reelId === reel.id)
              return (
                <div key={reel.id} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {reel.thumbnailUrl ? (
                      <div className="relative sm:w-48 h-48 sm:h-auto shrink-0">
                        <img
                          src={reel.thumbnailUrl}
                          alt="Post preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <a
                          href={reel.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 flex items-center justify-center group"
                        >
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 group-hover:bg-white/30 transition-all">
                            <svg className="h-8 w-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </a>
                      </div>
                    ) : null}
                    <div className="flex-1 p-5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="text-xl font-bold">@{reel.ownerUsername}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-sm">
                          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="font-medium text-blue-300">{reel.viewsCount.toLocaleString()}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-pink-500/10 px-3 py-1.5 text-sm">
                          <svg className="h-4 w-4 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          <span className="font-medium text-pink-300">{reel.likesCount.toLocaleString()}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-sm">
                          <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="font-medium text-green-300">{reel.commentsCount.toLocaleString()}</span>
                        </div>
                      </div>
                      <a
                        href={reel.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-2 text-sm font-medium hover:from-pink-500 hover:to-purple-500 transition-all"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                        Instagram'da ochish
                      </a>
                    </div>
                  </div>

                  {analysis ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-medium">Hook (ilk 3 soniya)</div>
                        <div className="mt-2 text-sm text-zinc-300">
                          <div className="mb-1">
                            <span className="text-zinc-400">Trigger:</span> {analysis.hook.emotionalTrigger}
                          </div>
                          <div>
                            <span className="text-zinc-400">Vizual:</span>{' '}
                            {analysis.hook.visualElements.slice(0, 5).join(', ') || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-medium">Yechilayotgan muammo</div>
                        <div className="mt-2 text-sm text-zinc-300">{analysis.problemSolved}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-medium">Viral omillar</div>
                        <div className="mt-2 text-sm text-zinc-300">
                          {analysis.viralFactors.length ? (
                            <ul className="list-disc pl-5">
                              {analysis.viralFactors.slice(0, 5).map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-medium">Remix tavsiyasi</div>
                        <div className="mt-2 text-sm text-zinc-300">{analysis.suggestedRemix}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 text-sm text-zinc-400">No analysis available for this reel.</div>
                  )}

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium">Comments (first 10)</div>
                      <div className="mt-2 text-sm text-zinc-300">
                        {reel.comments.length ? (
                          <ul className="space-y-2">
                            {reel.comments.slice(0, 10).map((c) => (
                              <li key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="flex items-center gap-2 text-zinc-400">
                                  <span>{c.ownerUsername ? `@${c.ownerUsername}` : 'user'}</span>
                                  <span
                                    className="text-xs text-gray-400"
                                    suppressHydrationWarning
                                  >
                                    {mounted && c.timestamp ? formatRelativeTime(new Date(c.timestamp)) : ''}
                                  </span>
                                </div>
                                <div className="text-zinc-200">{c.text}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          'No comments scraped.'
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium">Comment summary</div>
                      <div className="mt-2 text-sm text-zinc-300">
                        {insights ? insights.summary : '—'}
                      </div>
                      {insights?.groups?.length ? (
                        <div className="mt-3">
                          <div className="text-sm font-medium">Groups</div>
                          <div className="mt-2 space-y-2">
                            {insights.groups.slice(0, 8).map((g) => (
                              <div key={g.label} className="rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">{g.label}</div>
                                  <div className="text-zinc-400">{g.count}</div>
                                </div>
                                {g.examples?.length ? (
                                  <div className="mt-1 text-sm text-zinc-300">
                                    {g.examples.slice(0, 3).map((ex) => (
                                      <div key={ex}>- {ex}</div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {insights ? (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-medium">Merchant summary</div>
                        <div className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
                          {insights.merchantSummary}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">DM template</div>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(insights.dmTemplate)
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap">
                          {insights.dmTemplate}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          Instagram DM URL orqali matnni avtomatik yozib qo‘yish ishonchli emas.
                          Copy qilib, Chat tugmasi bilan DM ochib yuborasiz.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {insights?.priceLeads?.length ? (
                    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-sm font-medium">Price leads</div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-zinc-400">
                            <tr className="text-left">
                              <th className="py-2 pr-4">Username</th>
                              <th className="py-2 pr-4">Comment</th>
                              <th className="py-2 pr-4">Reason</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insights.priceLeads.slice(0, 30).map((lead) => (
                              <tr key={`${lead.ownerUsername}-${lead.commentText}`} className="border-t border-white/10">
                                <td className="py-2 pr-4 text-zinc-200">@{lead.ownerUsername}</td>
                                <td className="py-2 pr-4 text-zinc-300">{lead.commentText}</td>
                                <td className="py-2 pr-4 text-zinc-400">{lead.reason ?? '—'}</td>
                                <td className="py-2">
                                  <div className="flex gap-2">
                                    <a
                                      href={`https://ig.me/m/${encodeURIComponent(lead.ownerUsername)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs hover:bg-blue-500"
                                    >
                                      Chat
                                    </a>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (insights) {
                                          await navigator.clipboard.writeText(insights.dmTemplate)
                                        }
                                      }}
                                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                                    >
                                      Copy DM
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
