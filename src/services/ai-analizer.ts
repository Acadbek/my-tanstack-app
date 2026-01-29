import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { getConfig } from '../config';
import {
  type Reel,
  type VideoAnalysis,
  type HookAnalysis,
  type AudienceInsight,
  type MerchantCommentInsights,
  MerchantCommentInsightsSchema,
  type AccountCommentDemand,
  AccountCommentDemandSchema,
  type Lead,
} from '../config/schema';


// ============================================
// AI Provider Abstraction
// ============================================

interface AIProvider {
  analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis>;
}

const buildAccountCommentDemandPrompt = (username: string, reels: Reel[]): string => {
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
    .slice(0, 300)

  const commentsBlock = flattened
    .map(
      (c, i) =>
        `${i + 1}. post=${c.postId} ${c.commentOwner ? `@${c.commentOwner}: ` : ''}${c.text}`,
    )
    .join('\n')

  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0)

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
`.trim()
}

function parseAccountCommentDemandResponse(
  response: string,
  accountUsername: string,
  totalPosts: number,
  totalComments: number,
): AccountCommentDemand {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    const preview = response.slice(0, 500)
    throw new Error(`Failed to parse account demand as JSON. Preview: ${preview}`)
  }

  const parsed = JSON.parse(jsonMatch[0])

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
  })
}

function fallbackAccountCommentDemand(username: string, reels: Reel[]): AccountCommentDemand {
  const all = reels.flatMap((r) => r.comments.map((c) => ({ postId: r.id, ...c })))
  const withUser = all.filter((c) => !!c.ownerUsername)

  const mkTopic = (topic: string, re: RegExp) => {
    const hits = withUser.filter((c) => re.test(c.text))
    const requesters = Array.from(new Set(hits.map((h) => h.ownerUsername!).filter(Boolean))).slice(0, 12)
    const examples = hits.map((h) => h.text).slice(0, 3)
    return {
      topic,
      count: hits.length,
      examples,
      requesters,
    }
  }

  const topRequests = [
    mkTopic('Narx / chegirma', /(narx|narh|qimmat|arzon|skidka|chegirma|%|price)/i),
    mkTopic('Buyurtma qilish', /(olaman|buyurtma|zakaz|qanday ol|qayerdan ol|how to order)/i),
    mkTopic('Yetkazib berish', /(yetkaz|dostav|delivery|kargo|qachon kel)/i),
    mkTopic('Razmer / o‘lcham', /(razmer|size|o'lcham|olcham|s\s?m\s?l\s?xl)/i),
    mkTopic('Sifat / original', /(sifat|quality|original|kopiya)/i),
  ].filter((t) => t.count > 0)

  const hotLeads: Lead[] = reels
    .flatMap((r) => extractRegexPriceLeads(r, 50))
    .slice(0, 60)

  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0)

  const summary =
    topRequests.length > 0
      ? `Oxirgi ${reels.length} ta post commentlarida eng ko‘p so‘ralgan mavzular: ${topRequests
          .slice(0, 4)
          .map((t) => t.topic)
          .join(', ')}. Narx va buyurtma qilish bo‘yicha savollar ko‘p. Yetkazib berish va razmer ham tez-tez so‘raladi. Bu savollarga post caption/pinned comment’da aniq javob berish DM yukini kamaytiradi.`
      : `Oxirgi ${reels.length} ta post bo‘yicha commentlar kam yoki pattern topilmadi.`

  const dmTemplate =
    `Assalomu alaykum! Qiziqishingiz uchun rahmat.\n` +
    `Narx: ____ so‘m.\n` +
    `Yetkazib berish: ____ (shahar/kun).\n` +
    `Buyurtma uchun: model/razmer + ism + telefon + manzil yuboring — rasmiylashtirib beraman.`

  return {
    accountUsername: username,
    totalPosts: reels.length,
    totalComments,
    summary,
    dmTemplate,
    topRequests,
    hotLeads,
  }
}

export const analyzeAccountCommentDemand = async (username: string, reels: Reel[]): Promise<AccountCommentDemand> => {
  const safeUsername = username.replace(/^@/, '').trim()
  const totalComments = reels.reduce((acc, r) => acc + (r.comments?.length ?? 0), 0)

  if (!safeUsername || reels.length === 0) {
    return {
      accountUsername: safeUsername || username,
      totalPosts: reels.length,
      totalComments,
      summary: 'Post topilmadi yoki username noto‘g‘ri.',
      dmTemplate:
        'Assalomu alaykum! Qiziqishingiz uchun rahmat. Narx va batafsil ma’lumot uchun qaysi mahsulot kerakligini yozib yuboring.',
      topRequests: [],
      hotLeads: [],
    }
  }

  const config = getConfig()
  const prompt = buildAccountCommentDemandPrompt(safeUsername, reels)

  try {
    if (config.aiProvider === 'openai') {
      console.log('[account-comments] provider=openai model=gpt-4o user=%s posts=%s comments=%s', safeUsername, reels.length, totalComments)
      const openai = new OpenAI({ apiKey: config.openaiApiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1400,
        temperature: 0.2,
      })
      const response = completion.choices[0]?.message?.content ?? ''
      return parseAccountCommentDemandResponse(response, safeUsername, reels.length, totalComments)
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey!)
    const modelName = config.geminiModel ?? (config.geminiModels?.[0] ?? 'gemini-3-pro-preview')
    console.log('[account-comments] provider=gemini model=%s user=%s posts=%s comments=%s', modelName, safeUsername, reels.length, totalComments)
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2 },
    })
    const result = await model.generateContent([{ text: prompt }])
    const response = result.response.text()
    return parseAccountCommentDemandResponse(response, safeUsername, reels.length, totalComments)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('[account-comments] fallback user=%s reason=%s', safeUsername, msg)
    return fallbackAccountCommentDemand(safeUsername, reels)
  }
}

interface InlineImage {
  data: string;
  mimeType: string;
}

function extractRegexPriceLeads(reel: Reel, limit = 50): Lead[] {
  return reel.comments
    .filter((c) => !!c.ownerUsername)
    .filter((c) => /(narx|narh|qimmat|arzon|orzon|nechpul|necpul|skidka|chegirma|%|nechchi|qancha|qanca|price|olsa|olaman|buyurtma)/i.test(c.text))
    .slice(0, limit)
    .map((c) => ({
      ownerUsername: c.ownerUsername!,
      commentText: c.text,
      reason: 'Regex: price/buy intent',
    }))
}

const buildMerchantCommentInsightsPrompt = (reel: Reel): string => {
  const comments = reel.comments.slice(0, 120)
  const commentsBlock = comments
    .map((c, i) => `${i + 1}. ${c.ownerUsername ? `@${c.ownerUsername}: ` : ''}${c.text}`)
    .join('\n')

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
`.trim()
}

