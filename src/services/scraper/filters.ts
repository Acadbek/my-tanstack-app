import type { Reel } from '../../config/schema';

export const filterByViews = (reels: Reel[], minViews: number): Reel[] => {
  const hasAnyViews = reels.some((r) => (r.viewsCount ?? 0) > 0);
  if (!hasAnyViews) return reels;
  return reels.filter((reel) => reel.viewsCount >= minViews);
};

export const filterByEngagementFallback = (reels: Reel[]): Reel[] => {
  return reels.filter((r) => (r.likesCount ?? 0) >= 200 || (r.commentsCount ?? 0) >= 20);
};

export const sortByEngagement = (reels: Reel[]): Reel[] =>
  [...reels].sort((a, b) => {
    const engagementA = a.viewsCount + a.likesCount * 10 + a.commentsCount * 20;
    const engagementB = b.viewsCount + b.likesCount * 10 + b.commentsCount * 20;
    return engagementB - engagementA;
  });
