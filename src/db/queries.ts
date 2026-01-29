import { db } from './index';
import {
  instagramAccounts,
  instagramReels,
  reelComments,
  commentInsights,
  scrapeSessions,
} from './schema';
import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';

export type ReelCommentWithAnalysis = {
  id: number;
  reelId: number;
  commentId: string;
  text: string;
  ownerUsername: string | null;
  likesCount: number | null;
  timestamp: Date | null;
  createdAt: Date | null;
  reel: {
    id: number;
    reelId: string;
    shortCode: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    caption: string | null;
    viewsCount: number | null;
    likesCount: number | null;
    commentsCount: number | null;
    account: {
      id: number;
      username: string;
      fullName: string | null;
    } | null;
  } | null;
  isLead?: boolean;
  leadReason?: string;
};

export type CommentQueryFilters = {
  q?: string;
  username?: string;
  reelId?: number;
  isLead?: boolean;
  from?: Date;
  to?: Date;
  sort?: 'new' | 'old';
  page?: number;
  pageSize?: number;
};

export async function getAnalyzedComments(filters: CommentQueryFilters = {}) {
  const {
    q = '',
    username,
    reelId,
    isLead,
    from,
    to,
    sort = 'new',
    page = 1,
    pageSize = 50,
  } = filters;

  const offset = (page - 1) * pageSize;
  const whereParts: any[] = [];

  if (q.trim()) {
    whereParts.push(ilike(reelComments.text, `%${q.trim()}%`));
  }

  if (username) {
    whereParts.push(ilike(reelComments.ownerUsername, `%${username}%`));
  }

  if (reelId) {
    whereParts.push(eq(reelComments.reelId, reelId));
  }

  if (from) {
    whereParts.push(gte(reelComments.timestamp, from));
  }

  if (to) {
    whereParts.push(lte(reelComments.timestamp, to));
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;
  const orderBy = sort === 'old' ? asc(reelComments.createdAt) : desc(reelComments.createdAt);

  const rows = await db
    .select({
      id: reelComments.id,
      reelId: reelComments.reelId,
      commentId: reelComments.commentId,
      text: reelComments.text,
      ownerUsername: reelComments.ownerUsername,
      likesCount: reelComments.likesCount,
      timestamp: reelComments.timestamp,
      createdAt: reelComments.createdAt,
      reel: {
        id: instagramReels.id,
        reelId: instagramReels.reelId,
        shortCode: instagramReels.shortCode,
        videoUrl: instagramReels.videoUrl,
        thumbnailUrl: instagramReels.thumbnailUrl,
        caption: instagramReels.caption,
        viewsCount: instagramReels.viewsCount,
        likesCount: instagramReels.likesCount,
        commentsCount: instagramReels.commentsCount,
        accountId: instagramReels.accountId,
      },
      account: {
        id: instagramAccounts.id,
        username: instagramAccounts.username,
        fullName: instagramAccounts.fullName,
      },
    })
    .from(reelComments)
    .leftJoin(instagramReels, eq(reelComments.reelId, instagramReels.id))
    .leftJoin(instagramAccounts, eq(instagramReels.accountId, instagramAccounts.id))
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const totalRow = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(reelComments)
    .leftJoin(instagramReels, eq(reelComments.reelId, instagramReels.id))
    .leftJoin(instagramAccounts, eq(instagramReels.accountId, instagramAccounts.id))
    .where(where);

  const total = totalRow[0]?.count ?? 0;

  const commentsWithLeadInfo = await Promise.all(
    rows.map(async (row) => {
      if (!row.reel) return { ...row, isLead: false, leadReason: undefined };

      const insights = await db
        .select()
        .from(commentInsights)
        .where(eq(commentInsights.reelId, row.reel.id))
        .limit(1);

      if (insights.length === 0) {
        return { ...row, isLead: false, leadReason: undefined };
      }

      const priceLeads = (insights[0].priceLeads as any) || [];
      const lead = priceLeads.find(
        (l: any) => l.ownerUsername === row.ownerUsername && l.commentText === row.text,
      );

      return {
        ...row,
        reel: row.reel
          ? {
              ...row.reel,
              account: row.account,
            }
          : null,
        isLead: !!lead,
        leadReason: lead?.reason,
      };
    }),
  );

  if (isLead !== undefined) {
    const filtered = commentsWithLeadInfo.filter((c) => c.isLead === isLead);
    return {
      page,
      pageSize,
      total: filtered.length,
      items: filtered,
    };
  }

  return {
    page,
    pageSize,
    total,
    items: commentsWithLeadInfo,
  };
}

export async function getRecentAnalyses(limit = 20) {
  return await db
    .select({
      id: scrapeSessions.id,
      sessionType: scrapeSessions.sessionType,
      input: scrapeSessions.input,
      hashtag: scrapeSessions.hashtag,
      totalReelsScraped: scrapeSessions.totalReelsScraped,
      scrapedAt: scrapeSessions.scrapedAt,
      account: {
        id: instagramAccounts.id,
        username: instagramAccounts.username,
        fullName: instagramAccounts.fullName,
      },
    })
    .from(scrapeSessions)
    .leftJoin(instagramAccounts, eq(scrapeSessions.accountId, instagramAccounts.id))
    .orderBy(desc(scrapeSessions.scrapedAt))
    .limit(limit);
}

export async function getAccountStats(username: string) {
  const account = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.username, username))
    .limit(1);

  if (account.length === 0) return null;

  const reels = await db
    .select()
    .from(instagramReels)
    .where(eq(instagramReels.accountId, account[0].id));

  const totalViews = reels.reduce((sum, r) => sum + (r.viewsCount || 0), 0);
  const totalLikes = reels.reduce((sum, r) => sum + (r.likesCount || 0), 0);

  const commentsCount = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(reelComments)
    .leftJoin(instagramReels, eq(reelComments.reelId, instagramReels.id))
    .where(eq(instagramReels.accountId, account[0].id));

  return {
    account: account[0],
    totalReels: reels.length,
    totalViews,
    totalLikes,
    totalComments: commentsCount[0]?.count ?? 0,
  };
}
