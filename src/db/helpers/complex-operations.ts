import type { Reel, VideoAnalysis, MerchantCommentInsights, AccountCommentDemand } from '../../config/schema';
import { saveInstagramAccount } from './accounts.ts';
import { saveInstagramReel } from './reels.ts';
import { saveReelComments } from './comments.ts';
import { saveScrapeSession } from './sessions.ts';
import { saveVideoAnalysis } from './video-analysis.ts';
import { saveCommentInsights } from './comment-insights.ts';
import { saveAccountAnalysis } from './account-analysis.ts';

export async function saveCompleteAnalysis(
  reel: Reel,
  videoAnalysis: VideoAnalysis,
  commentInsights: MerchantCommentInsights,
  sessionType: 'url' | 'hashtag' | 'username',
  input: string,
  hashtag?: string,
) {
  try {
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
  } catch (error) {
    console.log('[db] Save analysis failed (schema may be missing):', error instanceof Error ? error.message : error);
    return {
      accountId: null,
      sessionId: null,
      reelDbId: null,
    };
  }
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