function parseMerchantInsightsResponse(
  response: string,
  reelId: string,
  totalComments: number,
): MerchantCommentInsights {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    const preview = response.slice(0, 500)
    throw new Error(`Failed to parse merchant insights as JSON. Preview: ${preview}`)
  }

  const parsed = JSON.parse(jsonMatch[0])
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
  })
}

function fallbackMerchantInsights(reel: Reel): MerchantCommentInsights {
  const texts = reel.comments.map((c) => c.text)

  const leads: Lead[] = extractRegexPriceLeads(reel, 30).map((l) => ({
    ...l,
    reason: 'Narx/chegirma haqida so‘radi',
  }))

  const mkGroup = (label: string, re: RegExp) => {
    const examples = texts.filter((t) => re.test(t)).slice(0, 3)
    return { label, count: examples.length, examples }
  }

  const groups = [
    mkGroup('Narx / chegirma', /(narx|qimmat|arzon|skidka|chegirma|%|sale)/i),
    mkGroup('Yetkazib berish', /(yetkaz|dostav|delivery|kargo|qachon kel)/i),
    mkGroup('Razmer / o\'lcham', /(razmer|size|o\'lcham|olcham|s m l xl)/i),
    mkGroup('Sifat / original', /(sifat|quality|original|kopiya)/i),
    mkGroup('Savol', /\?/),
  ].filter((g) => g.count > 0)

  const summary =
    groups.length > 0
      ? `Commentlar asosan quyidagilar atrofida: ${groups
          .slice(0, 3)
          .map((g) => g.label)
          .join(', ')}.`
      : 'Commentlar bo‘yicha aniq pattern topilmadi.'

  const merchantSummary =
    `- Narx bo‘yicha savollar: ${leads.length}\n` +
    `- Eng ko‘p mavzular: ${groups
      .slice(0, 4)
      .map((g) => g.label)
      .join(', ') || '—'}\n` +
    `- Tavsiya: Post caption yoki pinned comment’da narx, yetkazib berish va buyurtma qilish usulini aniq yozing.\n` +
    `- Tavsiya: Eng ko‘p so‘raladigan 1-2 variant narxini postda ko‘rsating, DM’ni detallar uchun qoldiring.\n` +
    `- Tavsiya: DM javob scriptini qisqa + narx + yetkazib berish + to‘lov + buyurtma yo‘li ko‘rinishida qiling.`

  const dmTemplate =
    `Assalomu alaykum!\n` +
    `Mahsulot narxi: ____ so‘m.\n` +
    `Yetkazib berish: ____ (shahar/kun).\n` +
    `Buyurtma uchun ism + telefon + manzil yuboring — rasmiylashtirib beraman.`

  return {
    reelId: reel.id,
    totalComments: reel.comments.length,
    summary,
    merchantSummary,
    dmTemplate,
    priceLeads: leads,
    groups,
  }
}

export const analyzeComments = async (reel: Reel): Promise<MerchantCommentInsights> => {
  if (!reel.comments.length) {
    return {
      reelId: reel.id,
      totalComments: 0,
      summary: 'Comment topilmadi.',
      merchantSummary: 'Comment topilmadi.',
      dmTemplate: 'Assalomu alaykum! Narx va batafsil ma’lumot uchun DM qoldiring.',
      priceLeads: [],
      groups: [],
    }
  }

  const config = getConfig()
  const prompt = buildMerchantCommentInsightsPrompt(reel)
  const regexLeads = extractRegexPriceLeads(reel, 50)

  try {
    if (config.aiProvider === 'openai') {
      console.log('[comments] provider=openai model=gpt-4o reelId=%s comments=%s', reel.id, reel.comments.length)
      const openai = new OpenAI({ apiKey: config.openaiApiKey })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.2,
      })
      const response = completion.choices[0]?.message?.content ?? ''
      const ai = parseMerchantInsightsResponse(response, reel.id, reel.comments.length)
      const merged = [...(ai.priceLeads ?? []), ...regexLeads]
        .filter((l) => !!l.ownerUsername)
        .filter((l) => !!l.commentText)
      const deduped = Array.from(
        new Map(merged.map((l) => [`${l.ownerUsername}:${l.commentText}`, l])).values(),
      )
      return {
        ...ai,
        priceLeads: deduped,
      }
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey!)
    const modelName = config.geminiModel ?? (config.geminiModels?.[0] ?? 'gemini-3-pro-preview')
    console.log('[comments] provider=gemini model=%s reelId=%s comments=%s', modelName, reel.id, reel.comments.length)
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.2 },
    })
    const result = await model.generateContent([{ text: prompt }])
    const response = result.response.text()
    const ai = parseMerchantInsightsResponse(response, reel.id, reel.comments.length)
    const merged = [...(ai.priceLeads ?? []), ...regexLeads]
      .filter((l) => !!l.ownerUsername)
      .filter((l) => !!l.commentText)
    const deduped = Array.from(
      new Map(merged.map((l) => [`${l.ownerUsername}:${l.commentText}`, l])).values(),
    )
    return {
      ...ai,
      priceLeads: deduped,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('[comments] fallback reelId=%s reason=%s', reel.id, msg)
    return fallbackMerchantInsights(reel)
  }
}

