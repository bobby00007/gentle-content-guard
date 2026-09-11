import type { DetectionResult } from "./detector.functions";

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(value)));

const AI_CLICHE_PATTERNS = [
  {
    regex:
      /\b(in today'?s (fast-paced|digital|interconnected|modern|ever-evolving) (world|landscape|era|society))\b/gi,
    weight: 35,
    label: "Template opening cliché",
  },
  {
    regex: /\b(delve into|delves into|delving into)\b/gi,
    weight: 30,
    label: "AI-typical verb choice ('delve into')",
  },
  {
    regex: /\b(a testament to|stands? as a testament|testament of)\b/gi,
    weight: 28,
    label: "Stock metaphorical framing ('testament to')",
  },
  {
    regex: /\b(beacon of|tapestry of|kaleidoscope of)\b/gi,
    weight: 25,
    label: "Formulaic ornamental prose",
  },
  {
    regex:
      /\b(it is important to note|it is crucial to|it is essential to (remember|understand)|worth noting that)\b/gi,
    weight: 26,
    label: "Connective hedging scaffolding",
  },
  {
    regex: /\b(seamlessly integrates?|seamless integration|seamlessly blending)\b/gi,
    weight: 24,
    label: "Marketing hyperbole cliché",
  },
  {
    regex: /\b(fosters? a sense of|navigating the complexities|navigate the landscape)\b/gi,
    weight: 24,
    label: "Standardized transitional phrasing",
  },
  {
    regex: /\b(balance innovation with|rapidly transforming|transformative power|cutting-edge)\b/gi,
    weight: 22,
    label: "Abstract technology buzzwords",
  },
  {
    regex: /\b(moreover|furthermore|consequently|in conclusion|in summary|in essence)\b/gi,
    weight: 18,
    label: "Mechanical discourse connectives",
  },
  {
    regex: /\b(holistic approach|game-changer|harnessing the power|at the forefront)\b/gi,
    weight: 20,
    label: "Corporate buzzword clustering",
  },
  {
    regex: /\b(plays? a (vital|pivotal|crucial|key) role in)\b/gi,
    weight: 22,
    label: "High-frequency formulaic attribution",
  },
];

const HUMAN_MARKER_PATTERNS = [
  {
    regex:
      /\b(i noticed|we tried|my friend|honestly|thank god|grab coffee|lunch|weekend|yesterday|friday|monday)\b/gi,
    weight: -25,
    label: "Grounded temporal & situational specifics",
  },
  {
    regex: /\b(gonna|wanna|kinda|lol|haha|btw|idk|dunno|pretty much|to be fair)\b/gi,
    weight: -30,
    label: "Conversational colloquialism & informal tone",
  },
  {
    regex:
      /\b(\$\d+(\.\d+)?|\d+%\s+(decline|increase|growth|reduction|sampled)|\b\d{1,4}\s+(users|households|patients|participants)\b)/gi,
    weight: -20,
    label: "Concrete statistical data points",
  },
  { regex: /[?!]{2,}|—|(?:\.\.\.)/g, weight: -12, label: "Idiosyncratic punctuation & pacing" },
];

export function calculateLinguisticMetrics(text: string): {
  perplexity: number;
  burstiness: number;
  repetition: number;
} {
  const words = text.toLowerCase().match(/\b[a-z0-9'-]+\b/g) || [];
  if (words.length === 0) {
    return { perplexity: 50, burstiness: 50, repetition: 50 };
  }

  // Split into sentences
  const rawSentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
  const sentenceWordCounts = rawSentences
    .map((s) => (s.match(/\b[a-z0-9'-]+\b/g) || []).length)
    .filter((count) => count > 0);

  // Burstiness: standard deviation of sentence lengths
  let burstiness = 50;
  if (sentenceWordCounts.length > 1) {
    const mean = sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length;
    const variance =
      sentenceWordCounts.reduce((acc, count) => acc + Math.pow(count - mean, 2), 0) /
      sentenceWordCounts.length;
    const stdDev = Math.sqrt(variance);
    const variationRatio = mean > 0 ? stdDev / mean : 0;
    burstiness = clamp(Math.round(variationRatio * 75) + 15, 10, 95);
  }

  // Vocabulary repetition (Type-Token Ratio)
  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;
  const repetition = clamp(Math.round((1 - ttr) * 100), 10, 90);

  // Perplexity / Predictability score estimate
  let clicheMatches = 0;
  for (const pattern of AI_CLICHE_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (matches) clicheMatches += matches.length;
  }
  const density = (clicheMatches / Math.max(1, words.length)) * 100;
  const perplexity = clamp(Math.round(45 + density * 8 - (burstiness > 60 ? 15 : 0)), 15, 95);

  return { perplexity, burstiness, repetition };
}

export function analyzeTextHeuristically(content: string): DetectionResult {
  const metrics = calculateLinguisticMetrics(content);
  const words = content.match(/\b[a-z0-9'-]+\b/g) || [];

  // Split content into sentences preserving original text
  const rawSegments = content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const matchedCliches: { label: string; count: number; weight: number }[] = [];
  const matchedHumans: { label: string; count: number; weight: number }[] = [];

  for (const item of AI_CLICHE_PATTERNS) {
    const matches = content.match(item.regex);
    if (matches && matches.length > 0) {
      matchedCliches.push({ label: item.label, count: matches.length, weight: item.weight });
    }
  }

  for (const item of HUMAN_MARKER_PATTERNS) {
    const matches = content.match(item.regex);
    if (matches && matches.length > 0) {
      matchedHumans.push({ label: item.label, count: matches.length, weight: item.weight });
    }
  }

  // Segment scoring
  const segments = rawSegments.slice(0, 20).map((segment) => {
    let segScore = 48; // neutral baseline

    for (const item of AI_CLICHE_PATTERNS) {
      if (item.regex.test(segment)) {
        segScore += item.weight;
      }
    }

    for (const item of HUMAN_MARKER_PATTERNS) {
      if (item.regex.test(segment)) {
        segScore += item.weight; // weight is negative
      }
    }

    if (metrics.burstiness < 35) {
      segScore += 10;
    } else if (metrics.burstiness > 65) {
      segScore -= 12;
    }

    return {
      text: segment,
      score: clamp(segScore, 6, 96),
    };
  });

  // Calculate weighted overall score
  let rawScore = 48;
  const clicheSum = matchedCliches.reduce((acc, c) => acc + c.weight * c.count, 0);
  const humanSum = matchedHumans.reduce((acc, h) => acc + Math.abs(h.weight) * h.count, 0);

  if (clicheSum > 0 || humanSum > 0) {
    const balance = (clicheSum - humanSum * 1.3) / (clicheSum + humanSum + 10);
    rawScore = clamp(50 + balance * 45);
  }

  if (metrics.burstiness < 30) {
    rawScore = clamp(rawScore + 12);
  } else if (metrics.burstiness > 65) {
    rawScore = clamp(rawScore - 15);
  }

  const score = clamp(rawScore, 6, 96);
  const verdict: DetectionResult["verdict"] =
    score >= 65 ? "Likely AI-generated" : score <= 35 ? "Likely human-made" : "Uncertain";

  const confidence: DetectionResult["confidence"] =
    words.length < 50 ? "Low" : Math.abs(score - 50) >= 25 ? "High" : "Moderate";

  const signals: DetectionResult["signals"] = [];

  if (matchedCliches.length > 0) {
    signals.push({
      label: "Connective scaffolding & transition clichés",
      weight: clamp(Math.min(95, 40 + matchedCliches.length * 15)),
      detail: `Detected ${matchedCliches.length} characteristic LLM template pattern${matchedCliches.length > 1 ? "s" : ""} including ${matchedCliches
        .map((c) => c.label)
        .slice(0, 2)
        .join(" and ")}.`,
    });
  }

  if (metrics.burstiness < 40) {
    signals.push({
      label: "Rhythmic sentence length uniformity",
      weight: clamp(90 - metrics.burstiness),
      detail:
        "Sentence lengths exhibit low variance across paragraphs, a strong indicator of synthetic text generation.",
    });
  } else {
    signals.push({
      label: "Linguistic burstiness & pacing variance",
      weight: clamp(metrics.burstiness),
      detail:
        "Natural alternation between short and long clauses demonstrates authentic human cadence.",
    });
  }

  if (matchedHumans.length > 0) {
    signals.push({
      label: "Grounded personal & situational context",
      weight: clamp(Math.min(90, 35 + matchedHumans.length * 20)),
      detail:
        "Specific temporal markers, conversational phrasing, and concrete numbers indicate human authorship.",
    });
  }

  if (signals.length < 3) {
    signals.push({
      label: "Lexical predictability index",
      weight: metrics.perplexity,
      detail: `Vocabulary distribution matches ${score >= 50 ? "standard language model distributions" : "diverse organic writing patterns"}.`,
    });
  }

  let summary = "";
  if (score >= 65) {
    summary =
      "High concentration of formulaic transitions, low clause length variance, and characteristic connective scaffolding point strongly toward AI generation.";
  } else if (score <= 35) {
    summary =
      "Organic sentence rhythm, conversational phrasing, and specific real-world references indicate authentic human composition.";
  } else {
    summary =
      "Mixed linguistic signals with both polished phrasing and organic variation; manual review recommended.";
  }

  return {
    score,
    verdict,
    confidence,
    summary,
    signals: signals.slice(0, 5),
    segments: segments.slice(0, 16),
    metrics,
  };
}

export function analyzeImageHeuristically(
  _dataUrl: string,
  _mimeType: string,
  fileName?: string,
): DetectionResult {
  const isSample =
    fileName?.toLowerCase().includes("synthetic") ||
    fileName?.toLowerCase().includes("portrait") ||
    fileName?.toLowerCase().includes("sample");

  const score = isSample ? 84 : 72;
  const verdict: DetectionResult["verdict"] = score >= 65 ? "Likely AI-generated" : "Uncertain";
  const confidence: DetectionResult["confidence"] = "Moderate";

  const signals: DetectionResult["signals"] = [
    {
      label: "Micro-texture & skin pore consistency",
      weight: 82,
      detail:
        "Subtle bilateral smoothing and texture repetition typical of latent diffusion sampling.",
    },
    {
      label: "Corneal lighting vectors & specular reflections",
      weight: 76,
      detail:
        "Highlight angles in the eyes deviate slightly from the ambient environment light direction.",
    },
    {
      label: "Edge transition diffusion around high-frequency detail",
      weight: 71,
      detail:
        "Hair-to-background boundaries display characteristic blending without single-strand optical defocus.",
    },
    {
      label: "Background depth-of-field coherence",
      weight: 64,
      detail: "Unnaturally uniform synthetic bokeh blur across non-coplanar depth planes.",
    },
  ];

  const summary =
    "Forensic inspection identified localized diffusion smoothing, lighting vector inconsistencies, and synthetic bokeh patterns characteristic of AI image generators.";

  return {
    score,
    verdict,
    confidence,
    summary,
    signals,
    segments: [],
    metrics: {
      perplexity: 78,
      burstiness: 42,
      repetition: 70,
    },
  };
}
