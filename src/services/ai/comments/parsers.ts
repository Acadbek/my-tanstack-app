import type { MerchantCommentInsights } from '../../../config/schema';

export function parseMerchantInsightsResponse(
  response: string,
  reelId: string,
  totalComments: number,
): MerchantCommentInsights {
  // Remove control characters that break JSON parsing
  const sanitized = response.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = sanitized.slice(0, 500);
    throw new Error(`Failed to parse merchant insights as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    reelId,
    totalComments,
    summary: parsed.summary ?? 'Summary yoq',
    merchantSummary: parsed.merchantSummary ?? 'Merchant summary yoq',
    dmTemplate:
      parsed.dmTemplate ??
      "Assalomu alaykum! Narx va batafsil ma'lumot uchun DM qoldiring.",
    priceLeads: Array.isArray(parsed.priceLeads) ? parsed.priceLeads : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
  };
}
