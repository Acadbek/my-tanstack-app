import type { AccountCommentDemand } from '@/config/schema';

interface AccountDemandCardProps {
  accountDemand: AccountCommentDemand;
}

export function AccountDemandCard({ accountDemand }: AccountDemandCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <div className="text-sm text-zinc-400">Account Analysis</div>
          <div className="text-xl font-bold">@{accountDemand.accountUsername}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
          <div className="text-xs font-medium text-zinc-400">Posts Analyzed</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{accountDemand.totalPosts}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
          <div className="text-xs font-medium text-zinc-400">Comments Scraped</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{accountDemand.totalComments}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-4">
          <div className="text-xs font-medium text-zinc-400">Hot Leads</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{accountDemand.hotLeads.length}</div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/5 p-5">
        <div className="text-base font-semibold">Mijozlar ko'proq nimalarni so'rayapti?</div>
        <div className="mt-3 text-sm leading-relaxed text-zinc-200">{accountDemand.summary}</div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
        <div className="text-base font-semibold">DM Template</div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
          {accountDemand.dmTemplate}
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(accountDemand.dmTemplate)
          }}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold hover:from-blue-500 hover:to-purple-500"
        >
          Copy message
        </button>
      </div>
    </div>
  );
}
