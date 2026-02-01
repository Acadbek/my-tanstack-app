import type { Reel, AccountCommentDemand, Lead } from '../../../config/schema';
import { extractRegexPriceLeads } from '../comments/utils.ts';

export function fallbackAccountCommentDemand(username: string, reels: Reel[]): AccountCommentDemand {
  const all = reels.flatMap((r) => r.comments.map((c) => ({ postId: r.id, ...c })));
  const withUser = all.filter((c) => !!c.ownerUsername);

  const mkTopic = (topic: string, re: RegExp) => {
    const hits = withUser.filter((c) => re.test(c.text));
    const requesters = Array.from(new Set(hits.map((h) => h.ownerUsername!).filter(Boolean))).slice(0, 12);
    const examples = hits.map((h) => h.text).slice(0, 3);
    return {
      topic,
      count: hits.length,
      examples,
      requesters,
    };
  };

  const topRequests = [
    mkTopic('Narx / chegirma', /(narx|narh|qimmat|arzon|skidka|chegirma|%|price)/i),
    mkTopic('Buyurtma qilish', /(olaman|buyurtma|zakaz|qanday ol|qayerdan ol|how to order)/i),
    mkTopic('Yetkazib berish', /(yetkaz|dostav|delivery|kargo|qachon kel)/i),
    mkTopic("Razmer / o'lcham", /(razmer|size|o'lcham|olcham|s\s?m\s?l\s?xl)/i),
    mkTopic('Sifat / original', /(sifat|quality|original|kopiya)/i),
  ].filter((t) => t.count > 0);

  const hotLeads: Lead[] = reels
    .flatMap((r) => extractRegexPriceLeads(r, 50))
    .slice(0, 60);

  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0);

  const summary =
    topRequests.length > 0
      ? `Oxirgi ${reels.length} ta post commentlarida eng ko'p so'ralgan mavzular: ${topRequests
          .slice(0, 4)
          .map((t) => t.topic)
          .join(', ')}. Narx va buyurtma qilish bo'yicha savollar ko'p. Yetkazib berish va razmer ham tez-tez so'raladi. Bu savollarga post caption/pinned comment'da aniq javob berish DM yukini kamaytiradi.`
      : `Oxirgi ${reels.length} ta post bo'yicha commentlar kam yoki pattern topilmadi.`;

  const dmTemplate =
    `Assalomu alaykum! Qiziqishingiz uchun rahmat.\n` +
    `Narx: ____ so'm.\n` +
    `Yetkazib berish: ____ (shahar/kun).\n` +
    `Buyurtma uchun: model/razmer + ism + telefon + manzil yuboring — rasmiylashtirib beraman.`;

  return {
    accountUsername: username,
    totalPosts: reels.length,
    totalComments,
    summary,
    dmTemplate,
    topRequests,
    hotLeads,
  };
}