// Prompt Templates
// ============================================

const buildAnalysisPrompt = (reel: Reel): string => `
You are an experienced Instagram Reels SMM/marketing analyst.

Task: Analyze this Instagram Reel and provide insights in SIMPLE UZBEK language (easy to understand, no marketing jargon).
Important: Response must be valid JSON only. Keep JSON keys unchanged, but all values must be in simple Uzbek.

**Reel data:**
- Username: @${reel.ownerUsername}
- Views: ${reel.viewsCount.toLocaleString()}
- Likes: ${reel.likesCount.toLocaleString()}
- Comments: ${reel.commentsCount.toLocaleString()}
- Duration: ${reel.duration ?? 'Unknown'} seconds
- Caption: "${reel.caption ?? 'No caption'}"

**Top audience comments:**
${reel.comments
  .slice(0, 10)
  .map((c, i) => `${i + 1}. "${c.text}" (${c.likesCount} likes)`)
  .join('\n')}

**Analysis requirements:**
1) **Hook (first 3 seconds):**
   - Which visual elements immediately grab attention?
   - Which audio/music elements create the hook?
   - Is there text overlay? If yes, what does it say?
   - What's the emotional trigger? (e.g., curiosity, fear, desire, humor, surprise)

2) **Main problem being solved:**
   - Which pain point or desire does the video address?
   - How is the solution presented?

3) **CTA (call to action):**
   - What does the creator want viewers to do?
   - Is it explicit or implicit?

4) **Content structure:**
   - Briefly describe the story structure (hook → problem → solution → CTA)

5) **Audience insights (from comments):**
   - What pain points are most common?
   - What questions are frequently asked?
   - What objections/doubts exist?
   - What desires/aspirations are expressed?

6) **Viral factors:**
   - List 3-5 specific factors (why it went viral)

7) **Remix suggestion:**
   - How can a brand adapt this format for their use?

Return response in the following JSON format (keep keys unchanged, values in simple Uzbek):
{
  "hook": {
    "visualElements": ["..."],
    "audioElements": ["..."],
    "textOverlay": "..." ,
    "emotionalTrigger": "...",
    "hookDuration": "0-3 soniya"
  },
  "problemSolved": "...",
  "callToAction": "...",
  "contentStructure": "...",
  "audienceInsights": {
    "painPoints": ["..."],
    "commonQuestions": ["..."],
    "objections": ["..."],
    "desires": ["..."]
  },
  "viralFactors": ["..."],
  "suggestedRemix": "..."
}
`;

