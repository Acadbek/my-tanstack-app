/**
 * Batch Analysis Service
 * 
 * Analyze multiple reels in batch with progress tracking
 */

import type { Reel, VideoAnalysis } from '../../../config/schema';
import type { AnalysisProgress } from '../types/index';
import { createAIProvider } from '../providers';
import { fetchThumbnailInlineImage } from '../utils/thumbnails';
import { buildFallbackAnalysis } from '../utils/fallback-analysis';

export async function analyzeReels(
  reels: Reel[],
  onProgress?: (progress: AnalysisProgress) => void
): Promise<VideoAnalysis[]> {
  const provider = createAIProvider();
  const analyses: VideoAnalysis[] = [];

  for (let i = 0; i < reels.length; i++) {
    const reel = reels[i];

    onProgress?.({
      current: i + 1,
      total: reels.length,
      reelId: reel.id,
    });

    try {
      const thumbnail = reel.thumbnailUrl ? await fetchThumbnailInlineImage(reel.thumbnailUrl) : undefined;
      const analysis = await provider.analyzeVideo(reel, thumbnail);
      analyses.push(analysis);

      // Rate limiting delay between API calls
      if (i < reels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nFailed to analyze reel ${reel.id} (@${reel.ownerUsername}): ${msg}`);
      analyses.push(buildFallbackAnalysis(reel));
    }
  }

  return analyses;
}
