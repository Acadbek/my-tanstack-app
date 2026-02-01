/**
 * Fallback Analysis Builder
 * 
 * Creates fallback analysis when AI fails
 */

import type { Reel, VideoAnalysis } from '../../../config/schema';

export function buildFallbackAnalysis(reel: Reel): VideoAnalysis {
  const caption = (reel.caption ?? '').toLowerCase();
  const commentTexts = reel.comments.map((c) => c.text.toLowerCase());
  const allText = `${caption}\n${commentTexts.join('\n')}`;

  const emotionalTrigger = (() => {
    if (/(chegirma|aksiya|skidka|sale|%|arzon|super narx)/i.test(allText)) return 'urgency';
    if (/(qanday|nima|nega|qachon|\?)/i.test(allText)) return 'curiosity';
    if (/(😍|❤️|love|istayman|xohlayman|perfect)/i.test(allText)) return 'desire';
    if (/(😂|🤣|lol)/i.test(allText)) return 'humor';
    return 'curiosity';
  })();

  const callToAction = (() => {
    if (/(dm|direct|директ|telegram|tg|buyurtma|zakaz|yozin|yozing|comment|izoh)/i.test(allText)) {
      return 'DM / Comment to order';
    }
    return undefined;
  })();

  const problemSolved = (() => {
    if (/(sviter|kardigan|kofta|yubka|shim|futbolka|kurtka|libos|kiyim)/i.test(allText)) {
      return 'Mos mahsulotni tanlash va narx/mavjudlik bo\'yicha aniqlik olish';
    }
    return 'Taklifni tushunish va keyingi qadamni tanlash';
  })();

  const painPoints: string[] = [];
  if (/(narx|qimmat|arzon|skidka|chegirma)/i.test(allText)) painPoints.push('Price / discount sensitivity');
  if (/(yetkaz|dostav|delivery|kargo)/i.test(allText)) painPoints.push('Delivery time and shipping cost');
  if (/(razmer|size|o\'lcham|olcham)/i.test(allText)) painPoints.push('Sizing uncertainty');
  if (/(sifat|quality|original)/i.test(allText)) painPoints.push('Quality doubts');

  const commonQuestions = reel.comments
    .map((c) => c.text)
    .filter((t) => t.includes('?'))
    .slice(0, 5);

  return {
    reelId: reel.id,
    hook: {
      visualElements: [],
      audioElements: [],
      textOverlay: undefined,
      emotionalTrigger,
      hookDuration: '0-3 seconds',
    },
    problemSolved,
    callToAction,
    contentStructure: 'Hook → taklif/namoyish → narx/foyda → CTA',
    audienceInsights: {
      painPoints,
      commonQuestions,
      objections: [],
      desires: [],
    },
    viralFactors: ['Aniq taklif', 'Narxni anchoring qilish', 'To\'g\'ridan-to\'g\'ri CTA'],
    suggestedRemix:
      'Shu formatni qayta ishlating: boshida kuchli hook, keyin 1 ta asosiy foyda, narxni aniq ko\'rsatish va yakunda to\'g\'ridan-to\'g\'ri CTA.',
  };
}