const parseAIResponse = (response: string, reelId: string): VideoAnalysis => {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const preview = response.slice(0, 500);
    throw new Error(`Failed to parse AI response as JSON. Preview: ${preview}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    reelId,
    hook: {
      visualElements: parsed.hook?.visualElements ?? [],
      audioElements: parsed.hook?.audioElements ?? [],
      textOverlay: parsed.hook?.textOverlay,
      emotionalTrigger: parsed.hook?.emotionalTrigger ?? 'unknown',
      hookDuration: parsed.hook?.hookDuration ?? '0-3 seconds',
    } as HookAnalysis,
    problemSolved: parsed.problemSolved ?? 'Not identified',
    callToAction: parsed.callToAction,
    contentStructure: parsed.contentStructure ?? 'Not analyzed',
    audienceInsights: {
      painPoints: parsed.audienceInsights?.painPoints ?? [],
      commonQuestions: parsed.audienceInsights?.commonQuestions ?? [],
      objections: parsed.audienceInsights?.objections ?? [],
      desires: parsed.audienceInsights?.desires ?? [],
    } as AudienceInsight,
    viralFactors: parsed.viralFactors ?? [],
    suggestedRemix: parsed.suggestedRemix ?? 'No suggestion provided',
  };
};

const buildFallbackAnalysis = (reel: Reel): VideoAnalysis => {
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
      return 'Mos mahsulotni tanlash va narx/mavjudlik bo‘yicha aniqlik olish';
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
    viralFactors: ['Aniq taklif', 'Narxni anchoring qilish', 'To‘g‘ridan-to‘g‘ri CTA'],
    suggestedRemix:
      'Shu formatni qayta ishlating: boshida kuchli hook, keyin 1 ta asosiy foyda, narxni aniq ko‘rsatish va yakunda to‘g‘ridan-to‘g‘ri CTA.',
  };
};

// ============================================
// Gemini Provider
// ============================================

const createGeminiProvider = (): AIProvider => {
  const config = getConfig();
  const genAI = new GoogleGenerativeAI(config.geminiApiKey!);
  const getModel = (modelName: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
      },
    });

  return {
    async analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis> {
      const prompt = buildAnalysisPrompt(reel);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt },
      ];

      const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const safeThumbnail = thumbnail && supportedMimeTypes.has(thumbnail.mimeType) ? thumbnail : undefined;

      if (safeThumbnail) {
        parts.push({
          inlineData: {
            mimeType: safeThumbnail.mimeType,
            data: safeThumbnail.data,
          },
        });
      }

      const modelCandidates =
        (config.geminiModels && config.geminiModels.length > 0
          ? config.geminiModels
          : config.geminiModel
            ? [config.geminiModel]
            : [
                'gemini-3-flash-preview',
                'gemini-3-flash-image-preview',
              ]);

      let lastError: unknown;
      for (const modelName of modelCandidates) {
        const model = getModel(modelName);
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await model.generateContent(parts);
            const response = result.response.text();
            return parseAIResponse(response, reel.id);
          } catch (e) {
            lastError = e;
            await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
          }
        }
      }

      const lastMsg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Gemini generateContent failed for models: ${modelCandidates.join(', ')}. Last error: ${lastMsg}`
      );
    },
  };
};

