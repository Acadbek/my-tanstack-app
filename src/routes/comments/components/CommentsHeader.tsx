import { Link } from '@tanstack/react-router';

interface CommentsHeaderProps {
  title?: string;
  description?: string;
}

export function CommentsHeader({
  title = 'Comments Dashboard',
  description = 'Analyze and filter Instagram comments with AI-powered lead detection',
}: CommentsHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          {title}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{description}</p>
      </div>
      <Link
        to="/"
        className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ← Back to Analyzer
      </Link>
    </div>
  );
}
