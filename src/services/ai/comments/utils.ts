import type { Reel, Lead } from '../../../config/schema';

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