// ============================================
// OpenAI Provider
// ============================================

const createOpenAIProvider = (): AIProvider => {
  const config = getConfig();
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  return {
    async analyzeVideo(reel: Reel, thumbnail?: InlineImage): Promise<VideoAnalysis> {
      const prompt = buildAnalysisPrompt(reel);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: thumbnail
            ? [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${thumbnail.mimeType};base64,${thumbnail.data}`,
                  },
                },
              ]
            : prompt,
        },
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 2000,
        temperature: 0.2,
      });

      const response = completion.choices[0]?.message?.content ?? '';
      return parseAIResponse(response, reel.id);
    },
  };
};

// ============================================
// Factory Function
// ============================================

export const createAIProvider = (): AIProvider => {
  const config = getConfig();

  if (config.aiProvider === 'gemini') {
    return createGeminiProvider();
  }

  return createOpenAIProvider();
};

// ============================================
// Thumbnail Fetching Utility
// ============================================

export const fetchThumbnailAsBase64 = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch {
    return undefined;
  }
};

export const fetchThumbnailInlineImage = async (url: string): Promise<InlineImage | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');

    return { data, mimeType };
  } catch {
    return undefined;
  }
};

// ============================================
// Batch Analysis Function
// ============================================

export interface AnalysisProgress {
  current: number;
  total: number;
  reelId: string;
}

export const analyzeReels = async (
  reels: Reel[],
  onProgress?: (progress: AnalysisProgress) => void
): Promise<VideoAnalysis[]> => {
  const provider = createAIProvider();
  const analyses: VideoAnalysis[] = [];

  for (let i = 0; i < reels.length; i++) {
    const reel = reels[i];

    onProgress?.({
      current: i + 1,
      total: reels.length,
      reelId: reel.id,
    });

    try {
      const thumbnail = reel.thumbnailUrl ? await fetchThumbnailInlineImage(reel.thumbnailUrl) : undefined;
      const analysis = await provider.analyzeVideo(reel, thumbnail);
      analyses.push(analysis);

      // Rate limiting delay between API calls
      if (i < reels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nFailed to analyze reel ${reel.id} (@${reel.ownerUsername}): ${msg}`);
      analyses.push(buildFallbackAnalysis(reel));
    }
  }

  return analyses;
};
