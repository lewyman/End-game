import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Calculator, CheckCircle2, Clock, GitBranch, Loader2, RefreshCw, ShieldAlert, Share2, Sparkles, Wrench } from "lucide-react";
import GeneratedToolRenderer, { type GeneratedClinicalTool } from "../components/clinical/GeneratedToolRenderer";
import AuthGate from "../components/AuthGate";
import { useZoAuth } from "../lib/auth";
import { getPlanTier, hasFeature } from "../lib/auth";

type ToolKey = "builder" | "nclex" | "interactions" | "dosing" | "cascade" | "decision" | `generated:${string}`;
type AnyRecord = Record<string, any>;

type NclexQuestion = {
  type: "mcq" | "sata";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  rationale: string;
  optionRationales: Record<string, string>;
};

type NclexStats = { total: number; right: number; wrong: number; percent: number; byTopic: Record<string, { total: number; right: number }> };

function SeverityBadge({ value }: { value?: string }) {
  const severity = String(value || "unknown").toLowerCase();
  const cls = severity === "critical" || severity === "high"
    ? "border-red-400/50 bg-red-950/40 text-red-200"
    : severity === "major"
      ? "border-orange-400/50 bg-orange-950/40 text-orange-200"
      : severity === "moderate" || severity === "possible"
        ? "border-amber-400/50 bg-amber-950/40 text-amber-200"
        : severity === "minor" || severity === "low"
          ? "border-blue-400/50 bg-blue-950/40 text-blue-200"
          : "border-border/60 bg-card/60 text-foreground/60";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${cls}`}>{severity}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-5">
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground/80">{label}</div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function toText(value: unknown) {
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n\n");
  if (value == null) return "";
  return String(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  const text = toText(value).trim();
  if (!text) return [];
  return text.split(/\n\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map((v) => v.trim()).filter(Boolean).slice(0, 24);
}

function BulletList({ items, empty = "None listed." }: { items?: unknown; empty?: string }) {
  const clean = toList(items);
  if (!clean.length) return <p className="text-sm text-muted-foreground/80">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-foreground/80">
      {clean.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TextBlock({ label, value }: { label: string; value: unknown }) {
  const text = toText(value);
  if (!text) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase text-primary/80">{label}</div>
      <p className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-3 text-sm text-foreground/80">{text}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-red-200">{message}</div>;
}

function InteractionResults({ data }: { data: AnyRecord }) {
  if (data.error) return <ErrorBox message={data.error} />;
  const interactions = data.interactions || [];
  const labelResults = data.labelResults || [];
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Drugs checked" value={(data.drugs || []).join(", ") || "—"} />
        <Metric label="Interactions found" value={String(data.interactionCount ?? 0)} />
        <Metric label="Highest severity" value={<SeverityBadge value={data.highestSeverity} />} />
      </div>

      <Section title="RxNorm + Local Interaction Pairs">
        {!interactions.length ? (
          <div className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-5 w-5" /> No interaction pair returned for these drugs.</div>
        ) : (
          <div className="space-y-4">
            {interactions.map((item: AnyRecord, index: number) => (
              <div key={index} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold text-white">{(item.drugs || []).join(" + ")}</div>
                  <SeverityBadge value={item.severity} />
                </div>
                <p className="mt-3 text-sm text-foreground/80">{item.description || item.mechanism || "Interaction detected."}</p>
                {item.nursing ? <div className="mt-3"><div className="mb-1 text-xs font-semibold uppercase text-primary/80">Nursing checks</div><BulletList items={item.nursing} /></div> : null}
                {item.interactionConcept ? <div className="mt-3 rounded-lg bg-background/60 p-3 text-xs text-muted-foreground"><span className="font-semibold text-foreground/80">RxNorm concepts: </span>{item.interactionConcept}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="FDA Label Warnings">
        {!labelResults.length ? <p className="text-sm text-muted-foreground/80">No boxed warning / interaction text found.</p> : (
          <div className="space-y-3">
            {labelResults.map((warning: AnyRecord, index: number) => (
              <details key={index} className="rounded-xl border border-border bg-card/60 p-4">
                <summary className="cursor-pointer font-semibold text-foreground/40">{warning.drug}</summary>
                <div className="mt-3 space-y-3">
                  <TextBlock label="Boxed warning" value={warning.boxedWarning} />
                  <TextBlock label="Drug interactions" value={warning.drugInteractions} />
                  <TextBlock label="Warnings" value={warning.warnings} />
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>
      {data.disclaimer ? <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">{data.disclaimer}</div> : null}
    </div>
  );
}

function DosingResults({ data }: { data: AnyRecord }) {
  if (data.error) return <ErrorBox message={data.error} />;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Drug" value={data.drug || "—"} />
        <Metric label="Weight" value={data.weightKg ? `${data.weightKg} kg` : "Not provided"} />
        <Metric label="FDA dosing found" value={data.dosingLabelAvailable ? "Yes" : "No"} />
      </div>
      <Section title="FDA Dosage & Administration"><BulletList items={data.dosageAndAdministration} empty="No FDA dosing text found for this drug." /></Section>
      <Section title="mg/kg Based Dosing"><BulletList items={data.mgPerKgFindings?.map((x: AnyRecord) => JSON.stringify(x))} empty="No mg/kg text detected in FDA label." /></Section>
      <Section title="Adult Dose Snippets"><BulletList items={data.adultDoseSnippets} empty="No adult-specific dose snippet detected." /></Section>
      <Section title="Route-Specific Formulations"><BulletList items={data.routeSpecificForms} empty="No route-specific formulations found." /></Section>
      {data.warning ? <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">{data.warning}</div> : null}
    </div>
  );
}

function CascadeResults({ data }: { data: AnyRecord }) {
  if (data.error) return <ErrorBox message={data.error} />;
  const nodes = data.nodes || [];
  const cascades = data.cascades || [];
  const highest = cascades.some((c: AnyRecord) => c.severity === "critical") ? "critical" : cascades.some((c: AnyRecord) => c.severity === "major") ? "major" : cascades.some((c: AnyRecord) => c.severity === "possible") ? "possible" : "none found";
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Drugs checked" value={(data.drugs || []).join(", ") || "—"} />
        <Metric label="Cascade paths" value={String(data.cascadeCount ?? cascades.length)} />
        <Metric label="Highest severity" value={<SeverityBadge value={highest} />} />
      </div>
      <Section title="Pathway Nodes">
        <div className="grid gap-3 md:grid-cols-2">
          {nodes.map((node: AnyRecord, index: number) => (
            <div key={index} className="rounded-xl border border-border bg-card/70 p-4">
              <div className="font-semibold text-white">{node.drug}</div>
              <div className="mt-2 flex flex-wrap gap-2">{(node.enzymes || []).map((e: string) => <span key={e} className="rounded-full bg-primary/50 px-2 py-1 text-xs text-violet-200">{e}</span>)}</div>
              <p className="mt-3 text-sm text-muted-foreground">{node.notes}</p>
              <BulletList items={node.effects} empty="No effects listed." />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Cascade Interactions">
        {!cascades.length ? <p className="text-sm text-muted-foreground/80">No shared CYP/P-gp cascade detected in local profile.</p> : (
          <div className="space-y-4">
            {cascades.map((item: AnyRecord, index: number) => (
              <div key={index} className="rounded-xl border border-border bg-card/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-semibold text-white">{(item.drugs || []).join(" + ")}</div>
                  <SeverityBadge value={item.severity} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground/80">Shared pathways: {(item.sharedPathways || []).join(", ") || "known interaction rule"}</div>
                <p className="mt-3 text-sm text-foreground/80">{item.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
      {data.source ? <div className="rounded-2xl border border-border bg-background/70 p-4 text-xs text-muted-foreground/80">Source: {data.source}</div> : null}
      {data.disclaimer ? <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">{data.disclaimer}</div> : null}
    </div>
  );
}

export default function ClinicalTools() {
  const [activeTool, setActiveTool] = useState<ToolKey>("builder");
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedTools, setGeneratedTools] = useState<GeneratedClinicalTool[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generationTier, setGenerationTier] = useState<"free" | "pro">("pro");
  const [generatedError, setGeneratedError] = useState("");
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifyTier, setModifyTier] = useState<"free" | "pro">("pro");
  const [modifyLoading, setModifyLoading] = useState(false);
  const [modifyError, setModifyError] = useState("");
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [ddiDrugs, setDdiDrugs] = useState("");
  const [doseDrug, setDoseDrug] = useState("");
  const [doseWeight, setDoseWeight] = useState("");
  const [doseRoute, setDoseRoute] = useState("");
  const [cascadeDrugs, setCascadeDrugs] = useState("");
  const [nclexTopic, setNclexTopic] = useState("pharmacology prioritization");
  const [nclexTier, setNclexTier] = useState<"free" | "pro">("pro");
  const [nclexQuestion, setNclexQuestion] = useState<NclexQuestion | null>(null);
  const [nclexSelected, setNclexSelected] = useState<string[]>([]);
  const [nclexSubmitted, setNclexSubmitted] = useState(false);
  const [nclexLoading, setNclexLoading] = useState(false);
  const [nclexError, setNclexError] = useState("");
  const [nclexScore, setNclexScore] = useState({ right: 0, wrong: 0 });
  const [savedNclexStats, setSavedNclexStats] = useState<NclexStats | null>(null);
  const [nclexTutorMode, setNclexTutorMode] = useState(false);
  const [nclexTimedMode, setNclexTimedMode] = useState(false);
  const nclexTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nclexTimerActive, setNclexTimerActive] = useState(false);
  const [nclexTimeLeft, setNclexTimeLeft] = useState(60);
  const [nclexFocusSystem, setNclexFocusSystem] = useState("");
  const [nclexFocusCategory, setNclexFocusCategory] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);

  const { account, getToken } = useZoAuth();
  const tier = getPlanTier(account);
  const canTutorMode = hasFeature(account, "tutor_mode");
  const canTimedMode = hasFeature(account, "timed_mode");
  const canCustomFocus = hasFeature(account, "custom_focus");
  const canDecision = tier === "max";

  const [decisionScenario, setDecisionScenario] = useState("");
  const [decisionResult, setDecisionResult] = useState<any>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  async function runDecisionTool() {
    if (!decisionScenario.trim()) return;
    setDecisionLoading(true);
    setDecisionError("");
    setDecisionResult(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/clinical/decision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ scenario: decisionScenario }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      setDecisionResult(data);
    } catch (e: any) {
      setDecisionError(e.message || "Clinical decision tool failed.");
    } finally {
      setDecisionLoading(false);
    }
  }

  async function postTool(path: string, body: AnyRecord) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) });
      setResult(await res.json());
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadGeneratedTools() {
    setLoadingGenerated(true);
    try {
      const res = await fetch("/api/clinical/generated-tools", { headers: { "Accept": "application/json" } });
      const data = await res.json();
      setGeneratedTools(Array.isArray(data.tools) ? data.tools : []);
    } catch (e: any) {
      setGeneratedError(e.message || "Could not load generated tools.");
    } finally {
      setLoadingGenerated(false);
    }
  }

  useEffect(() => {
    loadGeneratedTools();
  }, []);

  async function generateClinicalTool() {
    const request = generatedPrompt.trim();
    if (!request) return;
    setLoading(true);
    setGeneratedError("");
    try {
      const res = await fetch("/api/clinical/generate-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ request, tier: generationTier }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Tool generation failed");
      setGeneratedTools((prev) => [data.tool, ...prev.filter((tool) => tool.id !== data.tool.id)]);
      setActiveTool(`generated:${data.tool.id}`);
      setGeneratedPrompt("");
    } catch (e: any) {
      setGeneratedError(e.message || "Tool generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function modifyGeneratedTool() {
    if (!selectedGeneratedTool || !modifyInstruction.trim()) return;
    setModifyLoading(true);
    setModifyError("");
    try {
      const res = await fetch(`/api/clinical/generated-tools/${encodeURIComponent(selectedGeneratedTool.id)}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ instruction: modifyInstruction.trim(), tier: modifyTier }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Tool modification failed");
      setGeneratedTools((prev) => [data.tool, ...prev.filter((tool) => tool.id !== data.tool.id)]);
      setActiveTool(`generated:${data.tool.id}`);
      setModifyInstruction("");
      setModifyOpen(false);
    } catch (e: any) {
      setModifyError(e.message || "Tool modification failed");
    } finally {
      setModifyLoading(false);
    }
  }

  function sortedAnswers(values: string[]) {
    return [...new Set(values)].sort().join(",");
  }

  async function generateNclexQuestion() {
    setNclexLoading(true);
    setNclexError("");
    setNclexSubmitted(false);
    setNclexSelected([]);
    clearInterval(nclexTimerRef.current!);
    setNclexTimerActive(false);
    setNclexTimeLeft(60);
    try {
      const res = await fetch("/api/clinical/nclex-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          topic: nclexTopic,
          tier: nclexTier,
          tutorMode: nclexTutorMode,
          focusCategory: nclexFocusCategory || undefined,
          focusSystem: nclexFocusSystem || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Question generation failed");
      setNclexQuestion(data.question);
      if (nclexTimedMode) { setNclexTimeLeft(60); setNclexTimerActive(true); }
    } catch (e: any) {
      setNclexError(e.message || "Question generation failed");
    } finally {
      setNclexLoading(false);
    }
  }

  function toggleNclexAnswer(id: string) {
    if (!nclexQuestion || nclexSubmitted) return;
    if (nclexQuestion.type === "mcq") {
      setNclexSelected([id]);
      return;
    }
    setNclexSelected((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);
  }

  async function submitNclexAnswer() {
    if (!nclexQuestion || nclexSubmitted || nclexSelected.length === 0) return;
    const correct = sortedAnswers(nclexSelected) === sortedAnswers(nclexQuestion.correctAnswers);
    setNclexScore((prev) => ({ right: prev.right + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }));
    setNclexSubmitted(true);
    try {
      const res = await fetch("/api/nclex/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ topic: nclexQuestion.topic, type: nclexQuestion.type, correct, selected: nclexSelected, correctAnswers: nclexQuestion.correctAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedNclexStats(data.stats || null);
      }
    } catch {}
  }

  function resetNclexScore() {
    setNclexScore({ right: 0, wrong: 0 });
  }

  async function loadNclexStats() {
    try {
      const res = await fetch("/api/nclex/attempts", { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const data = await res.json();
        setSavedNclexStats(data.stats || null);
      }
    } catch {}
  }

  useEffect(() => {
    loadNclexStats();
  }, []);

  useEffect(() => {
    if (!nclexTimerActive) return;
    nclexTimerRef.current = setInterval(() => {
      setNclexTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(nclexTimerRef.current!);
          setNclexTimerActive(false);
          submitNclexAnswer();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(nclexTimerRef.current!);
  }, [nclexTimerActive]);

  const totalNclexAnswered = nclexScore.right + nclexScore.wrong;
  const nclexPercent = totalNclexAnswered ? Math.round((nclexScore.right / totalNclexAnswered) * 100) : 0;

  function shareNclexScore() {
    const stats = `🩺 NCLEX Practice Results\n✅ Right: ${nclexScore.right}\n❌ Wrong: ${nclexScore.wrong}\n📊 Score: ${nclexPercent}%\n🧠 Topic: ${nclexTopic}\n\nTry it yourself at Bio-Sync Academy → https://academy.endgameenhancements.com/clinical-tools`;
    
    if (navigator.share) {
      navigator.share({ title: "My NCLEX Practice Score", text: stats }).catch(() => {});
    } else {
      navigator.clipboard.writeText(stats).then(() => {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }).catch(() => {});
    }
  }

  const selectedGeneratedTool = activeTool.startsWith("generated:")
    ? generatedTools.find((tool) => tool.id === activeTool.replace("generated:", ""))
    : null;

  const tabs = [
    { key: "builder" as ToolKey, label: "AI Tool Builder", icon: Wrench, desc: "shared tools" },
    { key: "nclex" as ToolKey, label: "Infinite NCLEX Question Generator", icon: Calculator, desc: "endless practice" },
    { key: "interactions" as ToolKey, label: "DDI Checker", icon: ShieldAlert, desc: "RxNorm + openFDA" },
    { key: "decision" as ToolKey, label: "Clinical Decision Tool", icon: Activity, desc: canDecision ? "patient scenarios" : "Max only" },
    { key: "dosing" as ToolKey, label: "Dosing Helper", icon: Calculator, desc: "FDA label data" },
    { key: "cascade" as ToolKey, label: "Cascade Graph", icon: GitBranch, desc: "CYP/P-gp pathways" },
  ];

  return (
    <AuthGate message="Sign in to access Clinical Tools and AI-powered calculators.">
      <div className="min-h-screen bg-[#080810] p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-white">Clinical Tools</h1>
              <p className="text-sm text-muted-foreground">Core safety tools plus shared AI-generated study tools requested by students.</p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
            {tabs.map(({ key, label, icon: Icon, desc }) => (
              <button key={key} onClick={() => { setActiveTool(key); setResult(null); }} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTool === key ? "bg-primary text-white" : "bg-card/60 text-muted-foreground hover:bg-muted"}`}>
                <Icon className="h-4 w-4" /> {label} <span className="text-xs opacity-60">{desc}</span>
              </button>
            ))}
            {generatedTools.map((tool) => (
              <button key={tool.id} onClick={() => { setActiveTool(`generated:${tool.id}`); setResult(null); }} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${activeTool === `generated:${tool.id}` ? "bg-emerald-600 text-white" : "bg-card/60 text-muted-foreground hover:bg-muted"}`}>
                <Sparkles className="h-4 w-4" /> {tool.name} <span className="text-xs opacity-60">{tool.category}</span>
              </button>
            ))}
          </div>

          {activeTool === "builder" && (
            <div className="mb-6 space-y-5 rounded-2xl border border-primary/30 bg-background/80 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Wrench className="h-5 w-5 text-primary/80" /><h2 className="text-lg font-semibold text-white">AI Tool Builder</h2></div>
                  <p className="mt-2 text-sm text-muted-foreground">Ask for a nursing calculator, checklist, reference card, or study tool. Once generated, it is saved here for everyone.</p>
                </div>
                <button onClick={loadGeneratedTools} disabled={loadingGenerated} className="flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-card/60 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${loadingGenerated ? "animate-spin" : ""}`} /> Refresh tools
                </button>
              </div>

              <textarea value={generatedPrompt} onChange={(e) => setGeneratedPrompt(e.target.value)} placeholder="Example: Build an IV drip rate calculator with gtt/min and mL/hr, include nursing safety notes." rows={4} className="w-full rounded-xl border border-border/80 bg-card p-4 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl border border-border bg-background p-1">
                  <button type="button" onClick={() => setGenerationTier("free")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${generationTier === "free" ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground hover:text-white"}`}>Free MAIA</button>
                  <button type="button" onClick={() => setGenerationTier("pro")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${generationTier === "pro" ? "bg-primary/80/20 text-violet-200" : "text-muted-foreground hover:text-white"}`}>Pro MAIA</button>
                </div>
                <button onClick={generateClinicalTool} disabled={loading || !generatedPrompt.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Shared Tool
                </button>
              </div>

              {generatedError ? <ErrorBox message={generatedError} /> : null}

              <div className="grid gap-3 md:grid-cols-2">
                {generatedTools.length === 0 ? <p className="text-sm text-muted-foreground/80">No generated tools yet. Build the first one.</p> : generatedTools.map((tool) => (
                  <button key={tool.id} onClick={() => setActiveTool(`generated:${tool.id}`)} className="rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-primary/50 hover:bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-white">{tool.name}</div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
                    {tool.status === "pending" ? <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">Pending admin review. You can see it, but it will not appear publicly until approved.</div> : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTool === "nclex" && (
            <div className="mb-6 space-y-5 rounded-2xl border border-emerald-500/30 bg-background/80 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-emerald-300" /><h2 className="text-lg font-semibold text-white">Infinite NCLEX Question Generator</h2></div>
                  <p className="mt-2 text-sm text-muted-foreground">Choose a topic, generate one MCQ or SATA question at a time, submit, review rationales, then keep going.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2"><div className="text-xs uppercase text-emerald-300">Right</div><div className="text-xl font-bold text-white">{nclexScore.right}</div></div>
                  <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2"><div className="text-xs uppercase text-red-300">Wrong</div><div className="text-xl font-bold text-white">{nclexScore.wrong}</div></div>
                  <div className="rounded-xl border border-primary/30 bg-primary/50/20 px-4 py-2"><div className="text-xs uppercase text-primary/80">Score</div><div className="text-xl font-bold text-white">{nclexPercent}%</div></div>
                </div>
              </div>

              {/* Timed mode countdown */}
              {nclexTimedMode && nclexTimerActive && (
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${nclexTimeLeft <= 10 ? "border-red-500/50 bg-red-950/20 text-red-300" : "border-amber-500/30 bg-amber-950/20 text-amber-300"}`}>
                  <Clock className="w-4 h-4" /> {nclexTimeLeft}s remaining
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input value={nclexTopic} onChange={(e) => setNclexTopic(e.target.value)} placeholder="Question topic, e.g. serotonin syndrome, LPN delegation, insulin safety" className="rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
                <button onClick={resetNclexScore} className="rounded-xl border border-border/80 px-4 py-3 text-sm font-semibold text-foreground/80 hover:bg-card/60">Reset Score</button>
                {totalNclexAnswered > 0 && (
                  <button onClick={shareNclexScore} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition">
                    <Share2 className="h-4 w-4" /> {copiedShare ? "Copied!" : "Share Score"}
                  </button>
                )}
              </div>

              {/* Custom Focus (Max only) */}
              {canCustomFocus && (
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/80">Body System</label>
                    <select value={nclexFocusSystem} onChange={(e) => setNclexFocusSystem(e.target.value)} className="bg-card border border-border/80 rounded-xl px-3 py-2 text-sm text-white outline-none min-w-[160px]">
                      <option value="">Any system</option>
                      {["Cardiovascular","Respiratory","Neurological","Renal","Gastrointestinal","Endocrine","Musculoskeletal","Hematological","Immune","Reproductive","Psychiatric","Multisystem"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground/80">NCLEX Category</label>
                    <select value={nclexFocusCategory} onChange={(e) => setNclexFocusCategory(e.target.value)} className="bg-card border border-border/80 rounded-xl px-3 py-2 text-sm text-white outline-none min-w-[200px]">
                      <option value="">Any category</option>
                      {["Safe & Effective Care","Health Promotion & Maintenance","Psychosocial Integrity","Physiological Integrity","Pharmacological Therapy","Reduction of Risk","Physiological Adaptation","Basic Care & Comfort"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl border border-border bg-background p-1">
                  <button type="button" onClick={() => setNclexTier("free")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${nclexTier === "free" ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground hover:text-white"}`}>Free MAIA</button>
                  <button type="button" onClick={() => setNclexTier("pro")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${nclexTier === "pro" ? "bg-primary/80/20 text-violet-200" : "text-muted-foreground hover:text-white"}`}>Pro MAIA</button>
                </div>

                {/* Tutor Mode toggle */}
                {canTutorMode ? (
                  <button type="button" onClick={() => setNclexTutorMode(v => !v)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition ${nclexTutorMode ? "border-[#0d7a47]/50 bg-fuchsia-950/30 text-fuchsia-300" : "border-border/80 text-muted-foreground hover:text-white"}`}>
                    <Sparkles className="w-3.5 h-3.5" /> Tutor Mode {nclexTutorMode ? "ON" : "OFF"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-600 border border-border rounded-xl px-3 py-2">Tutor Mode · Pro Plus+</span>
                )}

                {/* Timed Mode toggle */}
                {canTimedMode ? (
                  <button type="button" onClick={() => setNclexTimedMode(v => !v)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition ${nclexTimedMode ? "border-amber-500/50 bg-amber-950/30 text-amber-300" : "border-border/80 text-muted-foreground hover:text-white"}`}>
                    <Clock className="w-3.5 h-3.5" /> Timed {nclexTimedMode ? "ON" : "OFF"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-600 border border-border rounded-xl px-3 py-2">Timed Mode · Pro Plus+</span>
                )}

                <button onClick={generateNclexQuestion} disabled={nclexLoading || !nclexTopic.trim()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  {nclexLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {nclexQuestion ? "Next Question" : "Generate Question"}
                </button>
              </div>

              {nclexError ? <ErrorBox message={nclexError} /> : null}

              {nclexQuestion && (
                <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <span className="rounded-full bg-emerald-950 px-2 py-1 text-emerald-200">{nclexQuestion.type === "sata" ? "SATA" : "Multiple Choice"}</span>
                    <span className="rounded-full bg-card/60 px-2 py-1">{nclexQuestion.difficulty}</span>
                    <span>{nclexQuestion.topic}</span>
                    {nclexFocusSystem && <span className="rounded-full bg-primary/50 px-2 py-1 text-violet-200">{nclexFocusSystem}</span>}
                    {nclexFocusCategory && <span className="rounded-full bg-blue-950 px-2 py-1 text-blue-200">{nclexFocusCategory}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-base font-semibold leading-relaxed text-white">{nclexQuestion.stem}</p>
                  <div className="space-y-3">
                    {nclexQuestion.options.map((option) => {
                      const selected = nclexSelected.includes(option.id);
                      const isCorrect = nclexQuestion.correctAnswers.includes(option.id);
                      const showResult = nclexSubmitted;
                      const resultClass = showResult && isCorrect ? "border-emerald-500/70 bg-emerald-950/30" : showResult && selected && !isCorrect ? "border-red-500/70 bg-red-950/30" : selected ? "border-primary/70 bg-primary/50/30" : "border-border/80 bg-background/60 hover:border-border/40";
                      return (
                        <button key={option.id} onClick={() => toggleNclexAnswer(option.id)} className={`w-full rounded-xl border p-4 text-left transition ${resultClass}`}>
                          <div className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-xs font-bold text-white">{option.id}</span>
                            <div className="flex-1">
                              <div className="text-sm text-foreground/40">{option.text}</div>
                              {/* Tutor mode: show rationale for every option after submit */}
                              {showResult && nclexTutorMode && nclexQuestion.optionRationales?.[option.id] && (
                                <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${isCorrect ? "bg-emerald-950/40 text-emerald-200" : "bg-card/60/60 text-muted-foreground"}`}>
                                  {isCorrect ? "✓ " : "✗ "}{nclexQuestion.optionRationales[option.id]}
                                </div>
                              )}
                              {/* Standard mode: only show for selected options */}
                              {showResult && !nclexTutorMode && <div className="mt-2 text-xs text-muted-foreground">{nclexQuestion.optionRationales?.[option.id]}</div>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!nclexSubmitted ? (
                    <button onClick={submitNclexAnswer} disabled={nclexSelected.length === 0} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">Submit Answer</button>
                  ) : (
                    <div className={`rounded-xl border p-4 ${sortedAnswers(nclexSelected) === sortedAnswers(nclexQuestion.correctAnswers) ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100" : "border-red-500/40 bg-red-950/20 text-red-100"}`}>
                      <div className="font-semibold">{sortedAnswers(nclexSelected) === sortedAnswers(nclexQuestion.correctAnswers) ? "✓ Correct!" : "✗ Incorrect"}</div>
                      <div className="mt-1 text-sm">Correct answer{nclexQuestion.correctAnswers.length > 1 ? "s" : ""}: {nclexQuestion.correctAnswers.join(", ")}</div>
                      <p className="mt-3 text-sm text-foreground/60">{nclexQuestion.rationale}</p>
                    </div>
                  )}
                </div>
              )}
              {savedNclexStats ? (
                <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-foreground/80">
                  <div className="font-semibold text-white">All-time saved progress</div>
                  <div className="mt-1">{savedNclexStats.right} right / {savedNclexStats.wrong} wrong · {savedNclexStats.percent}% across {savedNclexStats.total} questions</div>
                </div>
              ) : null}
            </div>
          )}

          {activeTool === "decision" && (
            <div className="mb-6 space-y-5 rounded-2xl border border-rose-500/30 bg-background/80 p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-rose-300" />
                <h2 className="text-lg font-semibold text-white">Clinical Decision Tool</h2>
                <span className="text-xs bg-rose-900/40 text-rose-300 border border-rose-700/40 px-2 py-0.5 rounded-full">Max only</span>
              </div>
              {!canDecision ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">Clinical Decision Tools require the <strong className="text-white">Max plan</strong>.</p>
                  <a href="/pricing" className="mt-3 inline-block px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-semibold text-white transition">Upgrade to Max</a>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Paste a patient scenario and get structured nursing decision support: priority diagnoses, interventions, monitoring, and safety alerts.</p>
                  <textarea
                    value={decisionScenario}
                    onChange={(e) => setDecisionScenario(e.target.value)}
                    placeholder="A 68-year-old male presents with sudden onset chest pain radiating to the left arm, diaphoresis, and shortness of breath. BP 90/60, HR 112, O2 sat 94% on room air..."
                    rows={5}
                    className="w-full rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none resize-none"
                  />
                  <button onClick={runDecisionTool} disabled={decisionLoading || !decisionScenario.trim()} className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
                    {decisionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} Analyze Scenario
                  </button>
                  {decisionError && <p className="text-red-400 text-sm">{decisionError}</p>}
                  {decisionResult && (
                    <div className="space-y-4 mt-2">
                      <div className="rounded-xl bg-rose-950/20 border border-rose-800/30 p-4">
                        <p className="text-xs font-semibold text-rose-300 uppercase mb-1">Priority Assessment</p>
                        <p className="text-white text-sm">{decisionResult.primaryAssessment}</p>
                      </div>
                      {decisionResult.safetyAlerts?.length > 0 && (
                        <div className="rounded-xl bg-red-950/30 border border-red-700/40 p-4">
                          <p className="text-xs font-semibold text-red-300 uppercase mb-2">⚠ Safety Alerts</p>
                          <ul className="space-y-1">{decisionResult.safetyAlerts.map((a: string, i: number) => <li key={i} className="text-red-200 text-sm">• {a}</li>)}</ul>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-card border border-border p-4">
                          <p className="text-xs font-semibold text-primary/80 uppercase mb-2">Nursing Diagnoses</p>
                          <ol className="space-y-1">{decisionResult.nursingDiagnoses?.map((d: string, i: number) => <li key={i} className="text-foreground/80 text-sm">{i + 1}. {d}</li>)}</ol>
                        </div>
                        <div className="rounded-xl bg-card border border-border p-4">
                          <p className="text-xs font-semibold text-blue-300 uppercase mb-2">Monitor</p>
                          <ul className="space-y-1">{decisionResult.monitoringParameters?.map((m: string, i: number) => <li key={i} className="text-foreground/80 text-sm">• {m}</li>)}</ul>
                        </div>
                      </div>
                      <div className="rounded-xl bg-card border border-border p-4">
                        <p className="text-xs font-semibold text-emerald-300 uppercase mb-2">Immediate Interventions</p>
                        <div className="space-y-2">{decisionResult.immediateInterventions?.map((iv: any, i: number) => (
                          <div key={i} className="border-l-2 border-emerald-600 pl-3">
                            <p className="text-white text-sm font-medium">{iv.action}</p>
                            <p className="text-muted-foreground text-xs">{iv.rationale}</p>
                          </div>
                        ))}</div>
                      </div>
                      {decisionResult.educationPoints?.length > 0 && (
                        <div className="rounded-xl bg-card border border-border p-4">
                          <p className="text-xs font-semibold text-yellow-300 uppercase mb-2">Patient Education</p>
                          <ul className="space-y-1">{decisionResult.educationPoints?.map((e: string, i: number) => <li key={i} className="text-foreground/80 text-sm">• {e}</li>)}</ul>
                        </div>
                      )}
                      <p className="text-xs text-slate-600 italic">{decisionResult.disclaimer}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {selectedGeneratedTool && (
            <>
              <GeneratedToolRenderer
                tool={selectedGeneratedTool}
                action={
                  <button type="button" onClick={() => setModifyOpen((value) => !value)} className="rounded-xl border border-primary/40 bg-primary/50/40 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-primary/60/60">
                    Modify with AI
                  </button>
                }
              />
              {modifyOpen && (
                <div className="mt-4 space-y-4 rounded-2xl border border-primary/30 bg-background/80 p-5">
                  <div>
                    <h3 className="font-semibold text-white">Modify {selectedGeneratedTool.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Describe what to add, remove, or change. The updated tool will replace this shared version for everyone.</p>
                  </div>
                  <textarea value={modifyInstruction} onChange={(e) => setModifyInstruction(e.target.value)} placeholder="Example: Add gtt/min using drop factor, add a nursing safety checklist, and include rounding guidance." rows={3} className="w-full rounded-xl border border-border/80 bg-card p-4 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex rounded-xl border border-border bg-background p-1">
                      <button type="button" onClick={() => setModifyTier("free")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${modifyTier === "free" ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground hover:text-white"}`}>Free MAIA</button>
                      <button type="button" onClick={() => setModifyTier("pro")} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${modifyTier === "pro" ? "bg-primary/80/20 text-violet-200" : "text-muted-foreground hover:text-white"}`}>Pro MAIA</button>
                    </div>
                    <button onClick={modifyGeneratedTool} disabled={modifyLoading || !modifyInstruction.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">
                      {modifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Apply Modification
                    </button>
                  </div>
                  {modifyError ? <ErrorBox message={modifyError} /> : null}
                </div>
              )}
            </>
          )}

          {activeTool === "interactions" && (
            <div className="mb-6 space-y-4 rounded-2xl border border-border bg-background/70 p-6">
              <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-white">DDI Checker</h2></div>
              <p className="text-sm text-muted-foreground">Enter drug names separated by commas.</p>
              <textarea value={ddiDrugs} onChange={(e) => setDdiDrugs(e.target.value)} placeholder="warfarin, aspirin, ibuprofen..." rows={3} className="w-full rounded-xl border border-border/80 bg-card p-4 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
              <button onClick={() => postTool("/api/clinical/interactions", { drugs: ddiDrugs })} disabled={loading || !ddiDrugs.trim()} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Check Interactions</button>
              {result && <InteractionResults data={result} />}
            </div>
          )}

          {activeTool === "dosing" && (
            <div className="mb-6 space-y-4 rounded-2xl border border-border bg-background/70 p-6">
              <div className="flex items-center gap-2"><Calculator className="h-5 w-5 text-amber-400" /><h2 className="text-lg font-semibold text-white">Dosing Helper</h2></div>
              <p className="text-sm text-muted-foreground">Enter a drug name. Sources: FDA dosage_and_administration label field.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <input value={doseDrug} onChange={(e) => setDoseDrug(e.target.value)} placeholder="Drug name, e.g. morphine" className="rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
                <input value={doseWeight} onChange={(e) => setDoseWeight(e.target.value)} placeholder="Weight kg, e.g. 70" type="number" className="rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
                <input value={doseRoute} onChange={(e) => setDoseRoute(e.target.value)} placeholder="Route, e.g. IV" className="rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
              </div>
              <button onClick={() => postTool("/api/clinical/dosing", { drug: doseDrug, weightKg: doseWeight, route: doseRoute })} disabled={loading || !doseDrug.trim()} className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Get FDA Dosing</button>
              {result && <DosingResults data={result} />}
            </div>
          )}

          {activeTool === "cascade" && (
            <div className="mb-6 space-y-4 rounded-2xl border border-border bg-background/70 p-6">
              <div className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-cyan-400" /><h2 className="text-lg font-semibold text-white">Cascade Graph</h2></div>
              <p className="text-sm text-muted-foreground">Enter drug names separated by commas. Uses local CYP/P-gp pathway rules.</p>
              <textarea value={cascadeDrugs} onChange={(e) => setCascadeDrugs(e.target.value)} placeholder="simvastatin, clarithromycin, warfarin..." rows={3} className="w-full rounded-xl border border-border/80 bg-card p-4 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none" />
              <button onClick={() => postTool("/api/clinical/cascade", { drugs: cascadeDrugs })} disabled={loading || !cascadeDrugs.trim()} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />} Analyze Cascade</button>
              {result && <CascadeResults data={result} />}
            </div>
          )}

          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
            <div className="flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0" />Educational screening only — not a substitute for pharmacist/prescriber review or clinical judgment.</div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
