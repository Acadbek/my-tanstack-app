import type { AIUsageStats } from '@/lib/ai-usage';

interface AIUsageStatsProps {
  stats: AIUsageStats | null;
}

export function AIUsageStats({ stats }: AIUsageStatsProps) {
  if (!stats) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-400">
      <span className="flex items-center gap-1">
        <span className="text-zinc-500">Token:</span>
        <span className="font-medium text-zinc-200">{(stats.totalTokensUsed / 1000).toFixed(1)}K</span>
        <span className="text-zinc-600">/</span>
        <span>{(stats.totalTokensBudget / 1000).toFixed(0)}K</span>
      </span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex items-center gap-1">
        <span className="text-zinc-500">Xarajat:</span>
        <span className="font-medium text-zinc-200">${(stats.totalCostCents / 100).toFixed(2)}</span>
      </span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex items-center gap-1">
        <span className="text-zinc-500">1 ta analiz:</span>
        <span className="font-medium text-zinc-200">
          {stats.totalAnalyses > 0 ? `$${(stats.averageCostPerAnalysis / 100).toFixed(3)}` : '-'}
        </span>
      </span>
      <span className="h-3 w-px bg-white/10" />
      <span className="flex items-center gap-1">
        <span className="text-zinc-500">Qoldi:</span>
        <span className={stats.tokensRemaining < 100000 ? 'font-medium text-amber-400' : 'font-medium text-emerald-400'}>
          {((stats.tokensRemaining / stats.totalTokensBudget) * 100).toFixed(0)}%
        </span>
      </span>
    </div>
  );
}
