import { db } from '../index';
import { commentInsights } from '../schema';
import type { MerchantCommentInsights } from '../../config/schema';
import { eq } from 'drizzle-orm';

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
