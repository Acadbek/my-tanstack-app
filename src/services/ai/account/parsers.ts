import type { AccountCommentDemand } from '../../../config/schema';

export function parseAccountCommentDemandResponse(
  response: string,
  accountUsername: string,
  totalPosts: number,
  totalComments: number,
): AccountCommentDemand {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse account demand as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    accountUsername,
    totalPosts,
    totalComments,
    summary: parsed.summary ?? "Xulosa yo'q.",
    dmTemplate:
      parsed.dmTemplate ??
      "Assalomu alaykum! Qiziqishingiz uchun rahmat. Narx, yetkazib berish va buyurtma qilish bo'yicha batafsil ma'lumot beraman. Qaysi model/razmer kerakligini yozib yuboring.",
    topRequests: Array.isArray(parsed.topRequests) ? parsed.topRequests : [],
    hotLeads: Array.isArray(parsed.hotLeads) ? parsed.hotLeads : [],
  };
}
