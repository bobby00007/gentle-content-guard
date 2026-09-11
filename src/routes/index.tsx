import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  FileImage,
  FileText,
  Fingerprint,
  History as HistoryIcon,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Menu,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import sampleImage from "@/assets/detection-sample.jpg";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeContent, type DetectionResult } from "@/lib/detector.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hive | AI Content Detection & Media Intelligence" },
      {
        name: "description",
        content:
          "Detect AI-generated text and images with explainable forensic signals, sentence heatmaps, and calibrated confidence scores.",
      },
      { property: "og:title", content: "Hive | AI Content Detection" },
      {
        property: "og:description",
        content: "Analyze text and images for synthetic-content signals with clear explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = "text" | "image";

interface TextPreset {
  id: string;
  name: string;
  badge: string;
  tone: "signal" | "ink" | "warning";
  text: string;
}

const textPresets: TextPreset[] = [
  {
    id: "ai-essay",
    name: "AI Synthesis (GPT-style)",
    badge: "High AI",
    tone: "signal",
    text: "In today's fast-paced digital landscape, artificial intelligence is rapidly transforming the modern enterprise. By seamlessly integrating automated workflows and leveraging data-driven insights, organizations can unlock unprecedented levels of operational efficiency. However, it is crucial to thoughtfully balance technological innovation with ethical responsibility, ensuring transparency and human-centric governance across all strategic initiatives.",
  },
  {
    id: "human-memo",
    name: "Human Personal Log",
    badge: "Human",
    tone: "ink",
    text: "we tested the new build friday afternoon and honestly it broke twice before lunch. jamie's hotfix held up through the weekend though, thank god. going to grab some coffee and re-check the webhook queues before we let any more beta testers in.",
  },
  {
    id: "hybrid-draft",
    name: "Hybrid / AI-Polished",
    badge: "Mixed",
    tone: "warning",
    text: "Our customer churn dropped to 2.4% last month after we overhauled the onboarding checklist. Furthermore, the implementation of proactive engagement protocols has fostered stronger retention across mid-market accounts. We still need to fix the billing export bug before the end of the sprint.",
  },
  {
    id: "academic-study",
    name: "Academic Research",
    badge: "Formal",
    tone: "ink",
    text: "The longitudinal cohort study evaluated 1,420 randomized participants over an eighteen-month observation period. Primary clinical outcomes demonstrated a statistically significant reduction in serum markers (p < 0.001, 95% CI [0.14, 0.38]). Sensor calibration drifts were corrected using empirical Bayesian shrinkage estimators prior to cross-sectional regression analysis.",
  },
];

interface ScanHistoryItem {
  id: string;
  timestamp: string;
  mode: Mode;
  preview: string;
  score: number;
  verdict: string;
  result: DetectionResult;
  text?: string;
  imageName?: string;
}

function useReveal(dependency?: unknown) {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in-view)"));
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [dependency]);
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function Index() {
  const analyze = useServerFn(analyzeContent);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  useReveal(result);

  // Load scan history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hive_scan_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveHistoryItem = (item: ScanHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 8);
      try {
        localStorage.setItem("hive_scan_history", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("hive_scan_history");
    } catch {
      // Ignore storage errors
    }
  };

  const loadFromHistory = (item: ScanHistoryItem) => {
    setMode(item.mode);
    setResult(item.result);
    setError("");
    if (item.mode === "text" && item.text) {
      setText(item.text);
    }
    setHistoryOpen(false);
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setResult(null);
    setError("");
  };

  const readFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image must be smaller than 6 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImage({ dataUrl: reader.result, type: file.type, name: file.name });
      setResult(null);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const readTextFile = (file?: File) => {
    if (!file) return;
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".md") && !file.type.includes("text")) {
      setError("Please upload a .txt or .md plain text document.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Text document must be under 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setText(reader.result.slice(0, 12000));
        setResult(null);
        setError("");
      }
    };
    reader.readAsText(file);
  };

  const useSampleImage = async () => {
    const response = await fetch(sampleImage);
    const blob = await response.blob();
    readFile(new File([blob], "synthetic-portrait.jpg", { type: blob.type || "image/jpeg" }));
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 220));

  const runAnalysis = async () => {
    if (mode === "text" && text.trim().length < 80) {
      setError("Add at least 80 characters for a useful analysis.");
      return;
    }
    if (mode === "image" && !image) {
      setError("Upload an image or use the sample first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await analyze({
        data:
          mode === "text"
            ? { kind: "text", content: text.trim() }
            : {
                kind: "image",
                dataUrl: image?.dataUrl ?? "",
                mimeType: image?.type as "image/jpeg" | "image/png" | "image/webp",
              },
      });
      setResult(next);

      // Save to session history
      saveHistoryItem({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode,
        preview: mode === "text" ? text.slice(0, 50) + "…" : image?.name || "Image analysis",
        score: next.score,
        verdict: next.verdict,
        result: next,
        text: mode === "text" ? text : undefined,
        imageName: image?.name,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(
      `Hive analysis: ${result.score}% AI likelihood — ${result.verdict}. ${result.summary}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadReport = () => {
    if (!result) return;
    const lines = [
      `================================================================`,
      `HIVE AI CONTENT DETECTION — FORENSIC AUDIT REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      `Content Type: ${mode.toUpperCase()}`,
      `================================================================`,
      ``,
      `OVERALL ASSESSMENT:`,
      `AI Likelihood Score: ${result.score}%`,
      `Verdict:             ${result.verdict}`,
      `Confidence:          ${result.confidence}`,
      ``,
      `EXECUTIVE SUMMARY:`,
      `${result.summary}`,
      ``,
      result.metrics
        ? [
            `LINGUISTIC FORENSIC METRICS:`,
            `- Perplexity (Predictability):    ${result.metrics.perplexity} / 100`,
            `- Burstiness (Clause Variation):   ${result.metrics.burstiness} / 100`,
            `- Lexical Repetition:             ${result.metrics.repetition} / 100`,
            ``,
          ].join("\n")
        : "",
      `STRONGEST FORENSIC SIGNALS:`,
      ...result.signals.map(
        (s, idx) => `${idx + 1}. [Signal Weight: ${s.weight}%] ${s.label}\n   Detail: ${s.detail}`,
      ),
      ``,
      result.segments.length > 0
        ? [
            `SENTENCE-BY-SENTENCE RISK BREAKDOWN:`,
            ...result.segments.map(
              (seg, idx) => `[Sentence #${idx + 1} - ${seg.score}% AI Likelihood]\n"${seg.text}"`,
            ),
          ].join("\n\n")
        : "",
      ``,
      `================================================================`,
      `METHODOLOGY NOTICE:`,
      `Detection is probabilistic and intended to assist editorial or`,
      `forensic review. Scores should not be treated as definitive legal`,
      `proof of authorship without primary corroborating evidence.`,
      `================================================================`,
    ];

    const blob = new Blob([lines.filter(Boolean).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hive-forensic-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Hive home">
            <BrandMark />
            <span className="text-2xl font-bold tracking-tight">Hive</span>
          </a>
          <nav
            className="hidden items-center gap-8 text-sm font-medium lg:flex"
            aria-label="Main navigation"
          >
            <a className="nav-link" href="#detector">
              Detector <ChevronDown />
            </a>
            <a className="nav-link" href="#how">
              How it works
            </a>
            <a className="nav-link" href="#use-cases">
              Use cases
            </a>
            <a className="nav-link" href="#trust">
              Trust & Ethics
            </a>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 font-mono text-xs"
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <HistoryIcon className="h-3.5 w-3.5 text-signal" />
                History ({history.length})
              </Button>
            )}
            <Button variant="ghost" asChild>
              <a href="#trust">Trust center</a>
            </Button>
            <Button variant="ink" size="xl" asChild>
              <a href="#detector">
                Try detector <ArrowRight />
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            {history.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Toggle history"
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <HistoryIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav className="absolute inset-x-0 top-20 border-b border-border bg-background p-5 lg:hidden">
            {[
              ["Detector", "#detector"],
              ["How it works", "#how"],
              ["Use cases", "#use-cases"],
              ["Trust center", "#trust"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="block border-b border-border py-4 font-medium"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Slide-out Scan History Panel */}
      {historyOpen && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-signal" />
              <h3 className="font-semibold">Recent Scans</h3>
              <span className="font-mono text-xs text-muted-foreground">({history.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">
                No recent scans yet.
              </p>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadFromHistory(item)}
                  className="cursor-pointer border border-border p-3 transition-colors hover:border-signal hover:bg-surface"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-mono uppercase text-muted-foreground">
                      {item.mode} · {item.timestamp}
                    </span>
                    <span
                      className={`font-mono font-semibold ${item.score >= 65 ? "text-destructive" : item.score <= 35 ? "text-signal" : "text-amber-500"}`}
                    >
                      {item.score}% AI
                    </span>
                  </div>
                  <p className="text-xs font-medium line-clamp-2 text-foreground">{item.preview}</p>
                  <div className="mt-2 text-[11px] text-muted-foreground">{item.verdict}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="top" className="relative border-b border-border bg-ink text-ink-foreground">
        <div className="tech-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto grid min-h-[520px] max-w-[1440px] lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-between border-border p-6 py-12 lg:border-r lg:p-14 lg:py-16">
            <div>
              <div className="reveal in-view mb-8 flex items-center gap-2 text-xs font-semibold uppercase text-signal">
                <span className="h-2 w-2 animate-pulse rounded-full bg-signal shadow-[0_0_20px_var(--signal)]" />
                Synthetic media intelligence & forensics
              </div>
              <h1 className="reveal reveal-1 in-view max-w-3xl text-5xl font-semibold leading-[0.95] sm:text-6xl lg:text-7xl">
                Know what’s <span className="sheen-text">real.</span>
              </h1>
              <p className="reveal reveal-2 in-view mt-7 max-w-lg text-lg leading-8 text-ink-muted">
                Detect AI-generated text and images with clear confidence scores, sentence-level
                heatmaps, and evidence you can inspect.
              </p>
            </div>
            <div className="reveal reveal-3 in-view mt-12 flex flex-wrap gap-3">
              <Button variant="hero" size="xl" className="cta-shine lift" asChild>
                <a href="#detector">
                  Analyze content <ArrowRight />
                </a>
              </Button>
              <Button
                className="lift border-ink-line bg-transparent text-ink-foreground hover:bg-ink-surface"
                variant="outline"
                size="xl"
                asChild
              >
                <a href="#how">See how it works</a>
              </Button>
            </div>
          </div>
          <div className="relative hidden items-center justify-center p-12 lg:flex">
            <div className="scan-visual drift relative aspect-square w-full max-w-[560px]">
              <div className="absolute inset-[8%] border border-ink-line" />
              <div className="absolute inset-[18%] border border-ink-line" />
              <div className="absolute left-1/2 top-0 h-full border-l border-ink-line" />
              <div className="absolute left-0 top-1/2 w-full border-t border-ink-line" />
              <div className="pulse-ring absolute inset-[28%] rounded-full border border-signal/40" />
              <div className="absolute inset-[28%] grid place-items-center rounded-full border border-signal/40">
                <Fingerprint className="h-24 w-24 text-signal" strokeWidth={1} />
              </div>
              <span className="absolute left-[12%] top-[14%] font-mono text-xs text-ink-muted">
                SCAN_03 // FORENSICS
              </span>
              <span className="absolute bottom-[13%] right-[10%] font-mono text-xs text-signal">
                SIGNAL ACTIVE
              </span>
              <div className="scan-line absolute left-[8%] right-[8%] h-px bg-signal" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Detector Section */}
      <section id="detector" className="bg-surface py-16 lg:py-24">
        <div className="mx-auto max-w-[1240px] px-5">
          <div className="reveal mb-10 max-w-2xl">
            <p className="section-kicker">Free detection lab</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              Inspect content. Understand the signal.
            </h2>
            <p className="mt-4 text-muted-foreground">
              No account required. Your input is analyzed transiently and never stored or retained.
            </p>
          </div>

          <div className="reveal reveal-1 overflow-hidden border border-border bg-background shadow-editorial transition-shadow duration-500 hover:shadow-[16px_16px_0_0_var(--ink)]">
            <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-2 sm:px-6">
              <div className="flex" role="tablist" aria-label="Content type">
                <button
                  className={`mode-tab ${mode === "text" ? "active" : ""}`}
                  onClick={() => changeMode("text")}
                  role="tab"
                  aria-selected={mode === "text"}
                >
                  <TextCursorInput /> Text
                </button>
                <button
                  className={`mode-tab ${mode === "image" ? "active" : ""}`}
                  onClick={() => changeMode("image")}
                  role="tab"
                  aria-selected={mode === "image"}
                >
                  <ImageIcon /> Image
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="hidden items-center gap-2 sm:flex">
                  <ShieldCheck className="h-4 w-4 text-signal" /> Ephemeral session
                </span>
              </div>
            </div>

            <div className="grid min-h-[550px] lg:grid-cols-2">
              {/* Input Column */}
              <div className="flex min-w-0 flex-col border-border p-5 lg:border-r lg:p-8">
                {mode === "text" ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{wordCount} words</span>
                        <span>·</span>
                        <span className="font-mono">~{readingTime} min read</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono">{text.length.toLocaleString()} / 12,000</span>
                        {text.length > 0 && (
                          <button
                            onClick={() => {
                              setText("");
                              setResult(null);
                              setError("");
                            }}
                            className="flex items-center gap-1 hover:text-destructive text-muted-foreground transition-colors"
                            title="Clear text"
                          >
                            <RotateCcw className="h-3 w-3" /> Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e: DragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) readTextFile(e.dataTransfer.files[0]);
                      }}
                      className="relative flex-1 flex flex-col"
                    >
                      <Textarea
                        value={text}
                        maxLength={12000}
                        onChange={(event) => {
                          setText(event.target.value);
                          setResult(null);
                        }}
                        placeholder="Paste writing here to inspect language patterns, sentence rhythm, and predictability (or drop a .txt/.md file)…"
                        className="min-h-[290px] flex-1 resize-none rounded-none border-border bg-surface/60 p-5 text-base leading-7 shadow-none focus-visible:ring-signal"
                      />
                    </div>

                    {/* Presets Bar */}
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-muted-foreground">
                        <span>Preset samples to test:</span>
                        <button
                          onClick={() => textFileInputRef.current?.click()}
                          className="flex items-center gap-1 hover:text-foreground text-xs font-normal underline underline-offset-2"
                        >
                          <FileText className="h-3 w-3" /> Upload .txt / .md
                        </button>
                        <input
                          ref={textFileInputRef}
                          type="file"
                          accept=".txt,.md,text/plain"
                          className="hidden"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            readTextFile(e.target.files?.[0])
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {textPresets.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setText(preset.text);
                              setResult(null);
                              setError("");
                            }}
                            className="text-left border border-border p-2 text-xs hover:border-signal hover:bg-surface transition-all group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold truncate">{preset.name}</span>
                            </div>
                            <span className="text-[10px] font-mono px-1 py-0.5 bg-ink text-ink-foreground rounded">
                              {preset.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : image ? (
                  <div className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden bg-ink-surface">
                    <img
                      src={image.dataUrl}
                      alt="Content selected for AI analysis"
                      className="max-h-[450px] w-full object-contain"
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-3 top-3"
                      aria-label="Remove image"
                      onClick={() => {
                        setImage(null);
                        setResult(null);
                      }}
                    >
                      <X />
                    </Button>
                    <span className="absolute bottom-3 left-3 max-w-[80%] truncate bg-ink px-3 py-2 font-mono text-xs text-ink-foreground">
                      {image.name}
                    </span>
                  </div>
                ) : (
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event: DragEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      readFile(event.dataTransfer.files[0]);
                    }}
                    className="grid min-h-[360px] flex-1 place-items-center border border-dashed border-border bg-surface/60 p-8 text-center"
                  >
                    <div>
                      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-ink text-ink-foreground">
                        <Upload />
                      </div>
                      <h3 className="text-xl font-semibold">Drop an image to inspect</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        JPG, PNG or WebP · up to 6 MB
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button variant="ink" onClick={() => inputRef.current?.click()}>
                          <FileImage /> Choose image
                        </Button>
                        <Button variant="outline" onClick={useSampleImage}>
                          Use sample portrait
                        </Button>
                      </div>
                      <input
                        ref={inputRef}
                        className="hidden"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          readFile(event.target.files?.[0])
                        }
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p
                    className="mt-4 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <Button
                  variant="hero"
                  size="xl"
                  className="cta-shine mt-5 w-full transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
                  disabled={loading}
                  onClick={runAnalysis}
                >
                  {loading ? (
                    <>
                      <LoaderCircle className="animate-spin" /> Running forensic analysis…
                    </>
                  ) : (
                    <>
                      <ScanLine /> Analyze {mode}
                    </>
                  )}
                </Button>
              </div>

              {/* Result Column */}
              <div className="min-w-0 bg-result p-5 lg:p-8" aria-live="polite">
                {result ? (
                  <Results
                    result={result}
                    mode={mode}
                    copied={copied}
                    onCopy={copyResult}
                    onDownload={downloadReport}
                  />
                ) : loading ? (
                  <LoadingState mode={mode} />
                ) : (
                  <EmptyResult mode={mode} />
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Detection is probabilistic and should support—not replace—human review. Results indicate
            statistical likelihood, not definitive proof of authorship.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how" className="border-y border-border bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="reveal">
              <p className="section-kicker">Explainable by design</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                A score is only useful when you can question it.
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Hive pairs every estimate with visible patterns that shaped it: clause regularity,
                transition predictability, and token uniformity.
              </p>
            </div>
            <div className="grid border-l border-t border-border sm:grid-cols-2">
              {[
                [
                  Fingerprint,
                  "Pattern analysis",
                  "Examines linguistic regularity and visible image artifacts without relying on a single cue.",
                ],
                [
                  Sparkles,
                  "Evidence weighting",
                  "Ranks the strongest signals and shows how much each contributes to the assessment.",
                ],
                [
                  ScanLine,
                  "Section-level detail",
                  "Maps text likelihood sentence by sentence for fast review of mixed-origin writing.",
                ],
                [
                  ShieldCheck,
                  "Human judgment",
                  "Keeps uncertainty visible and avoids turning a model estimate into a false claim of proof.",
                ],
              ].map(([Icon, title, copy], index) => {
                const FeatureIcon = Icon as typeof Fingerprint;
                return (
                  <article
                    key={title as string}
                    className={`reveal reveal-${index + 1} card-hover group border-b border-r border-border p-7 lg:p-9`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                    <FeatureIcon
                      className="mt-10 h-8 w-8 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                      strokeWidth={1.5}
                    />
                    <h3 className="mt-6 text-xl font-semibold">{title as string}</h3>
                    <p className="mt-3 leading-7 text-muted-foreground">{copy as string}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="bg-signal py-20 text-signal-foreground lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <p className="section-kicker text-signal-foreground/60">Built for real decisions</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Protect the places where authenticity matters.
            </h2>
            <p className="max-w-md leading-7 text-signal-foreground/70">
              From editorial desks to marketplaces, get a consistent first-pass signal before
              escalating content for review.
            </p>
          </div>
          <div className="mt-14 grid border-l border-t border-signal-foreground/25 md:grid-cols-3">
            {[
              ["01", "Publishing", "Screen submitted copy and visual assets before publication."],
              [
                "02",
                "Education",
                "Review writing patterns with context rather than a binary accusation.",
              ],
              [
                "03",
                "Marketplaces",
                "Flag synthetic product imagery and misleading listings for review.",
              ],
              [
                "04",
                "Social platforms",
                "Prioritize suspicious content without hiding the confidence level.",
              ],
              [
                "05",
                "Recruiting",
                "Inspect high-volume applications for templated synthetic writing.",
              ],
              [
                "06",
                "Research",
                "Triage mixed datasets and document visible evidence for later review.",
              ],
            ].map(([number, title, copy], index) => (
              <article
                key={number}
                className={`reveal reveal-${(index % 5) + 1} min-h-56 border-b border-r border-signal-foreground/25 p-7 transition-colors duration-300 hover:bg-signal-foreground/10`}
              >
                <span className="font-mono text-xs opacity-60">{number}</span>
                <h3 className="mt-12 text-2xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 opacity-70">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Methodology Center */}
      <section id="trust" className="bg-ink py-20 text-ink-foreground lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end mb-16">
            <div className="reveal">
              <p className="section-kicker text-signal">Trust & Methodology Center</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                Test suspicious content before it tests your credibility.
              </h2>
            </div>
            <Button variant="hero" size="xl" className="cta-shine lift reveal reveal-2" asChild>
              <a href="#detector">
                Try the detector <ArrowRight />
              </a>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 pt-10 border-t border-ink-line">
            <div className="border border-ink-line bg-ink-surface p-6">
              <span className="font-mono text-xs text-signal">01 // PROBABILISTIC</span>
              <h4 className="mt-4 font-semibold text-lg">No False Certainty</h4>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                All assessments are calibrated probabilities. We reject binary verdicts because
                genuine human writing can sometimes resemble structured prose.
              </p>
            </div>
            <div className="border border-ink-line bg-ink-surface p-6">
              <span className="font-mono text-xs text-signal">02 // FAIRNESS</span>
              <h4 className="mt-4 font-semibold text-lg">Non-Native Protection</h4>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                Formality alone is never penalized. We test for burstiness and concrete referents to
                avoid misclassifying non-native English or academic writing.
              </p>
            </div>
            <div className="border border-ink-line bg-ink-surface p-6">
              <span className="font-mono text-xs text-signal">03 // PRIVACY</span>
              <h4 className="mt-4 font-semibold text-lg">Zero Retention</h4>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                Your submitted text and image data are processed strictly in ephemeral memory.
                Nothing is stored in databases, logged, or used for model training.
              </p>
            </div>
            <div className="border border-ink-line bg-ink-surface p-6">
              <span className="font-mono text-xs text-signal">04 // TRIANGULATION</span>
              <h4 className="mt-4 font-semibold text-lg">Multi-Pass Calibration</h4>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                Independent analysis passes evaluate candidates and counter-evidence, arriving at
                agreement-calibrated confidence intervals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-line bg-ink py-10 text-ink-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-xl font-bold">Hive</span>
            <span className="ml-3 text-xs text-ink-muted">© 2026</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-ink-muted">
            <a href="#detector" className="hover:text-ink-foreground transition-colors">
              Detector
            </a>
            <a href="#how" className="hover:text-ink-foreground transition-colors">
              Methodology
            </a>
            <a href="#trust" className="hover:text-ink-foreground transition-colors">
              Privacy
            </a>
            <a href="#trust" className="hover:text-ink-foreground transition-colors">
              Ethics
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function EmptyResult({ mode }: { mode: Mode }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center text-center">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-border bg-background">
          <ScanLine className="h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
        </div>
        <h3 className="mt-7 text-xl font-semibold">Your analysis will appear here</h3>
        <p className="mx-auto mt-3 max-w-sm leading-7 text-muted-foreground">
          {mode === "text"
            ? "We’ll show an overall score, sentence-level heatmap, and linguistic forensic indicators."
            : "We’ll inspect visible artifacts, composition, texture, and latent diffusion generation cues."}
        </p>
      </div>
    </div>
  );
}

function LoadingState({ mode }: { mode: Mode }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col justify-center">
      <div className="relative mx-auto h-28 w-28">
        <div className="absolute inset-0 animate-ping rounded-full border border-signal/40" />
        <div className="absolute inset-4 grid place-items-center rounded-full bg-ink text-signal">
          <Fingerprint className="h-10 w-10" />
        </div>
      </div>
      <h3 className="mt-8 text-center text-xl font-semibold">Inspecting {mode} signals</h3>
      <div className="mx-auto mt-7 w-full max-w-sm space-y-3">
        {[
          "Extracting syntactical patterns",
          "Analyzing clause burstiness & variance",
          "Triangulating forensic indicators",
        ].map((label, index) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "animate-pulse bg-signal" : "bg-border"}`}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Results({
  result,
  mode,
  copied,
  onCopy,
  onDownload,
}: {
  result: DetectionResult;
  mode: Mode;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const human = 100 - result.score;
  const animatedScore = useCountUp(result.score);
  const [segmentFilter, setSegmentFilter] = useState<"all" | "high" | "moderate" | "low">("all");

  const highSegments = result.segments.filter((s) => s.score >= 70);
  const modSegments = result.segments.filter((s) => s.score >= 40 && s.score < 70);
  const lowSegments = result.segments.filter((s) => s.score < 40);

  const displayedSegments =
    segmentFilter === "high"
      ? highSegments
      : segmentFilter === "moderate"
        ? modSegments
        : segmentFilter === "low"
          ? lowSegments
          : result.segments;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Analysis complete</p>
          <h3 className="mt-2 text-2xl font-semibold">{result.verdict}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="transition-transform duration-300 hover:scale-105"
            onClick={onDownload}
            title="Download audit report (.txt)"
            aria-label="Download audit report"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="transition-transform duration-300 hover:scale-105"
            onClick={onCopy}
            title="Copy summary"
            aria-label="Copy result"
          >
            {copied ? (
              <Check className="animate-in zoom-in duration-300 text-signal" />
            ) : (
              <Clipboard className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-[128px_1fr] items-center gap-6">
        <div
          className="score-ring transition-transform duration-500 hover:scale-105"
          style={{ "--score": `${animatedScore * 3.6}deg` } as CSSProperties}
        >
          <div>
            <strong>{animatedScore}%</strong>
            <span>AI likelihood</span>
          </div>
        </div>
        <div>
          <span className="inline-flex animate-in fade-in slide-in-from-left-2 bg-ink px-2.5 py-1 font-mono text-xs text-ink-foreground duration-700">
            {result.confidence} confidence
          </span>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
        </div>
      </div>

      {/* Forensic Metrics Grid */}
      {result.metrics && (
        <div className="mt-6 grid grid-cols-3 gap-2 border border-border bg-background p-3 text-center">
          <div>
            <span className="block font-mono text-[10px] uppercase text-muted-foreground">
              Perplexity
            </span>
            <span className="block font-mono text-base font-bold text-foreground">
              {result.metrics.perplexity}%
            </span>
            <span className="block text-[10px] text-muted-foreground">Predictability</span>
          </div>
          <div className="border-x border-border">
            <span className="block font-mono text-[10px] uppercase text-muted-foreground">
              Burstiness
            </span>
            <span className="block font-mono text-base font-bold text-foreground">
              {result.metrics.burstiness}%
            </span>
            <span className="block text-[10px] text-muted-foreground">Clause variation</span>
          </div>
          <div>
            <span className="block font-mono text-[10px] uppercase text-muted-foreground">
              Repetition
            </span>
            <span className="block font-mono text-base font-bold text-foreground">
              {result.metrics.repetition}%
            </span>
            <span className="block text-[10px] text-muted-foreground">Vocabulary reuse</span>
          </div>
        </div>
      )}

      {/* Distribution Bars */}
      <div className="mt-7 space-y-2">
        <Distribution label="AI-generated" value={result.score} tone="signal" />
        <Distribution label="Human-made" value={human} tone="ink" />
      </div>

      {/* Strongest Signals */}
      <div className="mt-8 border-t border-border pt-6">
        <h4 className="text-sm font-semibold uppercase tracking-wider">
          Strongest forensic signals
        </h4>
        <div className="mt-4 space-y-5">
          {result.signals.map((signal, index) => (
            <div
              key={signal.label}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${index * 90}ms`, animationFillMode: "backwards" }}
            >
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold">{signal.label}</span>
                <span className="font-mono text-xs">{signal.weight}%</span>
              </div>
              <div className="h-1.5 bg-border">
                <div
                  className="bar-grow h-full bg-signal"
                  style={{ width: `${signal.weight}%`, animationDelay: `${index * 90}ms` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Sentence Heatmap */}
      {mode === "text" && result.segments.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider">
              Sentence Risk Heatmap
            </h4>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <button
                onClick={() => setSegmentFilter("all")}
                className={`px-2 py-0.5 border ${segmentFilter === "all" ? "bg-ink text-ink-foreground border-ink" : "border-border text-muted-foreground"}`}
              >
                All ({result.segments.length})
              </button>
              <button
                onClick={() => setSegmentFilter("high")}
                className={`px-2 py-0.5 border ${segmentFilter === "high" ? "bg-signal text-ink border-signal font-semibold" : "border-border text-muted-foreground"}`}
              >
                High ({highSegments.length})
              </button>
              <button
                onClick={() => setSegmentFilter("moderate")}
                className={`px-2 py-0.5 border ${segmentFilter === "moderate" ? "bg-amber-500 text-ink border-amber-500 font-semibold" : "border-border text-muted-foreground"}`}
              >
                Mixed ({modSegments.length})
              </button>
              <button
                onClick={() => setSegmentFilter("low")}
                className={`px-2 py-0.5 border ${segmentFilter === "low" ? "bg-emerald-600 text-white border-emerald-600 font-semibold" : "border-border text-muted-foreground"}`}
              >
                Human ({lowSegments.length})
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-auto bg-background p-4 text-sm leading-7 border border-border">
            {displayedSegments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No sentences match this filter.
              </p>
            ) : (
              displayedSegments.map((segment, index) => (
                <span
                  key={`${index}-${segment.text.slice(0, 14)}`}
                  title={`${segment.score}% AI likelihood`}
                  className={`animate-in fade-in transition-colors duration-300 rounded px-1 py-0.5 inline-block mr-1 my-0.5 ${
                    segment.score >= 70
                      ? "bg-signal/50 text-foreground font-medium"
                      : segment.score >= 40
                        ? "bg-amber-400/30 text-foreground"
                        : "bg-emerald-500/15 text-foreground"
                  }`}
                  style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}
                >
                  {segment.text}{" "}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Distribution({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "signal" | "ink";
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-2 bg-border">
        <div
          className={`bar-grow h-full ${tone === "signal" ? "bg-signal" : "bg-ink"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
