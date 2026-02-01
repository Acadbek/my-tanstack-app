import { db } from '../index';
import { accountAnalyses } from '../schema';
import type { AccountCommentDemand } from '../../config/schema';

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
