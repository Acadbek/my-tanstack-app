import { eq, and, sql, desc, sum, count } from 'drizzle-orm';
import { db } from '@/db/index';
import * as schema from '@/db/schema';

const { aiUsage, organizations } = schema;

export interface AIUsageRecord {
  organizationId: number;
  userId?: number;
  provider: 'gemini' | 'openai' | 'groq';
  model: string;
  operationType: 'video_analysis' | 'comment_analysis' | 'account_analysis';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
}

// Token costs per 1K tokens (in USD cents)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 }, // Updated pricing
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-flash-latest': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-3-pro-preview': { input: 3.5, output: 10.5 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'llama-3.1-70b-versatile': { input: 0.0, output: 0.0 },
  'mixtral-8x7b-32768': { input: 0.0, output: 0.0 },
};

export function calculateCost(_provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const costConfig = TOKEN_COSTS[model] || TOKEN_COSTS['gemini-1.5-flash'];
  const inputCost = (inputTokens / 1000) * costConfig.input;
  const outputCost = (outputTokens / 1000) * costConfig.output;
  return Math.round((inputCost + outputCost) * 100); // Convert to cents
}

export async function recordAIUsage(usage: AIUsageRecord): Promise<void> {
  const now = new Date();
  
  try {
    await db.insert(aiUsage).values({
      organizationId: usage.organizationId,
      userId: usage.userId,
      provider: usage.provider,
      model: usage.model,
      operationType: usage.operationType,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostCents: usage.estimatedCostCents,
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear(),
    });
    
    // Update organization's monthly usage
    await db
      .update(organizations)
      .set({
        aiTokensUsedThisMonth: sql`${organizations.aiTokensUsedThisMonth} + ${usage.totalTokens}`,
        aiBudgetSpentCents: sql`${organizations.aiBudgetSpentCents} + ${usage.estimatedCostCents}`,
      })
      .where(eq(organizations.id, usage.organizationId));
  } catch (e) {
    // Silently ignore if tables don't exist - usage tracking is optional
    console.warn('[ai-usage] Could not record usage (tables may not exist):', e instanceof Error ? e.message : e);
  }
}

export interface AIUsageStats {
  totalTokensUsed: number;
  totalTokensBudget: number;
  tokensRemaining: number;
  totalCostCents: number;
  totalAnalyses: number;
  averageCostPerAnalysis: number;
  usageByModel: Record<string, { tokens: number; cost: number; count: number }>;
  dailyUsage: { date: string; tokens: number; cost: number }[];
}

export async function getAIUsageStats(organizationId: number): Promise<AIUsageStats> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  // Get organization budget - gracefully handle missing table
  let org: { aiTokenBudgetMonthly: number | null; aiTokensUsedThisMonth: number | null; aiBudgetSpentCents: number | null } | undefined;
  try {
    org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        aiTokenBudgetMonthly: true,
        aiTokensUsedThisMonth: true,
        aiBudgetSpentCents: true,
      },
    });
  } catch (e) {
    console.warn('[ai-usage] organizations table not found, using defaults');
    org = undefined;
  }
  
  const budget = org?.aiTokenBudgetMonthly || 1000000;
  const used = org?.aiTokensUsedThisMonth || 0;
  
  // Get usage by model - gracefully handle missing ai_usage table
  let usageByModel: Record<string, { tokens: number; cost: number; count: number }> = {};
  let dailyUsage: { date: string; tokens: number; cost: number }[] = [];
  
  try {
    const modelUsage = await db
      .select({
        model: aiUsage.model,
        tokens: sum(aiUsage.totalTokens),
        cost: sum(aiUsage.estimatedCostCents),
        count: count(),
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.organizationId, organizationId),
          eq(aiUsage.periodYear, currentYear),
          eq(aiUsage.periodMonth, currentMonth)
        )
      )
      .groupBy(aiUsage.model);
    
    for (const row of modelUsage) {
      usageByModel[row.model] = {
        tokens: Number(row.tokens) || 0,
        cost: Number(row.cost) || 0,
        count: Number(row.count) || 0,
      };
    }
    
    // Get daily usage for last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyUsageData = await db
      .select({
        date: sql<string>`DATE(${aiUsage.createdAt})`,
        tokens: sum(aiUsage.totalTokens),
        cost: sum(aiUsage.estimatedCostCents),
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.organizationId, organizationId),
          sql`${aiUsage.createdAt} >= ${thirtyDaysAgo}`
        )
      )
      .groupBy(sql`DATE(${aiUsage.createdAt})`)
      .orderBy(desc(sql`DATE(${aiUsage.createdAt})`));
    
    dailyUsage = dailyUsageData.map(row => ({
      date: row.date,
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
    }));
  } catch (e) {
    console.warn('[ai-usage] ai_usage table not found, using defaults');
  }
  
  const totalCost = org?.aiBudgetSpentCents || 0;
  const totalAnalyses = Object.values(usageByModel).reduce((sum, m) => sum + m.count, 0);
  
  return {
    totalTokensUsed: used,
    totalTokensBudget: budget,
    tokensRemaining: Math.max(0, budget - used),
    totalCostCents: totalCost,
    totalAnalyses,
    averageCostPerAnalysis: totalAnalyses > 0 ? Math.round(totalCost / totalAnalyses) : 0,
    usageByModel,
    dailyUsage,
  };
}

// Estimate tokens from text (rough approximation: ~4 chars per token)
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Reset monthly usage (call at start of new month)
export async function resetMonthlyAIUsage(organizationId: number): Promise<void> {
  await db
    .update(organizations)
    .set({
      aiTokensUsedThisMonth: 0,
      aiBudgetSpentCents: 0,
    })
    .where(eq(organizations.id, organizationId));
}
