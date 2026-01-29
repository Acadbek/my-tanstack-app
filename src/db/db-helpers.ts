import { db } from './index';
import {
  instagramAccounts,
  instagramReels,
  reelComments,
  videoAnalyses,
  commentInsights,
  accountAnalyses,
  scrapeSessions,
} from './schema';
import type {
  Reel,
  VideoAnalysis,
  MerchantCommentInsights,
  AccountCommentDemand,
} from '../config/schema';
import { eq } from 'drizzle-orm';

export async function saveInstagramAccount(username: string, fullName?: string) {
  const existing = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.username, username))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(instagramAccounts)
      .set({
        fullName: fullName || existing[0].fullName,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instagramAccounts.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db
    .insert(instagramAccounts)
    .values({
      username,
      fullName,
      lastAnalyzedAt: new Date(),
    })
    .returning({ id: instagramAccounts.id });

  return result[0].id;
}

export async function saveScrapeSession(
  sessionType: 'url' | 'hashtag' | 'username',
  input: string,
  hashtag?: string,
  accountId?: number,
  totalReelsScraped?: number,
) {
  const result = await db
    .insert(scrapeSessions)
    .values({
      sessionType,
      input,
      hashtag,
      accountId,
      totalReelsScraped: totalReelsScraped || 0,
    })
    .returning({ id: scrapeSessions.id });

  return result[0].id;
}

export async function saveInstagramReel(reel: Reel, accountId?: number) {
  console.log('[db] Saving reel:', reel.id, 'accountId:', accountId);
  const existing = await db
    .select()
    .from(instagramReels)
    .where(eq(instagramReels.reelId, reel.id))
    .limit(1);

  if (existing.length > 0) {
    console.log('[db] Reel exists, updating:', existing[0].id);
    await db
      .update(instagramReels)
      .set({
        likesCount: reel.likesCount,
        commentsCount: reel.commentsCount,
        viewsCount: reel.viewsCount,
        caption: reel.caption,
        thumbnailUrl: reel.thumbnailUrl,
      })
      .where(eq(instagramReels.id, existing[0].id));
    return existing[0].id;
  }

  console.log('[db] Inserting new reel');
  const result = await db
    .insert(instagramReels)
    .values({
      reelId: reel.id,
      shortCode: reel.shortCode,
      accountId,
      videoUrl: reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      caption: reel.caption,
      likesCount: reel.likesCount,
      commentsCount: reel.commentsCount,
      viewsCount: reel.viewsCount,
      duration: reel.duration ? Math.round(reel.duration) : null,
      timestamp: reel.timestamp ? new Date(reel.timestamp) : null,
    })
    .returning({ id: instagramReels.id });

  console.log('[db] Reel saved with id:', result[0].id);
  return result[0].id;
}

export async function saveReelComments(reelDbId: number, comments: Reel['comments']) {
  if (!comments || comments.length === 0) {
    console.log('[db] No comments to save for reel:', reelDbId);
    return;
  }

  console.log('[db] Saving', comments.length, 'comments for reel:', reelDbId);
  const values = comments.map((comment) => ({
    reelId: reelDbId,
    commentId: comment.id,
    text: comment.text,
    ownerUsername: comment.ownerUsername,
    likesCount: comment.likesCount,
    timestamp: comment.timestamp ? new Date(comment.timestamp) : null,
  }));

  await db.insert(reelComments).values(values).onConflictDoNothing();
  console.log('[db] Comments saved successfully');
}

export async function saveVideoAnalysis(reelDbId: number, analysis: VideoAnalysis) {
  const existing = await db
    .select()
    .from(videoAnalyses)
    .where(eq(videoAnalyses.reelId, reelDbId))
    .limit(1);

  const data = {
    reelId: reelDbId,
    hook: analysis.hook,
    problemSolved: analysis.problemSolved,
    callToAction: analysis.callToAction,
    contentStructure: analysis.contentStructure,
    audienceInsights: analysis.audienceInsights,
    viralFactors: analysis.viralFactors,
    suggestedRemix: analysis.suggestedRemix,
  };

  if (existing.length > 0) {
    await db
      .update(videoAnalyses)
      .set({ ...data, analyzedAt: new Date() })
      .where(eq(videoAnalyses.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db
    .insert(videoAnalyses)
    .values(data)
    .returning({ id: videoAnalyses.id });

  return result[0].id;
}

export async function saveCommentInsights(
  reelDbId: number,
  insights: MerchantCommentInsights,
) {
  const existing = await db
    .select()
    .from(commentInsights)
    .where(eq(commentInsights.reelId, reelDbId))
    .limit(1);

  const data = {
    reelId: reelDbId,
    totalComments: insights.totalComments,
    summary: insights.summary,
    merchantSummary: insights.merchantSummary,
    dmTemplate: insights.dmTemplate,
    priceLeads: insights.priceLeads,
    groups: insights.groups,
  };

  if (existing.length > 0) {
    await db
      .update(commentInsights)
      .set({ ...data, analyzedAt: new Date() })
      .where(eq(commentInsights.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db
    .insert(commentInsights)
    .values(data)
    .returning({ id: commentInsights.id });

  return result[0].id;
}

export async function saveAccountAnalysis(
  accountId: number,
  analysis: AccountCommentDemand,
) {
  const result = await db
    .insert(accountAnalyses)
    .values({
      accountId,
      totalPosts: analysis.totalPosts,
      totalComments: analysis.totalComments,
      summary: analysis.summary,
      dmTemplate: analysis.dmTemplate,
      topRequests: analysis.topRequests,
      hotLeads: analysis.hotLeads,
    })
    .returning({ id: accountAnalyses.id });

  return result[0].id;
}

export async function saveCompleteAnalysis(
  reel: Reel,
  videoAnalysis: VideoAnalysis,
  commentInsights: MerchantCommentInsights,
  sessionType: 'url' | 'hashtag' | 'username',
  input: string,
  hashtag?: string,
) {
  const accountId = await saveInstagramAccount(reel.ownerUsername, reel.ownerFullName);
  const sessionId = await saveScrapeSession(sessionType, input, hashtag, accountId, 1);
  const reelDbId = await saveInstagramReel(reel, accountId);
  
  await saveReelComments(reelDbId, reel.comments);
  await saveVideoAnalysis(reelDbId, videoAnalysis);
  await saveCommentInsights(reelDbId, commentInsights);

  return {
    accountId,
    sessionId,
    reelDbId,
  };
}

export async function saveAccountAnalysisComplete(
  username: string,
  reels: Reel[],
  accountDemand: AccountCommentDemand,
  videoAnalyses: VideoAnalysis[],
  commentInsights: MerchantCommentInsights[],
) {
  const accountId = await saveInstagramAccount(username);
  const sessionId = await saveScrapeSession('username', username, undefined, accountId, reels.length);

  for (const reel of reels) {
    const reelDbId = await saveInstagramReel(reel, accountId);
    await saveReelComments(reelDbId, reel.comments);

    const videoAnalysis = videoAnalyses.find((a) => a.reelId === reel.id);
    if (videoAnalysis) {
      await saveVideoAnalysis(reelDbId, videoAnalysis);
    }

    const insights = commentInsights.find((c) => c.reelId === reel.id);
    if (insights) {
      await saveCommentInsights(reelDbId, insights);
    }
  }

  await saveAccountAnalysis(accountId, accountDemand);

  return {
    accountId,
    sessionId,
  };
}
