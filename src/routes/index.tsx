import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  FileImage,
  Fingerprint,
  Image as ImageIcon,
  LoaderCircle,
  Menu,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TextCursorInput,
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
      { title: "Hive | AI Content Detection" },
      {
        name: "description",
        content:
          "Detect AI-generated text and images with confidence scoring and explainable forensic signals.",
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

const sampleText =
  "Artificial intelligence is rapidly transforming the modern workplace. By automating repetitive tasks and analyzing large volumes of information, AI enables teams to make faster, more informed decisions. However, organizations must thoughtfully balance innovation with transparency, accountability, and human oversight.";

type Mode = "text" | "image";

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
  const inputRef = useRef<HTMLInputElement>(null);

  useReveal(result);


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

  const useSampleImage = async () => {
    const response = await fetch(sampleImage);
    const blob = await response.blob();
    readFile(new File([blob], "synthetic-portrait.jpg", { type: blob.type || "image/jpeg" }));
  };

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
            : { kind: "image", dataUrl: image?.dataUrl ?? "", mimeType: image?.type as "image/jpeg" | "image/png" | "image/webp" },
      });
      setResult(next);
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

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="Hive home">
            <BrandMark />
            <span className="text-2xl font-bold">Hive</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Main navigation">
            <a className="nav-link" href="#detector">Products <ChevronDown /></a>
            <a className="nav-link" href="#how">How it works</a>
            <a className="nav-link" href="#use-cases">Use cases</a>
            <a className="nav-link" href="#trust">Trust center</a>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Button variant="ghost" asChild><a href="#how">Documentation</a></Button>
            <Button variant="ink" size="xl" asChild><a href="#detector">Try detector <ArrowRight /></a></Button>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
        {menuOpen && (
          <nav className="absolute inset-x-0 top-20 border-b border-border bg-background p-5 lg:hidden">
            {[["Products", "#detector"], ["How it works", "#how"], ["Use cases", "#use-cases"], ["Trust center", "#trust"]].map(([label, href]) => (
              <a key={label} href={href} className="block border-b border-border py-4 font-medium" onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
          </nav>
        )}
      </header>

      <section id="top" className="relative border-b border-border bg-ink text-ink-foreground">
        <div className="tech-grid absolute inset-0 opacity-30" />
        <div className="relative mx-auto grid min-h-[520px] max-w-[1440px] lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-between border-border p-6 py-12 lg:border-r lg:p-14 lg:py-16">
            <div>
              <div className="reveal in-view mb-8 flex items-center gap-2 text-xs font-semibold uppercase text-signal">
                <span className="h-2 w-2 animate-pulse rounded-full bg-signal shadow-[0_0_20px_var(--signal)]" />
                Synthetic media intelligence
              </div>
              <h1 className="reveal reveal-1 in-view max-w-3xl text-5xl font-semibold leading-[0.95] sm:text-6xl lg:text-7xl">
                Know what’s <span className="sheen-text">real.</span>
              </h1>
              <p className="reveal reveal-2 in-view mt-7 max-w-lg text-lg leading-8 text-ink-muted">
                Detect AI-generated text and images with clear confidence scores and evidence you can inspect.
              </p>
            </div>
            <div className="reveal reveal-3 in-view mt-12 flex flex-wrap gap-3">
              <Button variant="hero" size="xl" className="cta-shine lift" asChild><a href="#detector">Analyze content <ArrowRight /></a></Button>
              <Button className="lift border-ink-line bg-transparent text-ink-foreground hover:bg-ink-surface" variant="outline" size="xl" asChild><a href="#how">See how it works</a></Button>
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
              <span className="absolute left-[12%] top-[14%] font-mono text-xs text-ink-muted">SCAN_03</span>
              <span className="absolute bottom-[13%] right-[10%] font-mono text-xs text-signal">SIGNAL ACTIVE</span>
              <div className="scan-line absolute left-[8%] right-[8%] h-px bg-signal" />
            </div>
          </div>
        </div>
      </section>

      <section id="detector" className="bg-surface py-16 lg:py-24">
        <div className="mx-auto max-w-[1240px] px-5">
          <div className="reveal mb-10 max-w-2xl">
            <p className="section-kicker">Free detection lab</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Inspect content. Understand the signal.</h2>
            <p className="mt-4 text-muted-foreground">No account required. Your input is analyzed only for this result.</p>
          </div>

          <div className="reveal reveal-1 overflow-hidden border border-border bg-background shadow-editorial transition-shadow duration-500 hover:shadow-[16px_16px_0_0_var(--ink)]">
            <div className="flex items-center justify-between border-b border-border px-4 sm:px-6">
              <div className="flex" role="tablist" aria-label="Content type">
                <button className={`mode-tab ${mode === "text" ? "active" : ""}`} onClick={() => changeMode("text")} role="tab" aria-selected={mode === "text"}><TextCursorInput /> Text</button>
                <button className={`mode-tab ${mode === "image" ? "active" : ""}`} onClick={() => changeMode("image")} role="tab" aria-selected={mode === "image"}><ImageIcon /> Image</button>
              </div>
              <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4" /> Private session</span>
            </div>

            <div className="grid min-h-[550px] lg:grid-cols-2">
              <div className="flex min-w-0 flex-col border-border p-5 lg:border-r lg:p-8">
                {mode === "text" ? (
                  <>
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Paste at least 80 characters</span><span className="font-mono">{text.length.toLocaleString()} / 12,000</span>
                    </div>
                    <Textarea value={text} maxLength={12000} onChange={(event) => { setText(event.target.value); setResult(null); }} placeholder="Paste writing here to inspect language patterns, sentence rhythm, and predictability…" className="min-h-[310px] flex-1 resize-none rounded-none border-border bg-surface/60 p-5 text-base leading-7 shadow-none focus-visible:ring-signal" />
                    <button className="mt-3 self-start text-sm font-semibold underline decoration-signal decoration-2 underline-offset-4" onClick={() => { setText(sampleText); setResult(null); setError(""); }}>Use sample text</button>
                  </>
                ) : image ? (
                  <div className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden bg-ink-surface">
                    <img src={image.dataUrl} alt="Content selected for AI analysis" className="max-h-[450px] w-full object-contain" />
                    <Button variant="secondary" size="icon" className="absolute right-3 top-3" aria-label="Remove image" onClick={() => { setImage(null); setResult(null); }}><X /></Button>
                    <span className="absolute bottom-3 left-3 max-w-[80%] truncate bg-ink px-3 py-2 font-mono text-xs text-ink-foreground">{image.name}</span>
                  </div>
                ) : (
                  <div onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); readFile(event.dataTransfer.files[0]); }} className="grid min-h-[360px] flex-1 place-items-center border border-dashed border-border bg-surface/60 p-8 text-center">
                    <div>
                      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-ink text-ink-foreground"><Upload /></div>
                      <h3 className="text-xl font-semibold">Drop an image to inspect</h3>
                      <p className="mt-2 text-sm text-muted-foreground">JPG, PNG or WebP · up to 6 MB</p>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button variant="ink" onClick={() => inputRef.current?.click()}><FileImage /> Choose image</Button>
                        <Button variant="outline" onClick={useSampleImage}>Use sample</Button>
                      </div>
                      <input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => readFile(event.target.files?.[0])} />
                    </div>
                  </div>
                )}
                {error && <p className="mt-4 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}
                <Button variant="hero" size="xl" className="mt-5 w-full" disabled={loading} onClick={runAnalysis}>
                  {loading ? <><LoaderCircle className="animate-spin" /> Running forensic analysis…</> : <><ScanLine /> Analyze {mode}</>}
                </Button>
              </div>

              <div className="min-w-0 bg-result p-5 lg:p-8" aria-live="polite">
                {result ? <Results result={result} mode={mode} copied={copied} onCopy={copyResult} /> : loading ? <LoadingState mode={mode} /> : <EmptyResult mode={mode} />}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Detection is probabilistic and should support—not replace—human review. Results are not proof of authorship.</p>
        </div>
      </section>

      <section id="how" className="border-y border-border bg-background py-20 lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="section-kicker">Explainable by design</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">A score is only useful when you can question it.</h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Hive pairs every estimate with the visible patterns that shaped it, so reviewers can make better decisions.</p>
            </div>
            <div className="grid border-l border-t border-border sm:grid-cols-2">
              {[
                [Fingerprint, "Pattern analysis", "Examines linguistic regularity and visible image artifacts without relying on a single cue."],
                [Sparkles, "Evidence weighting", "Ranks the strongest signals and shows how much each contributes to the assessment."],
                [ScanLine, "Section-level detail", "Maps text likelihood sentence by sentence for fast review of mixed-origin writing."],
                [ShieldCheck, "Human judgment", "Keeps uncertainty visible and avoids turning a model estimate into a false claim of proof."],
              ].map(([Icon, title, copy], index) => {
                const FeatureIcon = Icon as typeof Fingerprint;
                return <article key={title as string} className="border-b border-r border-border p-7 lg:p-9"><span className="font-mono text-xs text-muted-foreground">0{index + 1}</span><FeatureIcon className="mt-10 h-8 w-8" strokeWidth={1.5} /><h3 className="mt-6 text-xl font-semibold">{title as string}</h3><p className="mt-3 leading-7 text-muted-foreground">{copy as string}</p></article>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="bg-signal py-20 text-signal-foreground lg:py-28">
        <div className="mx-auto max-w-[1240px] px-5">
          <p className="section-kicker text-signal-foreground/60">Built for real decisions</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Protect the places where authenticity matters.</h2>
            <p className="max-w-md leading-7 text-signal-foreground/70">From editorial desks to marketplaces, get a consistent first-pass signal before escalating content for review.</p>
          </div>
          <div className="mt-14 grid border-l border-t border-signal-foreground/25 md:grid-cols-3">
            {[
              ["01", "Publishing", "Screen submitted copy and visual assets before publication."],
              ["02", "Education", "Review writing patterns with context rather than a binary accusation."],
              ["03", "Marketplaces", "Flag synthetic product imagery and misleading listings for review."],
              ["04", "Social platforms", "Prioritize suspicious content without hiding the confidence level."],
              ["05", "Recruiting", "Inspect high-volume applications for templated synthetic writing."],
              ["06", "Research", "Triage mixed datasets and document visible evidence for later review."],
            ].map(([number, title, copy]) => <article key={number} className="min-h-56 border-b border-r border-signal-foreground/25 p-7"><span className="font-mono text-xs opacity-60">{number}</span><h3 className="mt-12 text-2xl font-semibold">{title}</h3><p className="mt-3 leading-7 opacity-70">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section id="trust" className="bg-ink py-20 text-ink-foreground lg:py-28">
        <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-10 px-5 lg:flex-row lg:items-end">
          <div><p className="section-kicker text-signal">Trust, with context</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Test suspicious content before it tests your credibility.</h2></div>
          <Button variant="hero" size="xl" asChild><a href="#detector">Try the detector <ArrowRight /></a></Button>
        </div>
      </section>

      <footer className="border-t border-ink-line bg-ink py-10 text-ink-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><BrandMark /><span className="text-xl font-bold">Hive</span><span className="ml-3 text-xs text-ink-muted">© 2026</span></div>
          <div className="flex flex-wrap gap-6 text-sm text-ink-muted"><a href="#detector">Detector</a><a href="#how">Methodology</a><a href="#trust">Privacy</a><a href="#trust">Ethics</a></div>
        </div>
      </footer>
    </main>
  );
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function EmptyResult({ mode }: { mode: Mode }) {
  return <div className="grid h-full min-h-[420px] place-items-center text-center"><div><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-border bg-background"><ScanLine className="h-8 w-8 text-muted-foreground" strokeWidth={1.4} /></div><h3 className="mt-7 text-xl font-semibold">Your analysis will appear here</h3><p className="mx-auto mt-3 max-w-sm leading-7 text-muted-foreground">{mode === "text" ? "We’ll show an overall score, sentence-level highlights, and the language patterns behind it." : "We’ll inspect visible artifacts, composition, texture, and generation cues."}</p></div></div>;
}

function LoadingState({ mode }: { mode: Mode }) {
  return <div className="flex h-full min-h-[420px] flex-col justify-center"><div className="relative mx-auto h-28 w-28"><div className="absolute inset-0 animate-ping rounded-full border border-signal/40" /><div className="absolute inset-4 grid place-items-center rounded-full bg-ink text-signal"><Fingerprint className="h-10 w-10" /></div></div><h3 className="mt-8 text-center text-xl font-semibold">Inspecting {mode} signals</h3><div className="mx-auto mt-7 w-full max-w-sm space-y-3">{["Extracting patterns", "Comparing signals", "Building explanation"].map((label, index) => <div key={label} className="flex items-center gap-3 text-sm"><span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "animate-pulse bg-signal" : "bg-border"}`} /><span>{label}</span></div>)}</div></div>;
}

function Results({ result, mode, copied, onCopy }: { result: DetectionResult; mode: Mode; copied: boolean; onCopy: () => void }) {
  const human = 100 - result.score;
  return <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Analysis complete</p><h3 className="mt-2 text-2xl font-semibold">{result.verdict}</h3></div><Button variant="outline" size="icon" onClick={onCopy} aria-label="Copy result">{copied ? <Check /> : <Clipboard />}</Button></div>
    <div className="mt-7 grid grid-cols-[128px_1fr] items-center gap-6"><div className="score-ring" style={{ "--score": `${result.score * 3.6}deg` } as CSSProperties}><div><strong>{result.score}%</strong><span>AI likelihood</span></div></div><div><span className="inline-flex bg-ink px-2 py-1 font-mono text-xs text-ink-foreground">{result.confidence} confidence</span><p className="mt-3 text-sm leading-6 text-muted-foreground">{result.summary}</p></div></div>
    <div className="mt-7 space-y-2"><Distribution label="AI-generated" value={result.score} tone="signal" /><Distribution label="Human-made" value={human} tone="ink" /></div>
    <div className="mt-8 border-t border-border pt-6"><h4 className="text-sm font-semibold uppercase">Strongest signals</h4><div className="mt-4 space-y-5">{result.signals.map((signal) => <div key={signal.label}><div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="font-semibold">{signal.label}</span><span className="font-mono text-xs">{signal.weight}%</span></div><div className="h-1.5 bg-border"><div className="h-full bg-signal transition-all duration-700" style={{ width: `${signal.weight}%` }} /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.detail}</p></div>)}</div></div>
    {mode === "text" && result.segments.length > 0 && <div className="mt-8 border-t border-border pt-6"><h4 className="text-sm font-semibold uppercase">Sentence map</h4><div className="mt-4 max-h-56 overflow-auto bg-background p-4 text-sm leading-7">{result.segments.map((segment, index) => <span key={`${index}-${segment.text.slice(0, 12)}`} title={`${segment.score}% AI likelihood`} className={segment.score >= 70 ? "bg-signal/50" : segment.score >= 40 ? "bg-warning/40" : "bg-positive/20"}>{segment.text} </span>)}</div></div>}
  </div>;
}

function Distribution({ label, value, tone }: { label: string; value: number; tone: "signal" | "ink" }) {
  return <div><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span className="font-mono">{value}%</span></div><div className="h-2 bg-border"><div className={`h-full ${tone === "signal" ? "bg-signal" : "bg-ink"}`} style={{ width: `${value}%` }} /></div></div>;
}