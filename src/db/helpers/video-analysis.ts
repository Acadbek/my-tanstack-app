import { db } from '../index';
import { videoAnalyses } from '../schema';
import type { VideoAnalysis } from '../../config/schema';
import { eq } from 'drizzle-orm';

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
