import { Link } from '@tanstack/react-router';

export function AnalyzerHeader() {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Instagram Reels Analyzer</h1>
        <Link
          to="/comments"
          search={{ q: '', username: '', lead: 'all', sort: 'new', from: '', to: '', page: 1 }}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Comments
        </Link>
      </div>
      <p className="mt-2 text-zinc-300">
        Reel/Post link yoki hashtag kiriting. Keyin tahlilni boshlang.
      </p>
    </div>
  );
}
