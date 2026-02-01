import { db } from '../index';
import { reelComments } from '../schema';
import type { Reel } from '../../config/schema';

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
