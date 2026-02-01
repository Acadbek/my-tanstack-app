import type { Reel, MerchantCommentInsights } from '@/config/schema';
import { MerchantCommentInsightsSchema } from '@/config/schema';
import type { Lead } from '../types';

export function buildMerchantCommentInsightsPrompt(reel: Reel): string {
  const comments = reel.comments.slice(0, 120);
  const commentsBlock = comments
    .map((c, i) => `${i + 1}. ${c.ownerUsername ? `@${c.ownerUsername}: ` : ''}${c.text}`)
    .join('\n');

  return `
You are a marketing and social media analytics expert.

Task: Analyze Instagram post/reel comments and extract actionable insights for an e-commerce business owner.

Context:
- Post owner: @${reel.ownerUsername}
- Number of comments (scraped): ${comments.length}

Comments:
${commentsBlock}

Requirements:
1) Group comments into 5-8 categories.
2) For each group: label (short, in simple Uzbek), count (approximate is fine), and 2-3 examples (in original language).
3) PRICE-LEADS: Identify comments showing purchase intent (asking about price, discount, how to buy, ordering).
   For each return: { ownerUsername, commentText, reason (in simple Uzbek, no jargon) }. Skip if no ownerUsername.
4) merchantSummary: 5-10 bullet points for the business owner (in SIMPLE UZBEK, use "-" prefix, no marketing jargon).
5) dmTemplate: Ready-to-send DM template for price inquiries (in SIMPLE UZBEK, conversational tone, single string).
6) summary: Brief 3-6 sentence overall summary (in SIMPLE UZBEK, easy to understand).
7) Response must be valid JSON only.

JSON format:
{
  "summary": "...",
  "merchantSummary": "- ...\n- ...",
  "dmTemplate": "Assalomu alaykum ...",
  "priceLeads": [
    { "ownerUsername": "username", "commentText": "Narxi qancha?", "reason": "Narx so'radi" }
  ],
  "groups": [
    { "label": "Narx / chegirma", "count": 12, "examples": ["Narxi qancha?", "Chegirma bormi?"] }
  ]
}
`.trim();
}

export function parseMerchantInsightsResponse(
  response: string,
  reelId: string,
  totalComments: number,
): MerchantCommentInsights {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse merchant insights as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return MerchantCommentInsightsSchema.parse({
    reelId,
    totalComments,
    summary: parsed.summary ?? 'Summary yoq',
    merchantSummary: parsed.merchantSummary ?? 'Merchant summary yoq',
    dmTemplate:
      parsed.dmTemplate ??
      'Assalomu alaykum! Narx va batafsil ma’lumot uchun DM qoldiring.',
    priceLeads: Array.isArray(parsed.priceLeads) ? parsed.priceLeads : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
  });
}

export function extractRegexPriceLeads(reel: Reel, limit = 50): Lead[] {
  return reel.comments
    .filter((c) => !!c.ownerUsername)
    .filter((c) => /(narx|narh|qimmat|arzon|orzon|nechpul|necpul|skidka|chegirma|%|nechchi|qancha|qanca|price|olsa|olaman|buyurtma)/i.test(c.text))
    .slice(0, limit)
    .map((c) => ({
      ownerUsername: c.ownerUsername!,
      commentText: c.text,
      reason: 'Regex: price/buy intent',
    }));
}
