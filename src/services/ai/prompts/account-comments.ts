import type { Reel, AccountCommentDemand } from '@/config/schema';
import { AccountCommentDemandSchema } from '@/config/schema';

export function buildAccountCommentDemandPrompt(username: string, reels: Reel[]): string {
  const flattened = reels
    .flatMap((r) =>
      r.comments.map((c) => ({
        postId: r.id,
        postOwner: r.ownerUsername,
        commentOwner: c.ownerUsername,
        text: c.text,
      })),
    )
    .filter((c) => !!c.text)
    .slice(0, 300);

  const commentsBlock = flattened
    .map(
      (c, i) =>
        `${i + 1}. post=${c.postId} ${c.commentOwner ? `@${c.commentOwner}: ` : ''}${c.text}`,
    )
    .join('\n');

  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0);

  return `
You are a marketing analyst specializing in Instagram comment analysis for e-commerce businesses.

Task: Analyze all comments from the last ${reels.length} posts of @${username} account.

Context:
- Account: @${username}
- Number of posts: ${reels.length}
- Total comments (scraped): ${totalComments}

Comments (sample):
${commentsBlock}

Requirements:
1) "topRequests": Identify 5-10 most frequently requested topics by customers.
   For each topic: { topic (in simple Uzbek), count (approximate is fine), examples (2-3 examples in original language), requesters (3-10 usernames if available) }.
2) "hotLeads": Find comments showing strong purchase intent (asking about price, ordering, DM, where to buy).
   For each: { ownerUsername, commentText, reason (in simple Uzbek, no jargon) } (skip if no ownerUsername).
3) "summary": 4-8 sentence overall summary in SIMPLE UZBEK language (no marketing jargon, easy to understand).
4) "dmTemplate": Universal DM template in SIMPLE UZBEK addressing the most common requests (single string, conversational tone).
5) Response must be valid JSON only.

JSON format:
{
  "summary": "...",
  "dmTemplate": "...",
  "topRequests": [
    { "topic": "Narx", "count": 12, "examples": ["Narxi qancha?"], "requesters": ["user1"] }
  ],
  "hotLeads": [
    { "ownerUsername": "username", "commentText": "Narxi qancha?", "reason": "Narx so'radi" }
  ]
}
`.trim();
}

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

  return AccountCommentDemandSchema.parse({
    accountUsername,
    totalPosts,
    totalComments,
    summary: parsed.summary ?? 'Xulosa yo‘q.',
    dmTemplate:
      parsed.dmTemplate ??
      'Assalomu alaykum! Qiziqishingiz uchun rahmat. Narx, yetkazib berish va buyurtma qilish bo‘yicha batafsil ma’lumot beraman. Qaysi model/razmer kerakligini yozib yuboring.',
    topRequests: Array.isArray(parsed.topRequests) ? parsed.topRequests : [],
    hotLeads: Array.isArray(parsed.hotLeads) ? parsed.hotLeads : [],
  });
}
