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
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  Film,
  Fingerprint,
  History as HistoryIcon,
  Image as ImageIcon,
  Info,
  Layers,
  LoaderCircle,
  Menu,
  MessageSquare,
  Monitor,
  Play,
  RotateCcw,
  ScanLine,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

import sampleImage from "@/assets/detection-sample.jpg";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeContent,
  type AnalyzeContentInput,
  type DetectionResult,
} from "@/lib/detector.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hive Shield — WhatsApp Deepfake & Media Guard (DVPS14)" },
      {
        name: "description",
        content:
          "Detect deepfake videos, manipulated images, and viral fake news shared in family WhatsApp groups. Built for Hackathon Problem DVPS14.",
      },
      { property: "og:title", content: "Hive Shield | WhatsApp Deepfake Detection" },
      {
        property: "og:description",
        content:
          "Browser extension & web shield to detect deepfake videos and manipulated media in family WhatsApp groups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = "video" | "image" | "text" | "simulator";
type ViewLevel = "family" | "forensic";

interface VideoPreset {
  id: string;
  name: string;
  category: string;
  badge: string;
  tone: "danger" | "safe";
  duration: string;
  description: string;
}

const videoPresets: VideoPreset[] = [
  {
    id: "digital-arrest",
    name: "Police Digital Arrest Scam",
    category: "WhatsApp Video Call Extortion",
    badge: "95% Deepfake",
    tone: "danger",
    duration: "0:14",
    description:
      "Fake police officer demanding money on WhatsApp video call using real-time face reenactment.",
  },
  {
    id: "miracle-cure",
    name: "Celebrity Doctor Miracle Cure",
    category: "Health Misinformation",
    badge: "91% Deepfake",
    tone: "danger",
    duration: "0:22",
    description: "Face-swapped TV anchor promoting dangerous unverified diabetes cure forward.",
  },
  {
    id: "political-speech",
    name: "Morphed Public Figure Speech",
    category: "Political Deepfake",
    badge: "89% Deepfake",
    tone: "danger",
    duration: "0:18",
    description:
      "Fabricated audio and desynced mouth movements designed to spark community tension.",
  },
  {
    id: "authentic-news",
    name: "Authentic Broadcast & Family Clip",
    category: "Verified Genuine Media",
    badge: "14% Real",
    tone: "safe",
    duration: "0:12",
    description: "Natural camera sensor noise, organic eye blinking, and genuine phoneme sync.",
  },
];

interface ImagePreset {
  id: string;
  name: string;
  category: string;
  badge: string;
  tone: "danger" | "safe";
  description: string;
}

const imagePresets: ImagePreset[] = [
  {
    id: "flood-disaster",
    name: "AI Flood Crisis Image",
    category: "Disaster Panic Forward",
    badge: "93% Fake",
    tone: "danger",
    description: "Synthetic flood rescue image with Error Level Analysis (ELA) anomalies.",
  },
  {
    id: "synthetic-portrait",
    name: "AI Face Swap Portrait",
    category: "Impersonation",
    badge: "84% Fake",
    tone: "danger",
    description:
      "Latent diffusion face-swap with bilateral skin smoothing and specular eye reflection errors.",
  },
  {
    id: "family-photo",
    name: "Genuine Family Photograph",
    category: "Authentic Camera Photo",
    badge: "12% Real",
    tone: "safe",
    description: "Consistent Bayer pattern sensor noise and natural optical lens depth-of-field.",
  },
];

interface TextPreset {
  id: string;
  name: string;
  badge: string;
  tone: "danger" | "safe";
  text: string;
}

const textPresets: TextPreset[] = [
  {
    id: "viral-scam",
    name: "Urgent Police / CBI Summons Forward",
    badge: "Viral Scam",
    tone: "danger",
    text: "URGENT NOTICE: Ministry of Telecommunications & CBI cybercrime department has issued an immediate digital arrest warrant for your Aadhaar card. Join WhatsApp video call at link below immediately to avoid arrest and bank account seizure.",
  },
  {
    id: "miracle-remedy",
    name: "Fake Lemon & Aspirin Cancer Cure",
    badge: "Fake Remedy",
    tone: "danger",
    text: "WHO secret circular leaked! Boil 3 lemons with 2 spoons of baking soda every morning to destroy all cancer cells in 48 hours without chemotherapy. Forward this to all family groups immediately to save lives!",
  },
  {
    id: "human-memo",
    name: "Authentic Family Update",
    badge: "Genuine",
    tone: "safe",
    text: "Hey everyone! Uncle's train is delayed by an hour so we will reach the station around 6:30 PM. Please don't start dinner without us, mom packed the sweets from Varanasi. See you all soon!",
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
  videoName?: string;
}

interface VideoFrame {
  dataUrl: string;
  timestampSec: number;
}

async function extractVideoFrames(file: File): Promise<{
  durationSec: number;
  frames: VideoFrame[];
}> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("The video could not be decoded.")), {
        once: true,
      });
    });

    if (!Number.isFinite(video.duration) || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("The video has no readable frames.");
    }

    const durationSec = Math.min(video.duration, 86_400);
    const frameTimes = Array.from({ length: 6 }, (_, index) => {
      const ratio = (index + 1) / 7;
      return Math.max(0, Math.min(durationSec - 0.05, durationSec * ratio));
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 768 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser cannot create a video frame canvas.");

    const frames: VideoFrame[] = [];
    for (const timestampSec of frameTimes) {
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => resolve();
        const onError = () => reject(new Error("The video frame could not be read."));
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = timestampSec;
      });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        dataUrl: canvas.toDataURL("image/jpeg", 0.76),
        timestampSec: Math.round(timestampSec * 10) / 10,
      });
    }

    return { durationSec, frames };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const [mode, setMode] = useState<Mode>("video");
  const [viewLevel, setViewLevel] = useState<ViewLevel>("family");
  const [selectedVideoPreset, setSelectedVideoPreset] = useState<string>("digital-arrest");
  const [selectedImagePreset, setSelectedImagePreset] = useState<string>("synthetic-portrait");

  const [text, setText] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; type: string; name: string } | null>(null);
  const [videoFile, setVideoFile] = useState<{
    name: string;
    size: string;
    durationSec: number;
    frames: VideoFrame[];
  } | null>(null);
  const [videoPreparing, setVideoPreparing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  // WhatsApp Web Simulator State
  const [simStep, setSimStep] = useState<number>(0);
  const [simRebuttalSent, setSimRebuttalSent] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  useReveal(result);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hive_shield_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      // Ignore storage error
    }
  }, []);

  const saveHistory = (item: ScanHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 8);
      try {
        localStorage.setItem("hive_shield_history", JSON.stringify(next));
      } catch {
        // Ignore error
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("hive_shield_history");
    } catch {
      // Ignore
    }
  };

  const loadFromHistory = (item: ScanHistoryItem) => {
    setMode(item.mode);
    setResult(item.result);
    setError("");
    if (item.mode === "text" && item.text) setText(item.text);
    setHistoryOpen(false);
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setResult(null);
    setError("");
  };

  const readImageFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be smaller than 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImage({ dataUrl: reader.result, type: file.type, name: file.name });
      setSelectedImagePreset("");
      setResult(null);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const readVideoFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.includes("video") && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setError("Please upload an MP4, WebM, or MOV video file.");
      return;
    }
    setVideoPreparing(true);
    setError("Preparing representative frames for analysis…");
    try {
      const extracted = await extractVideoFrames(file);
      setVideoFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        ...extracted,
      });
      setSelectedVideoPreset("");
      setResult(null);
      setError("");
    } catch (caught) {
      setVideoFile(null);
      setError(caught instanceof Error ? caught.message : "The video could not be prepared.");
    } finally {
      setVideoPreparing(false);
    }
  };

  const readTextFile = (file?: File) => {
    if (!file) return;
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

  const runAnalysis = async () => {
    if (mode === "text" && text.trim().length < 40) {
      setError("Add at least 40 characters for WhatsApp forward analysis.");
      return;
    }
    if (mode === "image" && !image && !selectedImagePreset) {
      setError("Upload an image or pick a preset above.");
      return;
    }
    if (mode === "video" && videoPreparing) {
      setError("Please wait while the video frames are prepared.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      let payload: AnalyzeContentInput;

      if (mode === "video") {
        payload = {
          kind: "video",
          ...(selectedVideoPreset ? { presetId: selectedVideoPreset } : {}),
          ...(videoFile?.name ? { fileName: videoFile.name } : {}),
          durationSec: videoFile?.durationSec ?? 12,
          ...(videoFile?.frames ? { frames: videoFile.frames } : {}),
        };
      } else if (mode === "image") {
        payload = {
          kind: "image",
          dataUrl: image?.dataUrl ?? "",
          mimeType: (image?.type as "image/jpeg" | "image/png" | "image/webp") ?? "image/jpeg",
          fileName: image?.name,
          presetId: selectedImagePreset,
        };
      } else {
        payload = {
          kind: "text",
          content: text.trim(),
        };
      }

      const next = await analyze({ data: payload });
      setResult(next);

      // Save to history
      saveHistory({
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mode,
        preview:
          mode === "video"
            ? selectedVideoPreset
              ? videoPresets.find((p) => p.id === selectedVideoPreset)?.name || "Video Scan"
              : videoFile?.name || "Video Scan"
            : mode === "image"
              ? image?.name ||
                imagePresets.find((p) => p.id === selectedImagePreset)?.name ||
                "Image Scan"
              : text.slice(0, 50) + "…",
        score: next.score,
        verdict: next.verdict,
        result: next,
        ...(mode === "text" ? { text } : {}),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyRebuttal = async () => {
    if (!result?.rebuttal) return;
    await navigator.clipboard.writeText(result.rebuttal.politeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const shareToWhatsApp = (message: string) => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const downloadReport = () => {
    if (!result) return;
    const lines = [
      `================================================================`,
      `HIVE SHIELD — WHATSAPP DEEPFAKE VERIFICATION REPORT`,
      `Hackathon Problem Statement DVPS14 Solution`,
      `Generated: ${new Date().toLocaleString()}`,
      `Media Type: ${mode.toUpperCase()}`,
      `Scam Category: ${result.scamCategory || "General Media Review"}`,
      `================================================================`,
      ``,
      `OVERALL THREAT ASSESSMENT:`,
      `Deepfake / Manipulation Likelihood: ${result.score}%`,
      `Official Verdict:                   ${result.verdict}`,
      `Confidence Level:                   ${result.confidence}`,
      ``,
      `FAMILY ELDER ADVICE (PLAIN LANGUAGE):`,
      `${result.familyAdvice || result.summary}`,
      ``,
      `READY-TO-SHARE WHATSAPP REBUTTAL:`,
      `"${result.rebuttal?.politeText || ""}"`,
      ``,
      result.videoTimeline && result.videoTimeline.length > 0
        ? [
            `VIDEO FRAME-BY-FRAME RISK TIMELINE:`,
            ...result.videoTimeline.map(
              (f) => `[${f.label}] Risk: ${f.riskScore}% — ${f.flag || "Analyzed"}`,
            ),
            ``,
          ].join("\n")
        : "",
      `FORENSIC SIGNALS:`,
      ...result.signals.map(
        (s, idx) => `${idx + 1}. [Weight: ${s.weight}%] ${s.label}\n   ${s.detail}`,
      ),
      ``,
      `================================================================`,
      `DVPS14 Shield: Protecting family groups from automated deepfakes.`,
      `================================================================`,
    ];

    const blob = new Blob([lines.filter(Boolean).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hive-whatsapp-shield-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeVideoPresetData = videoPresets.find((p) => p.id === selectedVideoPreset);

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="relative z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Hive Shield Home">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-signal text-ink font-bold font-mono text-xl shadow-[0_0_15px_var(--signal)]">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-bold tracking-tight">Hive Shield</span>
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-signal uppercase tracking-wider">
                  DVPS14
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                WhatsApp Deepfake & Family Group Misinformation Shield
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            {/* Family vs Forensic Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                onClick={() => setViewLevel("family")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-all ${
                  viewLevel === "family"
                    ? "bg-signal text-ink font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>👨‍👩‍👧‍👦 Family View</span>
              </button>
              <button
                onClick={() => setViewLevel("forensic")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-medium transition-all ${
                  viewLevel === "forensic"
                    ? "bg-ink text-ink-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>🔬 Forensic View</span>
              </button>
            </div>

            {/* History Toggle */}
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="hidden font-mono text-xs md:flex items-center gap-1.5"
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <HistoryIcon className="h-3.5 w-3.5 text-signal" />
                History ({history.length})
              </Button>
            )}

            <Button variant="ink" size="sm" asChild className="hidden lg:flex">
              <a href="#extension">
                <Download className="h-3.5 w-3.5 mr-1" /> Get Extension
              </a>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-b border-border bg-background p-4 lg:hidden">
            <div className="flex flex-col gap-3">
              <a
                href="#detector"
                className="text-sm font-medium py-2"
                onClick={() => setMenuOpen(false)}
              >
                Deepfake Scanner
              </a>
              <a
                href="#simulator"
                className="text-sm font-medium py-2"
                onClick={() => setMenuOpen(false)}
              >
                WhatsApp Web Extension Demo
              </a>
              <a
                href="#extension"
                className="text-sm font-medium py-2"
                onClick={() => setMenuOpen(false)}
              >
                Download Browser Extension
              </a>
              <a
                href="#family-guide"
                className="text-sm font-medium py-2"
                onClick={() => setMenuOpen(false)}
              >
                Elderly Family Guide
              </a>
            </div>
          </div>
        )}
      </header>

      {/* History Slide-out */}
      {historyOpen && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-signal" />
              <h3 className="font-semibold">Recent Media Scans</h3>
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
            {history.map((item) => (
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
                    className={`font-mono font-bold ${item.score >= 65 ? "text-destructive" : item.score <= 35 ? "text-signal" : "text-amber-500"}`}
                  >
                    {item.score}% Risk
                  </span>
                </div>
                <p className="text-xs font-semibold line-clamp-2 text-foreground">{item.preview}</p>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{item.verdict}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section
        id="top"
        className="relative border-b border-border bg-ink text-ink-foreground py-14 lg:py-20"
      >
        <div className="tech-grid absolute inset-0 opacity-25" />
        <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-signal/40 bg-signal/10 px-3 py-1 text-xs font-semibold text-signal uppercase tracking-wider mb-6">
                <span className="h-2 w-2 animate-ping rounded-full bg-signal" />
                Problem Statement DVPS14 Solution
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.05]">
                Protect family WhatsApp groups from{" "}
                <span className="sheen-text">deepfake scams.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-ink-muted">
                Detect face-swap videos, manipulated crisis photos, and viral voice extortion before
                elders fall victim. Features real-time WhatsApp Web browser integration and polite
                1-click family rebuttal cards.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button variant="hero" size="xl" className="cta-shine lift font-semibold" asChild>
                  <a href="#detector">
                    <Video className="h-5 w-5 mr-2" /> Inspect Video / Media
                  </a>
                </Button>
                <Button
                  className="lift border-ink-line bg-transparent text-ink-foreground hover:bg-ink-surface"
                  variant="outline"
                  size="xl"
                  asChild
                >
                  <a href="#simulator">
                    <Monitor className="h-5 w-5 mr-2" /> WhatsApp Web Live Demo
                  </a>
                </Button>
              </div>

              {/* Hackathon Features Pill Strip */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-ink-muted">
                <div className="border border-ink-line bg-ink-surface/50 p-2.5 rounded">
                  <div className="text-signal font-bold">🎥 VIDEO DEEPFAKES</div>
                  Lip-sync & blink forensics
                </div>
                <div className="border border-ink-line bg-ink-surface/50 p-2.5 rounded">
                  <div className="text-signal font-bold">🖼️ ELA HEATMAPS</div>
                  Error level analysis
                </div>
                <div className="border border-ink-line bg-ink-surface/50 p-2.5 rounded">
                  <div className="text-signal font-bold">🧩 CHROME EXTENSION</div>
                  WhatsApp Web native badge
                </div>
                <div className="border border-ink-line bg-ink-surface/50 p-2.5 rounded">
                  <div className="text-signal font-bold">💬 1-CLICK DEBUNK</div>
                  Polite family card reply
                </div>
              </div>
            </div>

            {/* Visual Hero Feature Mockup */}
            <div className="relative mx-auto w-full max-w-[480px]">
              <div className="relative rounded-2xl border border-border/80 bg-[#111b21] p-4 shadow-2xl text-[#e9edef] font-sans">
                {/* Mock WhatsApp Chat Header */}
                <div className="flex items-center justify-between border-b border-[#222e35] pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-[#00a884] text-white font-bold text-sm">
                      👨‍👩‍👧‍👦
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Sharma Family Group (24)</div>
                      <div className="text-[11px] text-[#8696a0]">
                        Uncle Raj, Aunty Meera, Dad...
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-[#202c33] px-2 py-0.5 text-[10px] text-[#25d366] font-mono">
                    HIVE EXTENSION ACTIVE
                  </span>
                </div>

                {/* Incoming Video Message with Hive Shield Badge */}
                <div className="space-y-3">
                  <div className="rounded-lg bg-[#202c33] p-3 max-w-[90%]">
                    <div className="text-[11px] font-bold text-[#53bdeb] mb-1">Uncle Raj</div>
                    <div className="text-xs text-[#8696a0] mb-2">
                      Forwarded as received: Urgent Police Video Call!
                    </div>

                    <div className="relative aspect-video rounded-md bg-black/60 flex items-center justify-center overflow-hidden border border-[#2a3942]">
                      <div className="text-center p-3">
                        <div className="text-3xl mb-1">👮‍♂️</div>
                        <div className="text-xs font-semibold text-white">
                          Digital Arrest Police Extortion Call
                        </div>
                        <div className="text-[10px] text-gray-400">Duration: 0:14</div>
                      </div>

                      {/* Overlaid Extension Badge */}
                      <div className="absolute top-2 right-2 animate-bounce flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white shadow-lg">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>95% DEEPFAKE RISK</span>
                      </div>
                    </div>

                    <div className="mt-2 text-right text-[10px] text-[#8696a0]">10:42 AM ✓✓</div>
                  </div>

                  {/* Hive Rebuttal Sent Back Message */}
                  <div className="rounded-lg bg-[#005c4b] p-3 max-w-[92%] ml-auto text-white">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#25d366] mb-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Hive Verified Fact-Check Reply:
                    </div>
                    <p className="text-xs leading-relaxed">
                      "Dear Family 🙏, please DO NOT believe this video. Hive Shield analyzed it:
                      95% AI face-swap scam. Real police NEVER conduct video calls on WhatsApp to
                      arrest or ask for money!"
                    </p>
                    <div className="mt-1 text-right text-[10px] text-emerald-200">10:43 AM ✓✓</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Detector Section */}
      <section id="detector" className="bg-surface py-16 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
          <div className="reveal mb-10 max-w-3xl">
            <p className="section-kicker text-signal">DVPS14 Detection Lab</p>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Inspect WhatsApp Videos, Images & Forwards
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base">
              Analyze incoming WhatsApp files for synthetic facial reenactment, lip-sync mismatch,
              and image compression anomalies.
            </p>
          </div>

          <div className="reveal reveal-1 overflow-hidden border border-border bg-background shadow-editorial transition-shadow duration-500">
            {/* Mode Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-2 sm:px-6 bg-surface/40">
              <div className="flex flex-wrap gap-1 sm:gap-2" role="tablist">
                <button
                  className={`mode-tab flex items-center gap-2 ${mode === "video" ? "active" : ""}`}
                  onClick={() => changeMode("video")}
                  role="tab"
                >
                  <Video className="h-4 w-4" /> Video Deepfake
                </button>
                <button
                  className={`mode-tab flex items-center gap-2 ${mode === "image" ? "active" : ""}`}
                  onClick={() => changeMode("image")}
                  role="tab"
                >
                  <ImageIcon className="h-4 w-4" /> Manipulated Image
                </button>
                <button
                  className={`mode-tab flex items-center gap-2 ${mode === "text" ? "active" : ""}`}
                  onClick={() => changeMode("text")}
                  role="tab"
                >
                  <MessageSquare className="h-4 w-4" /> WhatsApp Text / Claim
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 sm:mt-0">
                <span className="hidden sm:inline-flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-signal" /> Transient Ephemeral Analysis
                </span>
              </div>
            </div>

            <div className="grid min-h-[580px] lg:grid-cols-2">
              {/* Input Column */}
              <div className="flex min-w-0 flex-col border-border p-5 lg:border-r lg:p-8">
                {/* VIDEO MODE */}
                {mode === "video" && (
                  <div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Select Common WhatsApp Viral Deepfake:
                        </span>
                        <button
                          onClick={() => videoInputRef.current?.click()}
                          className="text-xs text-signal underline underline-offset-2 flex items-center gap-1 font-semibold"
                        >
                          <Upload className="h-3 w-3" /> Upload Custom Video
                        </button>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          className="hidden"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            readVideoFile(e.target.files?.[0])
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {videoPresets.map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => {
                              setSelectedVideoPreset(preset.id);
                              setVideoFile(null);
                              setResult(null);
                              setError("");
                            }}
                            className={`cursor-pointer border p-3 rounded-lg transition-all ${
                              selectedVideoPreset === preset.id
                                ? "border-signal bg-signal/10 ring-1 ring-signal"
                                : "border-border hover:border-signal/50 hover:bg-surface"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs truncate">{preset.name}</span>
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  preset.tone === "danger"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-emerald-500/20 text-emerald-400"
                                }`}
                              >
                                {preset.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {preset.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active Video Player Mock / Preview */}
                    <div className="relative aspect-video rounded-xl bg-ink-surface border border-border overflow-hidden flex flex-col items-center justify-center p-6 text-center">
                      <div className="h-16 w-16 rounded-full bg-signal/20 border border-signal flex items-center justify-center mb-3">
                        <Play className="h-8 w-8 text-signal fill-signal ml-1" />
                      </div>
                      <div className="font-semibold text-sm text-ink-foreground">
                        {videoFile ? videoFile.name : activeVideoPresetData?.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Category: {videoFile ? "Uploaded Video" : activeVideoPresetData?.category} ·
                        Frame Rate: 30 fps
                      </div>

                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground bg-ink/70 px-3 py-1.5 rounded">
                        <span>AUDIO PHONEME SCANNER: ACTIVE</span>
                        <span>FACIAL MESH: TRACKING</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* IMAGE MODE */}
                {mode === "image" && (
                  <div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Select WhatsApp Viral Image Preset:
                        </span>
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="text-xs text-signal underline underline-offset-2 flex items-center gap-1 font-semibold"
                        >
                          <Upload className="h-3 w-3" /> Upload Photo
                        </button>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            readImageFile(e.target.files?.[0])
                          }
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {imagePresets.map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => {
                              setSelectedImagePreset(preset.id);
                              setImage(null);
                              setResult(null);
                              setError("");
                            }}
                            className={`cursor-pointer border p-2.5 rounded-lg transition-all ${
                              selectedImagePreset === preset.id
                                ? "border-signal bg-signal/10 ring-1 ring-signal"
                                : "border-border hover:border-signal/50 hover:bg-surface"
                            }`}
                          >
                            <div className="font-semibold text-xs truncate mb-1">{preset.name}</div>
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                preset.tone === "danger"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              {preset.badge}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {image ? (
                      <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-ink-surface rounded-xl border border-border">
                        <img
                          src={image.dataUrl}
                          alt="Selected media for detection"
                          className="max-h-[360px] w-full object-contain"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-3 top-3"
                          onClick={() => {
                            setImage(null);
                            setResult(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <span className="absolute bottom-3 left-3 bg-ink px-3 py-1 font-mono text-xs text-ink-foreground rounded">
                          {image.name}
                        </span>
                      </div>
                    ) : (
                      <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden bg-ink-surface rounded-xl border border-border p-4 text-center">
                        <div>
                          <img
                            src={sampleImage}
                            alt="Sample preset"
                            className="max-h-[240px] mx-auto object-contain rounded shadow"
                          />
                          <div className="mt-3 text-xs font-semibold text-ink-foreground">
                            {imagePresets.find((p) => p.id === selectedImagePreset)?.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {imagePresets.find((p) => p.id === selectedImagePreset)?.description}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TEXT MODE */}
                {mode === "text" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Common WhatsApp Forward Samples:
                      </span>
                      <button
                        onClick={() => textFileInputRef.current?.click()}
                        className="text-xs text-signal underline underline-offset-2 flex items-center gap-1 font-semibold"
                      >
                        <FileText className="h-3 w-3" /> Upload .txt
                      </button>
                      <input
                        ref={textFileInputRef}
                        type="file"
                        accept=".txt,.md"
                        className="hidden"
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          readTextFile(e.target.files?.[0])
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      {textPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setText(preset.text);
                            setResult(null);
                            setError("");
                          }}
                          className="text-left border border-border p-2 rounded text-xs hover:border-signal hover:bg-surface transition-all"
                        >
                          <div className="font-semibold truncate mb-1">{preset.name}</div>
                          <span
                            className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                              preset.tone === "danger"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-emerald-500/20 text-emerald-400"
                            }`}
                          >
                            {preset.badge}
                          </span>
                        </button>
                      ))}
                    </div>

                    <Textarea
                      value={text}
                      maxLength={12000}
                      onChange={(e) => {
                        setText(e.target.value);
                        setResult(null);
                      }}
                      placeholder="Paste forwarded WhatsApp text message here to inspect claims, linguistic predictability, and scam templates…"
                      className="min-h-[220px] rounded-lg border-border bg-surface/60 p-4 text-sm leading-6"
                    />
                  </div>
                )}

                {error && (
                  <p className="mt-4 border-l-2 border-destructive bg-destructive/10 px-4 py-3 text-xs text-destructive rounded">
                    {error}
                  </p>
                )}

                <Button
                  variant="hero"
                  size="xl"
                  className="cta-shine mt-6 w-full font-bold text-base transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  disabled={loading || videoPreparing}
                  onClick={runAnalysis}
                >
                  {videoPreparing ? (
                    <>
                      <LoaderCircle className="animate-spin mr-2" />
                      Preparing video frames…
                    </>
                  ) : loading ? (
                    <>
                      <LoaderCircle className="animate-spin mr-2" />
                      Analyzing Audio-Visual Forensics & Scams…
                    </>
                  ) : (
                    <>
                      <ScanLine className="mr-2" />
                      Run Forensic Deepfake Analysis
                    </>
                  )}
                </Button>
              </div>

              {/* Results Column */}
              <div className="min-w-0 bg-result p-5 lg:p-8" aria-live="polite">
                {result ? (
                  <ResultsView
                    result={result}
                    mode={mode}
                    viewLevel={viewLevel}
                    copied={copied}
                    onCopyRebuttal={copyRebuttal}
                    onShareWhatsApp={shareToWhatsApp}
                    onDownloadReport={downloadReport}
                  />
                ) : loading ? (
                  <LoadingState mode={mode} />
                ) : (
                  <EmptyResult mode={mode} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp Web Simulator Section */}
      <section id="simulator" className="border-y border-border bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10">
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 rounded bg-signal/20 px-2.5 py-1 text-xs font-bold text-signal uppercase tracking-wider mb-3">
              <Monitor className="h-3.5 w-3.5" /> Interactive WhatsApp Web Simulator
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              See How the Extension Protects WhatsApp Web
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base">
              Try the interactive simulation below. This demonstrates exactly how the{" "}
              <strong>Hive Browser Extension</strong> intercepts forwarded videos and provides an
              instant family rebuttal card.
            </p>
          </div>

          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-[#111b21] p-4 sm:p-6 shadow-2xl text-[#e9edef]">
            {/* WhatsApp Web Chat Top Bar */}
            <div className="flex items-center justify-between border-b border-[#222e35] pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884] text-white text-lg">
                  👨‍👩‍👦
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Family Group: "Sharma Family"</h4>
                  <p className="text-xs text-[#8696a0]">Uncle Raj, Dad, Aunty Meera, Sister...</p>
                </div>
              </div>
              <span className="rounded bg-[#202c33] border border-[#2a3942] px-2.5 py-1 text-xs text-[#25d366] font-mono">
                🟢 Extension Active
              </span>
            </div>

            {/* Chat Body */}
            <div className="space-y-4 py-2 min-h-[280px]">
              {/* Message 1 */}
              <div className="max-w-[85%] rounded-lg bg-[#202c33] p-3">
                <div className="text-xs font-bold text-[#53bdeb] mb-1">Uncle Raj</div>
                <div className="text-[11px] text-[#8696a0] mb-2 flex items-center gap-1">
                  <span>➡️ Forwarded: Urgent police notice!</span>
                </div>
                <div className="relative aspect-video rounded-lg bg-black/80 flex items-center justify-center border border-[#2a3942] overflow-hidden">
                  <div className="text-center p-3">
                    <div className="text-3xl mb-1">🚨👮‍♂️</div>
                    <div className="text-xs font-bold text-white">
                      Digital Arrest WhatsApp Video Call
                    </div>
                    <div className="text-[10px] text-gray-400">0:14 · 3.2 MB</div>
                  </div>

                  {/* Intercepted Extension Badge */}
                  <div
                    onClick={() => setSimStep(1)}
                    className="absolute top-2 right-2 cursor-pointer animate-pulse flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-xl hover:scale-105 transition-transform"
                    title="Click badge to inspect deepfake"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>⚠️ 95% Deepfake Risk (Click Me)</span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-[#8696a0] mt-1.5">10:45 AM</div>
              </div>

              {/* Step 1: Popover Simulation */}
              {simStep >= 1 && (
                <div className="max-w-[90%] mx-auto rounded-xl border border-red-500/50 bg-[#1c1d22] p-4 shadow-xl animate-in zoom-in duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                      <ShieldAlert className="h-4 w-4" /> Hive Shield Warning for Family
                    </div>
                    <button
                      onClick={() => setSimStep(0)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-200">
                    <strong>Notice:</strong> This video call is a computer-generated deepfake.
                    Police departments NEVER conduct WhatsApp video calls to arrest citizens or
                    demand bank transfers.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setSimRebuttalSent(true);
                        setSimStep(2);
                      }}
                      className="rounded bg-[#00a884] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#06cf9c] transition-colors"
                    >
                      💬 Send Rebuttal into Family Chat
                    </button>
                    <button
                      onClick={() => (window.location.href = "#detector")}
                      className="rounded border border-gray-600 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5"
                    >
                      View Full Forensics
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Sent Rebuttal */}
              {simRebuttalSent && (
                <div className="max-w-[90%] ml-auto rounded-lg bg-[#005c4b] p-3 text-white animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#25d366] mb-1">
                    <ShieldCheck className="h-4 w-4" /> You (via Hive Shield):
                  </div>
                  <p className="text-xs leading-relaxed">
                    "Dear Family 🙏, please do NOT forward this video. Hive Deepfake Shield verified
                    it as an AI face-swap scam (95% confidence). Real police NEVER demand money or
                    make video arrests on WhatsApp. Please stay safe!"
                  </p>
                  <div className="text-right text-[10px] text-emerald-200 mt-1">10:46 AM ✓✓</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Browser Extension Installation Guide Section */}
      <section id="extension" className="bg-ink py-20 text-ink-foreground lg:py-28">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10">
          <div className="max-w-3xl mb-14">
            <div className="inline-flex items-center gap-2 rounded bg-signal/20 px-2.5 py-1 text-xs font-bold text-signal uppercase tracking-wider mb-3">
              <Download className="h-3.5 w-3.5" /> Manifest V3 Browser Extension
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Install the Extension for Judges
            </h2>
            <p className="mt-3 text-ink-muted text-sm sm:text-base">
              The complete, unpackaged Chrome/Edge extension is located directly in the{" "}
              <code>extension/</code> folder of this repository.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="border border-ink-line bg-ink-surface p-6 rounded-xl">
              <div className="font-mono text-xs text-signal mb-2">STEP 01</div>
              <h4 className="font-bold text-lg mb-2">Enable Developer Mode</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Open <code>chrome://extensions/</code> in Chrome, Edge, or Brave, and toggle on{" "}
                <strong>"Developer mode"</strong> in the top-right corner.
              </p>
            </div>
            <div className="border border-ink-line bg-ink-surface p-6 rounded-xl">
              <div className="font-mono text-xs text-signal mb-2">STEP 02</div>
              <h4 className="font-bold text-lg mb-2">Load Unpacked Folder</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Click <strong>"Load unpacked"</strong> and select the <code>extension/</code>{" "}
                directory from the repository.
              </p>
            </div>
            <div className="border border-ink-line bg-ink-surface p-6 rounded-xl">
              <div className="font-mono text-xs text-signal mb-2">STEP 03</div>
              <h4 className="font-bold text-lg mb-2">Open WhatsApp Web</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Navigate to <code>web.whatsapp.com</code>. Incoming forwarded media will
                automatically show the Hive Shield warning badge!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-line bg-ink py-10 text-ink-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <span className="text-lg font-bold">Hive Shield</span>
              <span className="ml-2 text-xs text-ink-muted">· DVPS14 Hackathon Edition</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-ink-muted">
            <a href="#detector" className="hover:text-ink-foreground transition-colors">
              Detector
            </a>
            <a href="#simulator" className="hover:text-ink-foreground transition-colors">
              WhatsApp Web Demo
            </a>
            <a href="#extension" className="hover:text-ink-foreground transition-colors">
              Browser Extension
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function EmptyResult({ mode }: { mode: Mode }) {
  return (
    <div className="grid h-full min-h-[420px] place-items-center text-center">
      <div>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-border bg-background">
          <ScanLine className="h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
        </div>
        <h3 className="mt-7 text-xl font-semibold">Deepfake Analysis Ready</h3>
        <p className="mx-auto mt-3 max-w-sm leading-6 text-muted-foreground text-xs sm:text-sm">
          {mode === "video"
            ? "Select a WhatsApp viral deepfake preset or upload a video to inspect lip-sync, blinking cadence, and face warping."
            : mode === "image"
              ? "Inspect Error Level Analysis (ELA), synthetic bokeh, and latent diffusion facial seams."
              : "Paste a forwarded message to inspect automated template patterns and viral claims."}
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
      <h3 className="mt-8 text-center text-xl font-semibold">Running {mode} forensics</h3>
      <div className="mx-auto mt-7 w-full max-w-sm space-y-3">
        {[
          "Phoneme-viseme lip synchronization",
          "Biometric eyelid blink interval analysis",
          "Facial warping boundary inspection",
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

function ResultsView({
  result,
  mode,
  viewLevel,
  copied,
  onCopyRebuttal,
  onShareWhatsApp,
  onDownloadReport,
}: {
  result: DetectionResult;
  mode: Mode;
  viewLevel: ViewLevel;
  copied: boolean;
  onCopyRebuttal: () => void;
  onShareWhatsApp: (text: string) => void;
  onDownloadReport: () => void;
}) {
  const animatedScore = useCountUp(result.score);
  const isDangerous = result.score >= 65;
  const isSafe = result.score <= 35;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top Threat Banner */}
      <div
        className={`p-4 rounded-xl mb-6 flex items-start justify-between gap-3 border ${
          isDangerous
            ? "bg-red-500/15 border-red-500/40 text-red-400"
            : isSafe
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
              : "bg-amber-500/15 border-amber-500/40 text-amber-400"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl mt-0.5">{isDangerous ? "🚨" : isSafe ? "✅" : "⚠️"}</div>
          <div>
            <div className="font-bold text-base uppercase tracking-wide">
              {isDangerous
                ? "DANGEROUS DEEPFAKE (DO NOT FORWARD)"
                : isSafe
                  ? "LIKELY AUTHENTIC MEDIA"
                  : "SUSPICIOUS / MANIPULATED CONTENT"}
            </div>
            <p className="text-xs text-foreground/80 mt-1 font-medium">
              {result.scamCategory || result.verdict}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onDownloadReport}
          title="Download Audit Report"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Score & Summary */}
      <div className="grid grid-cols-[110px_1fr] items-center gap-5">
        <div
          className="score-ring transition-transform duration-500 hover:scale-105"
          style={{ "--score": `${animatedScore * 3.6}deg` } as CSSProperties}
        >
          <div>
            <strong className="text-xl">{animatedScore}%</strong>
            <span className="text-[10px]">Deepfake Risk</span>
          </div>
        </div>
        <div>
          <span className="inline-flex bg-ink px-2.5 py-1 font-mono text-xs text-ink-foreground rounded">
            {result.confidence} Confidence Verification
          </span>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        </div>
      </div>

      {/* FAMILY VIEW MODE (Simple & Practical for WhatsApp) */}
      {viewLevel === "family" && (
        <div className="mt-6 space-y-4">
          {/* Family Elder Advice Card */}
          <div className="rounded-xl border border-border bg-surface/80 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <span>👴👵 Plain-Language Advice for Elders</span>
            </h4>
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {result.familyAdvice || result.summary}
            </p>
          </div>

          {/* 1-Click WhatsApp Rebuttal Card */}
          {result.rebuttal && (
            <div className="rounded-xl border-2 border-[#00a884]/40 bg-[#111b21] p-4 text-[#e9edef]">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#25d366] uppercase tracking-wider">
                  <Share2 className="h-3.5 w-3.5" /> 1-Click WhatsApp Group Reply
                </span>
                <span className="text-[10px] text-[#8696a0]">Polite & Non-Confrontational</span>
              </div>

              <div className="rounded-lg bg-[#202c33] p-3 text-xs leading-relaxed text-[#d1d7db] border-l-3 border-[#00a884] mb-3">
                "{result.rebuttal.politeText}"
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onShareWhatsApp(result.rebuttal!.politeText)}
                  className="bg-[#00a884] hover:bg-[#06cf9c] text-black font-bold text-xs"
                >
                  <Share2 className="h-3.5 w-3.5 mr-1" /> Share to WhatsApp Group
                </Button>
                <Button variant="outline" size="sm" onClick={onCopyRebuttal} className="text-xs">
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-signal" /> Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3.5 w-3.5 mr-1" /> Copy Rebuttal Text
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORENSIC VIEW MODE (For Hackathon Judges & Tech Review) */}
      {viewLevel === "forensic" && (
        <div className="mt-6 space-y-6">
          {/* Video Timeline Heatmap (for videos) */}
          {result.videoTimeline && result.videoTimeline.length > 0 && (
            <div className="rounded-xl border border-border bg-surface/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-signal" /> Frame-by-Frame Deepfake Risk Timeline
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {result.videoTimeline.map((f, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-center border text-[10px] font-mono ${
                      f.riskScore >= 70
                        ? "bg-red-500/20 border-red-500/40 text-red-400"
                        : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    }`}
                    title={f.flag}
                  >
                    <div className="font-bold">{f.label}</div>
                    <div className="text-xs font-extrabold">{f.riskScore}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ELA Score (for images) */}
          {result.elaScore !== undefined && (
            <div className="rounded-xl border border-border bg-surface/50 p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Error Level Analysis (ELA) Compression Variance
                </span>
                <span className="font-mono text-xs font-bold">{result.elaScore}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full ${result.elaScore > 60 ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${result.elaScore}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                High compression gradient variance indicates localized digital splicing or AI
                generation.
              </p>
            </div>
          )}

          {/* Key Forensic Signals */}
          <div className="border-t border-border pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Strongest Forensic Signals
            </h4>
            <div className="space-y-3">
              {result.signals.map((signal) => (
                <div key={signal.label} className="text-xs">
                  <div className="flex justify-between font-semibold mb-1">
                    <span>{signal.label}</span>
                    <span className="font-mono">{signal.weight}%</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full ${signal.weight > 60 ? "bg-signal" : "bg-ink"}`}
                      style={{ width: `${signal.weight}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
