import type { Reel, VideoAnalysis, HookAnalysis, AudienceInsight } from '@/config/schema';

export function buildAnalysisPrompt(reel: Reel): string {
  return `
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
}

export function parseAIResponse(response: string, reelId: string): VideoAnalysis {
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
}
