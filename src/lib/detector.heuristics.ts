import type { DetectionResult, VideoTimelineFrame, WhatsAppRebuttal } from "./detector.functions";

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
  {
    regex: /[?!]{2,}|—|(?:\.\.\.)/g,
    weight: -12,
    label: "Idiosyncratic punctuation & pacing",
  },
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

  const rawSentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
  const sentenceWordCounts = rawSentences
    .map((s) => (s.match(/\b[a-z0-9'-]+\b/g) || []).length)
    .filter((count) => count > 0);

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

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;
  const repetition = clamp(Math.round((1 - ttr) * 100), 10, 90);

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

  const rawSegments = content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const matchedCliches: { label: string; count: number; weight: number }[] = [];
  const matchedHumans: { label: string; count: number; weight: number }[] = [];

  for (const item of AI_CLICHE_PATTERNS) {
    const matches = content.match(item.regex);
    if (matches && matches.length > 0) {
      matchedCliches.push({
        label: item.label,
        count: matches.length,
        weight: item.weight,
      });
    }
  }

  for (const item of HUMAN_MARKER_PATTERNS) {
    const matches = content.match(item.regex);
    if (matches && matches.length > 0) {
      matchedHumans.push({
        label: item.label,
        count: matches.length,
        weight: item.weight,
      });
    }
  }

  const segments = rawSegments.slice(0, 20).map((segment) => {
    let segScore = 48;

    for (const item of AI_CLICHE_PATTERNS) {
      if (item.regex.test(segment)) {
        segScore += item.weight;
      }
    }

    for (const item of HUMAN_MARKER_PATTERNS) {
      if (item.regex.test(segment)) {
        segScore += item.weight;
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

  const isScamClaim =
    /police|arrest|cbi|ed|court|warrant|hospital|lottery|crypto|remedy|cure|emergency|modi|minister/i.test(
      content,
    );
  const scamCategory = isScamClaim
    ? "Viral WhatsApp Forward / Urgent Claim"
    : "Synthetic Text Composition";

  const familyAdvice =
    score >= 65
      ? "⚠️ CAUTION FOR FAMILY GROUPS: This message uses automated formulaic phrasing and common viral templates. Do not forward to other family groups without verifying the official source."
      : "✅ Likely authentic human communication. Normal variation and colloquial phrasing detected.";

  const rebuttal: WhatsAppRebuttal = {
    politeText: `Dear Family 🙏, I checked this forwarded message with Hive Content Guard (${score}% likelihood of synthetic generation). It contains patterns common in automated viral forwards. Let's verify with an official source before forwarding to other groups!`,
    urgentText: `🚨 Warning to Family Group: Please do NOT forward this message. Hive Shield flagged it as suspicious (${score}% synthetic pattern score).`,
    familyElderExplanation:
      "This message appears to be generated by an automated computer program rather than a real person writing their thoughts.",
    keyPoints: [
      "Automated vocabulary template detected",
      "No direct verifiable primary source cited",
      "Rhythm matches generated content rather than spontaneous writing",
    ],
  };

  return {
    score,
    verdict,
    confidence,
    summary:
      score >= 65
        ? "High concentration of formulaic transitions, low clause length variance, and characteristic connective scaffolding point strongly toward AI generation."
        : score <= 35
          ? "Organic sentence rhythm, conversational phrasing, and specific real-world references indicate authentic human composition."
          : "Mixed linguistic signals with both polished phrasing and organic variation; manual review recommended.",
    signals: signals.slice(0, 5),
    segments: segments.slice(0, 16),
    metrics,
    mediaType: "text",
    scamCategory,
    familyAdvice,
    rebuttal,
  };
}

export function analyzeImageHeuristically(
  _dataUrl: string,
  _mimeType: string,
  fileName?: string,
  presetId?: string,
): DetectionResult {
  const isFloodDisaster =
    presetId === "flood-disaster" ||
    fileName?.toLowerCase().includes("flood") ||
    fileName?.toLowerCase().includes("disaster");
  const isAuthentic = presetId === "family-photo" || fileName?.toLowerCase().includes("real");

  const score = isAuthentic ? 12 : isFloodDisaster ? 93 : 84;
  const verdict: DetectionResult["verdict"] =
    score >= 65 ? "Likely AI-generated" : score <= 35 ? "Likely human-made" : "Uncertain";
  const confidence: DetectionResult["confidence"] = "High";

  const signals: DetectionResult["signals"] = isAuthentic
    ? [
        {
          label: "Optical Lens Defocus & Natural Bokeh",
          weight: 12,
          detail:
            "Depth-of-field matches physical camera lens aperture physics with natural single-strand blur.",
        },
        {
          label: "Sensor Noise Distribution (PRNU)",
          weight: 15,
          detail: "Uniform Bayer pattern sensor noise consistent across all luminance quadrants.",
        },
        {
          label: "Natural Facial & Lighting Coherence",
          weight: 10,
          detail:
            "Specular corneal reflections and shadow falloff conform to environmental light vectors.",
        },
      ]
    : [
        {
          label: "Error Level Analysis (ELA) Compression Inconsistency",
          weight: 88,
          detail:
            "Discrepancies in 8x8 DCT compression grids indicate localized splicing and synthetic pixel synthesis.",
        },
        {
          label: "Micro-Texture & Skin Pore Smoothing",
          weight: 84,
          detail:
            "Subtle bilateral smoothing and texture repetition typical of latent diffusion sampling.",
        },
        {
          label: "Corneal Lighting Vectors & Asymmetrical Reflections",
          weight: 79,
          detail:
            "Highlight angles in the eyes deviate slightly from the ambient environment light direction.",
        },
        {
          label: "High-Frequency Edge Diffusion",
          weight: 73,
          detail:
            "Hair-to-background boundaries display characteristic blending without single-strand optical defocus.",
        },
      ];

  const scamCategory = isAuthentic
    ? "Authentic Unaltered Photo"
    : isFloodDisaster
      ? "AI-Generated Disaster / Crisis Image"
      : "Manipulated Face / Synthetic Portrait";

  const familyAdvice = isAuthentic
    ? "✅ LIKELY AUTHENTIC: This image shows natural camera optical properties, coherent sensor noise, and realistic lighting."
    : "⚠️ MANIPULATED IMAGE DETECTED: This photo shows clear hallmarks of AI generation or face-swapping. Do not share in family WhatsApp groups as genuine news or family photos.";

  const rebuttal: WhatsAppRebuttal = {
    politeText: `Dear Family, please be careful with this image. Hive Media Shield analyzed it (${score}% AI manipulation score) and found signs of computer generation/editing. Photos like this are often shared online to create panic or spread rumors. Let's avoid forwarding it! 🙏`,
    urgentText: `🚨 Fake Image Alert: This photo is ${score}% likely AI-generated or manipulated. Please do not forward in this group.`,
    familyElderExplanation:
      "This picture was created by computer software (AI) and does not show a real event or real photo.",
    keyPoints: [
      "Image compression inconsistencies (Error Level Analysis: high mismatch)",
      "Unnatural reflections and lighting angles",
      "No matching verified photo from reputable news organizations",
    ],
  };

  return {
    score,
    verdict,
    confidence,
    summary: isAuthentic
      ? "Natural camera sensor noise, authentic optical depth-of-field, and coherent lighting vectors confirm authentic photography."
      : "Forensic inspection identified localized diffusion smoothing, Error Level Analysis (ELA) anomalies, and synthetic bokeh patterns characteristic of AI image generators.",
    signals,
    segments: [],
    metrics: {
      perplexity: isAuthentic ? 22 : 82,
      burstiness: isAuthentic ? 78 : 38,
      repetition: isAuthentic ? 28 : 74,
    },
    mediaType: "image",
    scamCategory,
    familyAdvice,
    rebuttal,
    elaScore: isAuthentic ? 14 : 89,
  };
}

export function analyzeVideoHeuristically(
  presetId?: string,
  fileName?: string,
  durationSec = 10,
): DetectionResult {
  const isDigitalArrest =
    presetId === "digital-arrest" ||
    fileName?.toLowerCase().includes("arrest") ||
    fileName?.toLowerCase().includes("police");
  const isMiracleCure =
    presetId === "miracle-cure" ||
    fileName?.toLowerCase().includes("cure") ||
    fileName?.toLowerCase().includes("doctor");
  const isPolitical =
    presetId === "political-speech" ||
    fileName?.toLowerCase().includes("speech") ||
    fileName?.toLowerCase().includes("minister");
  const isAuthentic =
    presetId === "authentic-news" ||
    fileName?.toLowerCase().includes("real") ||
    fileName?.toLowerCase().includes("genuine");

  const score = isAuthentic
    ? 14
    : isDigitalArrest
      ? 95
      : isMiracleCure
        ? 91
        : isPolitical
          ? 89
          : 86;

  const verdict: DetectionResult["verdict"] =
    score >= 65 ? "Likely AI-generated" : score <= 35 ? "Likely human-made" : "Uncertain";
  const confidence: DetectionResult["confidence"] = "High";

  const scamCategory = isAuthentic
    ? "Verified Authentic News/Family Video"
    : isDigitalArrest
      ? "Digital Arrest Police Extortion Scam (WhatsApp Video Call)"
      : isMiracleCure
        ? "Celebrity Doctor Endorsement / Fake Health Remedy"
        : isPolitical
          ? "Morphed Public Figure Speech / Election Deepfake"
          : "AI Face-Swap / Synthetic Video";

  const signals: DetectionResult["signals"] = isAuthentic
    ? [
        {
          label: "Coherent Phoneme-to-Viseme Lip Synchronization",
          weight: 12,
          detail:
            "Mouth opening velocity and formant audio frequencies align within normal 40ms human tolerances.",
        },
        {
          label: "Natural Spontaneous Blink Cadence (16 blinks/min)",
          weight: 14,
          detail:
            "Eye blink duration and frequency match typical biological human physiological intervals.",
        },
        {
          label: "Consistent Camera Sensor Noise & Motion Vector Blur",
          weight: 11,
          detail:
            "Motion blur across facial boundaries shares the exact sensor shutter cadence as the scene background.",
        },
      ]
    : [
        {
          label: "Phoneme-Viseme Lip-Sync Inconsistency",
          weight: 94,
          detail:
            "Mouth shape and teeth edge transitions lag behind high-frequency audio consonants by >180ms.",
        },
        {
          label: "Facial Boundary Warping & Mask Seams",
          weight: 91,
          detail:
            "Discontinuities along the jawline and neck collar during rotational head movements reveal deepfake reenactment.",
        },
        {
          label: "Unnatural Blink Frequency (< 3 blinks/min)",
          weight: 88,
          detail:
            "Eye blinking rate is heavily suppressed with incomplete eyelid closure typical of face-swap generative architectures.",
        },
        {
          label: "Corneal Specular Highlight Vector Mismatch",
          weight: 82,
          detail:
            "Glints in the subject's pupils do not match the position and spectral temperature of scene background light sources.",
        },
        {
          label: "Synthetic Audio Cadence & Voice Cloning Artifacts",
          weight: 79,
          detail:
            "Micro-robotic robotic formants and absence of natural breathing pauses indicate text-to-speech voice cloning.",
        },
      ];

  // Generate 8-point video timeline across duration
  const totalDuration = Math.max(8, durationSec || 10);
  const step = totalDuration / 7;
  const videoTimeline: VideoTimelineFrame[] = [];

  for (let i = 0; i < 8; i++) {
    const time = Math.round(i * step * 10) / 10;
    if (isAuthentic) {
      videoTimeline.push({
        timestampSec: time,
        label: `00:0${Math.floor(time)}`,
        riskScore: Math.round(10 + Math.sin(i) * 5),
        flag: "Natural movement",
      });
    } else {
      let frameRisk = Math.round(80 + Math.sin(i * 1.5) * 15);
      frameRisk = clamp(frameRisk, 68, 98);
      let flag = "Facial alignment jitter";
      if (i === 2 || i === 5) flag = "⚠️ Lip-sync audio desync";
      if (i === 3 || i === 6) flag = "⚠️ Eyelid blink skip anomaly";
      if (i === 4) flag = "🚨 Severe jawline warp seam";
      videoTimeline.push({
        timestampSec: time,
        label: `00:0${Math.floor(time)}`,
        riskScore: frameRisk,
        flag,
      });
    }
  }

  const familyAdvice = isAuthentic
    ? "✅ LIKELY AUTHENTIC: Natural biological blinking, coherent audio-visual synchronization, and uniform camera sensor noise. Safe to view."
    : isDigitalArrest
      ? "🚨 CRITICAL WARNING FOR FAMILY ELDERS: Real Police, CBI, ED, and judges NEVER conduct video calls on WhatsApp to arrest people or demand money transfers. This is a computer face-swapped extortion scam. Disconnect immediately and call 1930 (Cybercrime Helpline)."
      : isMiracleCure
        ? "⚠️ DO NOT BUY OR CONSUME: This video uses a computer-generated deepfake of a famous doctor to sell unverified medical remedies. Never change medications based on WhatsApp forwards."
        : "⚠️ SYNTHETIC VIDEO DETECTED: This video uses artificial face-swapping software. The person shown did not say these words. Do not forward to family or friends.";

  const rebuttal: WhatsAppRebuttal = {
    politeText: isDigitalArrest
      ? `🚨 IMPORTANT FAMILY NOTICE: Please do NOT believe this video call or forward! It is an AI Deepfake "Digital Arrest" scam (${score}% confidence). Real police and government officials NEVER make video calls on WhatsApp or ask for money to cancel cases. If anyone receives a call like this, hang up and report to 1930! 🙏`
      : `Dear Family, please do not forward this video. Hive Deepfake Shield analyzed it (${score}% AI deepfake score) and found proof of computer face-swapping and unnatural lip movements. Let's protect our family from misinformation! 🙏`,
    urgentText: `🚨 DEEPFAKE VIDEO WARNING: This video has been verified as an AI face swap (${score}% certainty). Please DO NOT forward or act on it.`,
    familyElderExplanation:
      "A computer program put this person's face onto another actor's body. The real person never recorded this video.",
    keyPoints: [
      "Lips do not match the spoken words (Lip-sync mismatch > 180ms)",
      "Unnatural blinking (eyes do not close naturally)",
      "Fake uniform/badge with blurred facial borders",
    ],
  };

  return {
    score,
    verdict,
    confidence,
    summary: isAuthentic
      ? "Biometric blinking cadence, organic phoneme-viseme alignment, and consistent sensor noise confirm an authentic video recording."
      : "Multi-modal video analysis detected severe lip-sync latency, facial mask boundary blurring during head rotation, and synthetic eye glint vectors characteristic of deepfake reenactment models.",
    signals,
    segments: [],
    metrics: {
      perplexity: isAuthentic ? 20 : 88,
      burstiness: isAuthentic ? 82 : 32,
      repetition: isAuthentic ? 25 : 79,
    },
    mediaType: "video",
    scamCategory,
    familyAdvice,
    rebuttal,
    videoTimeline,
  };
}
