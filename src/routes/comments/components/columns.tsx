import { ArrowUpDown, MessageSquare, TrendingUp, User, Clock } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { formatRelativeTime } from '@/utils/relativeTime';
import type { CommentItem } from '../types';

export function createColumns(mounted: boolean): ColumnDef<CommentItem>[] {
  return [
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
        );
      },
      cell: ({ row }) => {
        const username = row.getValue('ownerUsername') as string | null;
        return (
          <div className="font-medium text-zinc-200">
            {username ? `@${username}` : `—`}
          </div>
        );
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
        const text = row.getValue('text') as string;
        const leadReason = row.original.leadReason;
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
        );
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
        const account = row.original.reel?.account;
        return (
          <div className="text-zinc-400 text-sm">
            {account ? `@${account.username}` : `—`}
          </div>
        );
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
        );
      },
      cell: ({ row }) => {
        const isLead = row.getValue('isLead') as boolean;
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
        );
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
        );
      },
      cell: ({ row }) => {
        const likes = row.getValue('likesCount') as number | null;
        return <div className="text-zinc-300">{likes ?? 0}</div>;
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
        const timestamp = row.getValue('timestamp') as string | null;
        return (
          <div className="text-xs text-gray-400" suppressHydrationWarning>
            {mounted && timestamp ? formatRelativeTime(new Date(timestamp)) : ''}
          </div>
        );
      },
    },
  ];
}
