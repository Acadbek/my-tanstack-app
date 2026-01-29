import {
  type Reel,
  type VideoAnalysis,
  type CreativeBrief,
} from '../config/schema';

// ============================================
// Types
// ============================================

interface PatternCount {
  pattern: string;
  count: number;
  examples: string[];
}

interface PainPointCount {
  painPoint: string;
  count: number;
  sourceReels: string[];
}

// ============================================
// Pattern Extraction Helpers
// ============================================

const extractHookPatterns = (analyses: VideoAnalysis[]): PatternCount[] => {
  const patternMap = new Map<string, { count: number; examples: string[] }>();

  analyses.forEach((analysis) => {
    const trigger = analysis.hook.emotionalTrigger.toLowerCase();

    if (!patternMap.has(trigger)) {
      patternMap.set(trigger, { count: 0, examples: [] });
    }

    const entry = patternMap.get(trigger)!;
    entry.count++;

    const example = analysis.hook.visualElements.slice(0, 2).join(' + ');
    if (example && entry.examples.length < 3) {
      entry.examples.push(example);
    }
  });

  return Array.from(patternMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);
};

const extractPainPoints = (analyses: VideoAnalysis[]): PainPointCount[] => {
  const painPointMap = new Map<string, { count: number; sourceReels: string[] }>();

  analyses.forEach((analysis) => {
    analysis.audienceInsights.painPoints.forEach((painPoint) => {
      const normalized = painPoint.toLowerCase().trim();

      if (!painPointMap.has(normalized)) {
        painPointMap.set(normalized, { count: 0, sourceReels: [] });
      }

      const entry = painPointMap.get(normalized)!;
      entry.count++;

      if (entry.sourceReels.length < 3) {
        entry.sourceReels.push(analysis.reelId);
      }
    });
  });

  return Array.from(painPointMap.entries())
    .map(([painPoint, data]) => ({
      painPoint,
      count: data.count,
      sourceReels: data.sourceReels,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

const extractTopFormats = (analyses: VideoAnalysis[]): string[] => {
  const formatCounts = new Map<string, number>();

  analyses.forEach((analysis) => {
    const format = analysis.contentStructure;
    formatCounts.set(format, (formatCounts.get(format) ?? 0) + 1);
  });

  return Array.from(formatCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([format]) => format);
};

const generateScriptConcepts = (
  analyses: VideoAnalysis[],
  reels: Reel[]
): CreativeBrief['scriptConcepts'] => {
  const topAnalyses = analyses
    .map((analysis, index) => ({ analysis, reel: reels[index] }))
    .filter(({ reel }) => reel)
    .sort((a, b) => (b.reel?.viewsCount ?? 0) - (a.reel?.viewsCount ?? 0))
    .slice(0, 3);

  return topAnalyses.map(({ analysis, reel }) => {
    const hookElements = analysis.hook.visualElements.join(', ');
    const trigger = analysis.hook.emotionalTrigger;

    return {
      title: `${trigger.charAt(0).toUpperCase() + trigger.slice(1)}-Driven ${analysis.problemSolved.split(' ').slice(0, 3).join(' ')} Video`,
      hook: `Open with ${hookElements}. Use ${trigger} to grab attention in first 2 seconds.`,
      body: analysis.contentStructure,
      cta: analysis.callToAction ?? 'Follow for more tips like this!',
      inspiredBy: `@${reel?.ownerUsername ?? 'unknown'} (${(reel?.viewsCount ?? 0).toLocaleString()} views)`,
    };
  });
};

const generateRecommendations = (analyses: VideoAnalysis[]): string[] => {
  const recommendations: string[] = [];

  if (analyses.length === 0) {
    return [
      'Hech qanday reels tahlil qilinmadi. Boshqa hashtag sinab ko‘ring, limitni oshiring yoki ko‘proq natija olish uchun pullik scraping’dan foydalaning.',
    ];
  }

  // Analyze hook patterns
  const hookPatterns = extractHookPatterns(analyses);
  if (hookPatterns.length > 0) {
    recommendations.push(
      `"${hookPatterns[0].pattern}" emotsional trigger’dan foydalaning — bu ${hookPatterns[0].count} ta eng yaxshi reelslarda uchradi`
    );
  }

  // Analyze visual elements
  const visualElements = analyses.flatMap((a) => a.hook.visualElements);
  const visualCounts = new Map<string, number>();
  visualElements.forEach((v) => {
    visualCounts.set(v.toLowerCase(), (visualCounts.get(v.toLowerCase()) ?? 0) + 1);
  });
  const topVisual = Array.from(visualCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topVisual) {
    recommendations.push(`Ilgakda "${topVisual[0]}" ni ishlating — viral kontentda ko‘p uchraydi`);
  }

  // Analyze CTAs
  const ctaCount = analyses.filter((a) => a.callToAction).length;
  const ctaPercentage = Math.round((ctaCount / analyses.length) * 100);
  recommendations.push(
    `Top reelslarning ${ctaPercentage}% ida aniq CTA bor — doim oxirida aniq harakatni so‘rang`
  );

  // Pain point recommendations
  const painPoints = extractPainPoints(analyses);
  if (painPoints.length > 0) {
    recommendations.push(
      `Auditoriyaning eng kuchli og‘riq nuqtalarini yopib bering: ${painPoints
        .slice(0, 3)
        .map((p) => `"${p.painPoint}"`)
        .join(', ')}`
    );
  }

  // Viral factors
  const allViralFactors = analyses.flatMap((a) => a.viralFactors);
  const factorCounts = new Map<string, number>();
  allViralFactors.forEach((f) => {
    factorCounts.set(f.toLowerCase(), (factorCounts.get(f.toLowerCase()) ?? 0) + 1);
  });
  const topFactors = Array.from(factorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topFactors.length > 0) {
    recommendations.push(
      `Qo‘shish kerak bo‘lgan viral omillar: ${topFactors.map(([f]) => f).join(', ')}`
    );
  }

  return recommendations;
};

// ============================================
// Main Brief Generation Function
// ============================================

export const generateCreativeBrief = (
  hashtag: string,
  reels: Reel[],
  analyses: VideoAnalysis[]
): CreativeBrief => {
  const hookPatterns = extractHookPatterns(analyses).map((p) => ({
    pattern: p.pattern,
    frequency: p.count,
    examples: p.examples,
  }));

  const audiencePainPoints = extractPainPoints(analyses).map((p) => ({
    painPoint: p.painPoint,
    frequency: p.count,
    sourceReels: p.sourceReels,
  }));

  const topPerformingFormats = extractTopFormats(analyses);
  const scriptConcepts = generateScriptConcepts(analyses, reels);
  const recommendations = generateRecommendations(analyses);

  return {
    generatedAt: new Date().toISOString(),
    hashtag,
    totalReelsAnalyzed: analyses.length,
    winningHookPatterns: hookPatterns,
    audiencePainPoints,
    topPerformingFormats,
    scriptConcepts,
    recommendations,
  };
};

// ============================================
// Markdown Export Function
// ============================================

export const briefToMarkdown = (brief: CreativeBrief, reels: Reel[]): string => {
  const lines: string[] = [];

  lines.push(`# Kreativ brif: #${brief.hashtag}`);
  lines.push('');
  lines.push(`**Yaratilgan:** ${new Date(brief.generatedAt).toLocaleString()}`);
  lines.push(`**Tahlil qilingan reels:** ${brief.totalReelsAnalyzed}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Winning Hook Patterns
  lines.push('## Yutuqli ilgak andozalari');
  lines.push('');
  lines.push('Quyidagi emotsional trigger’lar va vizual andozalar top kontentlarda doimiy ravishda uchraydi:');
  lines.push('');

  brief.winningHookPatterns.forEach((pattern, i) => {
    lines.push(
      `### ${i + 1}. ${pattern.pattern.charAt(0).toUpperCase() + pattern.pattern.slice(1)} (${pattern.frequency} ta reels)`
    );
    if (pattern.examples.length > 0) {
      lines.push('');
      lines.push('**Misollar:**');
      pattern.examples.forEach((ex) => {
        lines.push(`- ${ex}`);
      });
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // Audience Pain Points
  lines.push('## Auditoriya og‘riq nuqtalari');
  lines.push('');
  lines.push('Izohlar va caption’lar asosida auditoriya quyidagi muammolarga duch keladi:');
  lines.push('');

  brief.audiencePainPoints.forEach((pp, i) => {
    lines.push(`${i + 1}. **${pp.painPoint}** (${pp.frequency} marta tilga olingan)`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  // Top Performing Formats
  lines.push('## Eng yaxshi ishlagan kontent tuzilmalari');
  lines.push('');

  brief.topPerformingFormats.forEach((format, i) => {
    lines.push(`${i + 1}. ${format}`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  // Script Concepts
  lines.push('## Ssenariy g‘oyalari');
  lines.push('');
  lines.push('Yutuqli formatlarga asoslangan amaliy video g‘oyalari:');
  lines.push('');

  brief.scriptConcepts.forEach((concept, i) => {
    lines.push(`### G‘oya ${i + 1}: ${concept.title}`);
    lines.push('');
    lines.push(`**Ilgak:** ${concept.hook}`);
    lines.push('');
    lines.push(`**Asosiy qism:** ${concept.body}`);
    lines.push('');
    lines.push(`**CTA:** ${concept.cta}`);
    lines.push('');
    lines.push(`*Ilhom manbai: ${concept.inspiredBy}*`);
    lines.push('');
  });

  lines.push('---');
  lines.push('');

  // Recommendations
  lines.push('## Asosiy tavsiyalar');
  lines.push('');

  brief.recommendations.forEach((rec, i) => {
    lines.push(`${i + 1}. ${rec}`);
  });

  lines.push('');
  lines.push('---');
  lines.push('');

  // Source Reels Reference
  lines.push('## Tahlil qilingan reels ro‘yxati');
  lines.push('');
  lines.push('| # | Akkaunt | Ko‘rishlar | Layklar | Izohlar |');
  lines.push('|---|---------|-----------|--------|--------|');

  reels.forEach((reel, i) => {
    lines.push(
      `| ${i + 1} | @${reel.ownerUsername} | ${reel.viewsCount.toLocaleString()} | ${reel.likesCount.toLocaleString()} | ${reel.commentsCount.toLocaleString()} |`
    );
  });

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Instagram Reels Research Agent tomonidan yaratildi*');

  return lines.join('\n');
};
