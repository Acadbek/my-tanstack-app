import { useEffect, useState } from 'react';
import type { Reel, VideoAnalysis, MerchantCommentInsights } from '@/config/schema';
import { proxyImageFn } from '@/routes/api/image-proxy';

interface ReelCardProps {
  reel: Reel;
  analysis?: VideoAnalysis;
  insights?: MerchantCommentInsights;
}

export function ReelCard({ reel, analysis, insights }: ReelCardProps) {
  const [proxiedImageUrl, setProxiedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reel.thumbnailUrl) return;

    let mounted = true;

    proxyImageFn({ data: { url: reel.thumbnailUrl } })
      .then((result) => {
        if (mounted) {
          setProxiedImageUrl(`data:${result.contentType};base64,${result.data}`);
        }
      })
      .catch((error) => {
        console.error('[ReelCard] Failed to proxy image:', error);
      });

    return () => {
      mounted = false;
    };
  }, [reel.thumbnailUrl]);
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {proxiedImageUrl ? (
          <div className="relative sm:w-48 h-48 sm:h-auto shrink-0">
            <img
              src={proxiedImageUrl}
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
            <div className="text-xl font-bold">@{reel.ownerUsername}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-sm">
              <span className="font-medium text-blue-300">{reel.viewsCount.toLocaleString()}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-pink-500/10 px-3 py-1.5 text-sm">
              <span className="font-medium text-pink-300">{reel.likesCount.toLocaleString()}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-sm">
              <span className="font-medium text-green-300">{reel.commentsCount.toLocaleString()}</span>
            </div>
          </div>
          <a
            href={reel.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-2 text-sm font-medium hover:from-pink-500 hover:to-purple-500 transition-all"
          >
            Instagram'da ochish
          </a>
        </div>
      </div>

      {analysis ? (
        <div className="p-5 border-t border-white/10">
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </div>
      ) : null}

      {insights ? (
        <div className="p-5 border-t border-white/10">
          <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
