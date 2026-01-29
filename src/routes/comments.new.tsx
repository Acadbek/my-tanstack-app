import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/comments/new')({
  component: NewCommentPage,
})

function NewCommentPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              New Comment
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Create a new comment entry
            </p>
          </div>
          <Link
            to="/comments"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            ← Back to Comments
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <form className="space-y-6">
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-zinc-300 mb-2">
                Comment Text
              </label>
              <textarea
                id="comment"
                name="comment"
                rows={4}
                placeholder="Enter comment text..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link
                to="/comments"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Create Comment
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
