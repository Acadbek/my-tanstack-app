export interface ApifyReelItem {
  id?: string;
  shortCode?: string;
  videoUrl?: string;
  url?: string;
  permalink?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  type?: string;
  productType?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  owner?: {
    username?: string;
    fullName?: string;
  };
  timestamp?: string;
  videoDuration?: number;
  latestComments?: Array<{
    id?: string;
    text?: string;
    ownerUsername?: string;
    likesCount?: number;
    timestamp?: string;
  }>;
}

export interface ApifyCommentItem {
  id?: string;
  postId?: string;
  text?: string;
  position?: number;
  timestamp?: string;
  ownerUsername?: string;
  ownerId?: string;
  ownerIsVerified?: boolean;
  ownerProfilePicUrl?: string;
}

export interface ScrapeOptions {
  hashtag: string;
  accounts?: string[];
  videoCount: number;
  minViews: number;
}
