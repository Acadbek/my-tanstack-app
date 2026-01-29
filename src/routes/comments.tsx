import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { getAnalyzedComments } from '@/db/queries'
import type { ReelCommentWithAnalysis } from '@/db/queries'
import { formatRelativeTime } from '@/utils/relativeTime'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  getSortedRowModel,
  type FilterFn,
} from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import { ArrowUpDown, MessageSquare, TrendingUp, User, Clock } from 'lucide-react'

type CommentItem = ReelCommentWithAnalysis & {
  createdAt: string | null
  timestamp: string | null
}

type CommentsResponse = {
  page: number
  pageSize: number
  total: number
  items: CommentItem[]
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const SearchSchema = z.object({
  q: z.string().optional().default(''),
  username: z.string().optional().default(''),
  lead: z.enum(['all', 'lead', 'nonlead']).optional().default('all'),
  sort: z.enum(['new', 'old']).optional().default('new'),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
})

type SearchValues = z.infer<typeof SearchSchema>

const getComments = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }: { data: SearchValues }) => {
    const fromDate = data.from ? new Date(`${data.from}T00:00:00.000Z`) : undefined
    const toDate = data.to ? new Date(`${data.to}T23:59:59.999Z`) : undefined

    const isLead = data.lead === 'lead' ? true : data.lead === 'nonlead' ? false : undefined

    const result = await getAnalyzedComments({
      q: data.q,
      username: data.username,
      isLead,
      from: fromDate,
      to: toDate,
      sort: data.sort,
      page: data.page,
      pageSize: 50,
    })

    return {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt ? item.createdAt.toISOString() : null,
        timestamp: item.timestamp ? item.timestamp.toISOString() : null,
      })),
    }
  })

export const Route = createFileRoute('/comments')({
  validateSearch: (search) => SearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return await getComments({ data: deps })
  },
  component: CommentsPage,
})

function CommentsPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const data = Route.useLoaderData() as CommentsResponse

  const [mounted, setMounted] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const [draft, setDraft] = useState<SearchValues>(search)

  useEffect(() => {
    setDraft(search)
  }, [search])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data.total, data.pageSize])

  const apply = async (next: SearchValues) => {
    await router.navigate({
      to: '/comments',
      search: {
        ...next,
        page: 1,
      },
      replace: true,
    })
  }

  const columns = useMemo<ColumnDef<CommentItem>[]>(
    () => [
      {
        accessorKey: 'ownerUsername',
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <User className="h-4 w-4" />
              User
              <ArrowUpDown className="h-3 w-3" />
            </button>
          )
        },
        cell: ({ row }) => {
          const username = row.getValue('ownerUsername') as string | null
          return (
            <div className="font-medium text-zinc-200">
              {username ? `@${username}` : `—`}
            </div>
          )
        },
      },
      {
        accessorKey: 'text',
        header: () => (
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comment
          </div>
        ),
        cell: ({ row }) => {
          const text = row.getValue('text') as string
          const leadReason = row.original.leadReason
          return (
            <div className="max-w-md">
              <p className="text-zinc-300 break-words">{text}</p>
              {leadReason && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 border border-emerald-500/20">
                  <span className="text-emerald-400 text-lg">💡</span>
                  <span className="text-xs text-emerald-300">{leadReason}</span>
                </div>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'reel.account.username',
        header: () => (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Account
          </div>
        ),
        cell: ({ row }) => {
          const account = row.original.reel?.account
          return (
            <div className="text-zinc-400 text-sm">
              {account ? `@${account.username}` : `—`}
            </div>
          )
        },
      },
      {
        accessorKey: 'isLead',
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              Lead Status
              <ArrowUpDown className="h-3 w-3" />
            </button>
          )
        },
        cell: ({ row }) => {
          const isLead = row.getValue('isLead') as boolean
          return (
            <span
              className={
                isLead
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 border border-emerald-500/20'
                  : 'inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400'
              }
            >
              {isLead ? (
                <>
                  <span>🔥</span>
                  Hot Lead
                </>
              ) : (
                '—'
              )}
            </span>
          )
        },
      },
      {
        accessorKey: 'likesCount',
        header: ({ column }) => {
          return (
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              Likes
              <ArrowUpDown className="h-3 w-3" />
            </button>
          )
        },
        cell: ({ row }) => {
          const likes = row.getValue('likesCount') as number | null
          return <div className="text-zinc-300">{likes ?? 0}</div>
        },
      },
      {
        accessorKey: 'timestamp',
        header: () => (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time
          </div>
        ),
        cell: ({ row }) => {
          const timestamp = row.getValue('timestamp') as string | null
          return (
            <div className="text-xs text-gray-400" suppressHydrationWarning>
              {mounted && timestamp ? formatRelativeTime(new Date(timestamp)) : ''}
            </div>
          )
        },
      },
    ],
    [mounted],
  )

  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    filterFns: {
      fuzzy: fuzzyFilter,
    },
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Comments Dashboard
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Analyze and filter Instagram comments with AI-powered lead detection
            </p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ← Back to Analyzer
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <form
            className="grid gap-4 md:grid-cols-12"
            onSubmit={(e) => {
              e.preventDefault()
              void apply(draft)
            }}
          >
            <div className="md:col-span-4">
              <label htmlFor="q" className="block text-sm font-medium text-zinc-300 mb-2">
                Search Comments
              </label>
              <input
                id="q"
                name="q"
                value={draft.q}
                onChange={(e) => setDraft((p) => ({ ...p, q: e.target.value }))}
                placeholder="Search comment text…"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
                Username Filter
              </label>
              <input
                id="username"
                name="username"
                value={draft.username}
                onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
                placeholder="@username"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="lead" className="block text-sm font-medium text-zinc-300 mb-2">
                Lead Status
              </label>
              <select
                id="lead"
                name="lead"
                value={draft.lead}
                onChange={(e) => setDraft((p) => ({ ...p, lead: e.target.value as SearchValues['lead'] }))}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="all">All</option>
                <option value="lead">🔥 Hot Leads</option>
                <option value="nonlead">Non-leads</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="from" className="block text-sm font-medium text-zinc-300 mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  id="from"
                  name="from"
                  type="date"
                  value={draft.from}
                  onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <input
                  id="to"
                  name="to"
                  type="date"
                  value={draft.to}
                  onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="md:col-span-12 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const reset: SearchValues = {
                    q: '',
                    username: '',
                    lead: 'all',
                    sort: 'new',
                    from: '',
                    to: '',
                    page: 1,
                  }
                  setDraft(reset)
                  void apply(reset)
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Clear Filters
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Apply Filters
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">
                {data.total.toLocaleString()} Comments
              </h2>
              {search.lead === 'lead' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 border border-emerald-500/20">
                  <span>🔥</span>
                  Hot Leads Only
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>
                Page {data.page} of {totalPages}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10 bg-white/5">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-6 py-4 text-left text-sm font-medium text-zinc-400"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}

                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <MessageSquare className="h-12 w-12 text-zinc-600" />
                        <p className="text-zinc-400 font-medium">No comments found</p>
                        <p className="text-sm text-zinc-500">
                          Try adjusting your filters or analyze some Instagram posts first
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-zinc-400">
              Showing {data.items.length} of {data.total.toLocaleString()} comments
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await router.navigate({
                    to: '/comments',
                    search: { ...search, page: Math.max(1, data.page - 1) },
                    replace: true,
                  })
                }}
                disabled={data.page <= 1}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Previous
              </button>
              <button
                onClick={async () => {
                  await router.navigate({
                    to: '/comments',
                    search: { ...search, page: Math.min(totalPages, data.page + 1) },
                    replace: true,
                  })
                }}
                disabled={data.page >= totalPages}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
