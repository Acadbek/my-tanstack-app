import { createServerFn } from '@tanstack/react-start';
import { getAIUsageStats, type AIUsageStats } from '@/lib/ai-usage';

// Default organization ID for now (since we removed Clerk)
const DEFAULT_ORG_ID = 1;

export const getAIUsageStatsFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<AIUsageStats> => {
    try {
      const stats = await getAIUsageStats(DEFAULT_ORG_ID);
      return stats;
    } catch (error) {
      console.error('[getAIUsageStatsFn] Error:', error);
      // Return default stats if error
      return {
        totalTokensUsed: 0,
        totalTokensBudget: 1000000,
        tokensRemaining: 1000000,
        totalCostCents: 0,
        totalAnalyses: 0,
        averageCostPerAnalysis: 0,
        usageByModel: {},
        dailyUsage: [],
      };
    }
  });
