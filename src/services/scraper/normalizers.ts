import { CommentSchema, ReelSchema, type Comment, type Reel } from '../../config/schema';
import { toAbsoluteInstagramUrl, normalizeTimestamp } from './utils.ts';
import type { ApifyReelItem, ApifyCommentItem } from './types.ts';

export const normalizeComment = (
  raw: {
    id?: string;
    text?: string;
    ownerUsername?: string;
    likesCount?: number;
    timestamp?: string;
  } | undefined
): Comment | null => {
  try {
    const comment = CommentSchema.parse({
      id: raw?.id ?? `comment-${Date.now()}-${Math.random()}`,
      text: raw?.text ?? '',
      ownerUsername: raw?.ownerUsername,
      likesCount: raw?.likesCount ?? 0,
      timestamp: normalizeTimestamp(raw?.timestamp),
    });
    return comment;
  } catch {
    return null;
  }
};

export const normalizeReel = (item: ApifyReelItem): Reel | null => {
  try {
    const rawUrl = item.url ?? item.permalink ?? item.videoUrl;
    const candidateUrl = rawUrl ? toAbsoluteInstagramUrl(rawUrl) : undefined;
    if (!candidateUrl) return null;

    const shortCodeFromUrl = (() => {
      const match = candidateUrl.match(/instagram\.com\/(reel|p)\/([^/?#]+)/i);
      return match?.[2];
    })();

    const comments = (item.latestComments ?? [])
      .map(normalizeComment)
      .filter((c): c is Comment => c !== null)
      .slice(0, 10);

    const reel = ReelSchema.parse({
      id: item.id ?? item.shortCode ?? `reel-${Date.now()}`,
      shortCode: item.shortCode ?? shortCodeFromUrl ?? '',
      videoUrl: candidateUrl,
      thumbnailUrl: (item.thumbnailUrl ?? item.displayUrl)
        ? toAbsoluteInstagramUrl(item.thumbnailUrl ?? item.displayUrl!)
        : undefined,
      caption: item.caption ?? '',
      likesCount: item.likesCount ?? 0,
      commentsCount: item.commentsCount ?? 0,
      viewsCount: item.videoViewCount ?? item.videoPlayCount ?? 0,
      ownerUsername: item.ownerUsername ?? item.owner?.username ?? 'unknown',
      ownerFullName: item.ownerFullName ?? item.owner?.fullName,
      timestamp: item.timestamp,
      duration: item.videoDuration,
      comments,
    });

    return reel;
  } catch {
    return null;
  }
};

export const isLikelyReel = (item: ApifyReelItem): boolean => {
  const u = (item.videoUrl ?? item.url ?? item.permalink ?? '').toLowerCase();
  const byUrl = u.includes('/reel/');
  const byPostUrl = u.includes('/p/');
  const byType = (item.type ?? '').toLowerCase().includes('video');
  const byProduct = (item.productType ?? '').toLowerCase().includes('clips');
  return byUrl || byProduct || byType || byPostUrl;
};

export const parseApifyComment = (c: ApifyCommentItem): Comment | null => {
  try {
    return CommentSchema.parse({
      id: c.id ?? `comment-${Date.now()}-${Math.random()}`,
      text: c.text ?? '',
      ownerUsername: c.ownerUsername,
      likesCount: 0,
      timestamp: normalizeTimestamp(c.timestamp),
    });
  } catch {
    return null;
  }
};
