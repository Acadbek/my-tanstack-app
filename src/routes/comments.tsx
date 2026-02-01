import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { getAnalyzedComments } from '@/db/queries'
import { CommentsHeader, FilterForm, CommentsTable, Pagination } from './comments/components'
import { SearchSchema, type SearchValues, type CommentsResponse } from './comments/types'

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
  loader: async ({ deps }) => await getComments({ data: deps }),
  component: CommentsPage,
})

function CommentsPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const data = Route.useLoaderData() as CommentsResponse
  const [draft, setDraft] = useState<SearchValues>(search)

  useEffect(() => {
    setDraft(search)
  }, [search])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data.total, data.pageSize])

  const applyFilters = async (next: SearchValues) => {
    await router.navigate({
      to: '/comments',
      search: { ...next, page: 1 },
      replace: true,
    })
  }

  const resetFilters = async () => {
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
    await applyFilters(reset)
  }

  const handlePageChange = async (page: number) => {
    await router.navigate({
      to: '/comments',
      search: { ...search, page },
      replace: true,
    })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <CommentsHeader />
        
        <FilterForm
          draft={draft}
          setDraft={setDraft}
          onSubmit={() => applyFilters(draft)}
          onReset={resetFilters}
        />

        <CommentsTable
          items={data.items}
          total={data.total}
          isLeadFilter={search.lead === 'lead'}
        />

        <Pagination
          page={data.page}
          totalPages={totalPages}
          total={data.total}
          itemsCount={data.items.length}
          onPageChange={handlePageChange}
        />
      </div>
    </main>
  )
}
