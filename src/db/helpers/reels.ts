import { db } from '../index';
import { instagramReels } from '../schema';
import type { Reel } from '../../config/schema';
import { eq } from 'drizzle-orm';

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
