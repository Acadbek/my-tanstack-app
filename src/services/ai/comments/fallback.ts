import type { Reel, MerchantCommentInsights, Lead } from '../../../config/schema';
import { extractRegexPriceLeads } from './utils.ts';

export function fallbackMerchantInsights(reel: Reel): MerchantCommentInsights {
  const texts = reel.comments.map((c) => c.text);

  const leads: Lead[] = extractRegexPriceLeads(reel, 30).map((l) => ({
    ...l,
    reason: "Narx/chegirma haqida so'radi",
  }));

  const mkGroup = (label: string, re: RegExp) => {
    const examples = texts.filter((t) => re.test(t)).slice(0, 3);
    return { label, count: examples.length, examples };
  };

  const groups = [
    mkGroup('Narx / chegirma', /(narx|qimmat|arzon|skidka|chegirma|%|sale)/i),
    mkGroup("Yetkazib berish", /(yetkaz|dostav|delivery|kargo|qachon kel)/i),
    mkGroup("Razmer / o'lcham", /(razmer|size|o'lcham|olcham|s m l xl)/i),
    mkGroup('Sifat / original', /(sifat|quality|original|kopiya)/i),
    mkGroup('Savol', /\?/),
  ].filter((g) => g.count > 0);

  const summary =
    groups.length > 0
      ? `Commentlar asosan quyidagilar atrofida: ${groups
          .slice(0, 3)
          .map((g) => g.label)
          .join(', ')}.`
      : "Commentlar bo'yicha aniq pattern topilmadi.";

  const merchantSummary =
    `- Narx bo'yicha savollar: ${leads.length}\n` +
    `- Eng ko'p mavzular: ${groups.slice(0, 4).map((g) => g.label).join(', ') || '—'}\n` +
    `- Tavsiya: Post caption yoki pinned comment'da narx, yetkazib berish va buyurtma qilish usulini aniq yozing.\n` +
    `- Tavsiya: Eng ko'p so'raladigan 1-2 variant narxini postda ko'rsating, DM'ni detallar uchun qoldiring.\n` +
    `- Tavsiya: DM javob scriptini qisqa + narx + yetkazib berish + to'lov + buyurtma yo'li ko'rinishida qiling.`;

  const dmTemplate =
    `Assalomu alaykum!\n` +
    `Mahsulot narxi: ____ so'm.\n` +
    `Yetkazib berish: ____ (shahar/kun).\n` +
    `Buyurtma uchun ism + telefon + manzil yuboring — rasmiylashtirib beraman.`;

  return {
    reelId: reel.id,
    totalComments: reel.comments.length,
    summary,
    merchantSummary,
    dmTemplate,
    priceLeads: leads,
    groups,
  };
}
