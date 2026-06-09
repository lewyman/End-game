import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Trash2, Loader2, AlertCircle, Sparkles, CheckCircle2, ChevronRight, FileText, XCircle, Flame, Zap, Search, Copy, SlidersHorizontal, Bell, Share2, PenLine, RotateCcw } from "lucide-react";
import { useZoAuth } from "../lib/auth";
import { getPlanTier, isProOrHigher, hasFeature } from "../lib/auth";
import AuthGate from "../components/AuthGate";
import { Link, useNavigate } from "react-router-dom";

interface PathwaySummary { id: string; title: string; description: string; status: "generating" | "ready" | "error"; createdAt: string; moduleCount: number; lessonCount: number; stepCount: number; fileIds: string[]; errorMessage?: string | null; }
interface UserFile { id: string; name: string; size: number; type: string; }
interface UserStats { totalXp: number; streak: number; }
interface DueLesson { pathwayId: string; pathwayTitle: string; lessonId: string; lessonTitle: string; nextReview: string; }

function PathwaysList() {
  const { getToken, account } = useZoAuth();
  const navigate = useNavigate();
  const tier = getPlanTier(account);
  const isPro = isProOrHigher(account);

  const canFork = hasFeature(account, "pathway_fork");
  const canShare = hasFeature(account, "pathway_fork");
  const canManual = hasFeature(account, "manual_pathway");

  const [pathways, setPathways] = useState<PathwaySummary[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalXp: 0, streak: 0 });
  const [dueLessons, setDueLessons] = useState<DueLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [pathwayTitle, setPathwayTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "ready" | "generating" | "error">("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [creatingManual, setCreatingManual] = useState(false);

  async function sharePathway(pwId: string) {
    setSharingId(pwId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/pathways/${pwId}/share`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to share");
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      await navigator.clipboard.writeText(fullUrl).catch(() => {});
    } catch (e: any) {
      alert(e.message || "Failed to share");
    } finally {
      setSharingId(null);
    }
  }

  async function createManual() {
    if (!manualTitle.trim()) return;
    setCreatingManual(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/pathways/manual", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ title: manualTitle }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setShowManualModal(false);
      setManualTitle("");
      navigate(`/pathways/${data.id}`);
    } catch (e: any) {
      alert(e.message || "Failed to create");
    } finally {
      setCreatingManual(false);
    }
  }

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const h = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const params = new URLSearchParams();
      if (searchQ) params.set("q", searchQ);
      if (filterStatus) params.set("status", filterStatus);
      params.set("sort", sortBy);
      const [pwRes, fRes, statsRes, dueRes] = await Promise.all([
        fetch(`/api/pathways?${params}`, { headers: h }),
        fetch("/api/files", { headers: h }),
        fetch("/api/user/stats", { headers: h }),
        fetch("/api/pathways/due", { headers: h }),
      ]);
      if (pwRes.ok) setPathways(await pwRes.json() as PathwaySummary[]);
      if (fRes.ok) setFiles(await fRes.json() as UserFile[]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (dueRes.ok) setDueLessons((await dueRes.json() as any).due || []);
    } catch { setError("Failed to load."); }
    finally { setLoading(false); }
  }, [getToken, searchQ, filterStatus, sortBy]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const generating = pathways.filter((p) => p.status === "generating");
    if (!generating.length) return;
    const interval = setInterval(async () => {
      const token = await getToken();
      const updated = await Promise.all(generating.map((p) => fetch(`/api/pathways/${p.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())));
      setPathways((prev) => prev.map((p) => {
        const u = updated.find((x: any) => x.id === p.id);
        if (!u) return p;
        const lessonCount = u.modules?.flatMap((m: any) => m.lessons ?? []).length ?? p.lessonCount;
        const stepCount = u.modules?.flatMap((m: any) => m.lessons?.flatMap((l: any) => l.steps ?? []))?.length ?? p.stepCount;
        return { ...p, ...u, moduleCount: u.modules?.length || p.moduleCount, lessonCount, stepCount };
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, [pathways, getToken]);

  const generate = useCallback(async () => {
    if (!selectedFiles.length) { setError("Select at least one file."); return; }
    setBuilding(true); setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/pathways/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: selectedFiles, title: pathwayTitle || undefined }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setError(data.error || "Failed to generate."); return; }
      setShowBuilder(false); setSelectedFiles([]); setPathwayTitle("");
      await fetchAll();
    } finally { setBuilding(false); }
  }, [selectedFiles, pathwayTitle, getToken, fetchAll]);

  const deletePathway = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const token = await getToken();
      await fetch(`/api/pathways/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setPathways((prev) => prev.filter((p) => p.id !== id));
    } finally { setDeletingId(null); }
  }, [getToken]);

  const forkPathway = useCallback(async (id: string) => {
    setForkingId(id); setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/pathways/${id}/fork`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json() as any;
      if (!res.ok) { setError(data.error || "Fork failed."); return; }
      await fetchAll();
    } finally { setForkingId(null); }
  }, [getToken, fetchAll]);

  const retryPathway = useCallback(async (id: string) => {
    setRetryingId(id); setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/pathways/${id}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json() as any;
      if (!res.ok) { setError(data.error || "Retry failed."); return; }
      await fetchAll();
    } finally { setRetryingId(null); }
  }, [getToken, fetchAll]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-white pb-16">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Study Pathways</h1>
            <p className="text-muted-foreground text-sm">AI-generated courses from your files, with spaced repetition.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/files" className="flex items-center gap-2 px-4 py-2 bg-card/60 hover:bg-muted rounded-xl text-sm font-medium transition-all">
              <FileText className="w-4 h-4" /> Files
            </Link>
            {isPro && (
              <button onClick={() => setShowBuilder(true)} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 rounded-xl text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" /> New Pathway
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        {(stats.streak > 0 || stats.totalXp > 0) && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2 bg-orange-900/20 border border-orange-800/40 rounded-xl px-4 py-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-orange-300">{stats.streak}</span>
              <span className="text-xs text-muted-foreground/80">day streak</span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-4 py-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-300">{stats.totalXp}</span>
              <span className="text-xs text-muted-foreground/80">total XP</span>
            </div>
            {dueLessons.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-2">
                <Bell className="w-4 h-4 text-[#4da6ff]" />
                <span className="text-sm font-bold text-blue-300">{dueLessons.length}</span>
                <span className="text-xs text-muted-foreground/80">due for review</span>
              </div>
            )}
          </div>
        )}

        {/* Due lessons banner */}
        {dueLessons.length > 0 && (
          <div className="bg-blue-950/30 border border-blue-700/30 rounded-2xl p-4 mb-6">
            <p className="text-sm text-blue-300 font-semibold mb-2">📚 Lessons due for review</p>
            <div className="space-y-1">
              {dueLessons.slice(0, 3).map(d => (
                <div key={d.lessonId} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{d.pathwayTitle} → {d.lessonTitle}</span>
                  <Link to={`/pathways/${d.pathwayId}`} className="text-xs text-[#4da6ff] hover:text-blue-300">Review →</Link>
                </div>
              ))}
              {dueLessons.length > 3 && <p className="text-xs text-muted-foreground/80">+{dueLessons.length - 3} more</p>}
            </div>
          </div>
        )}

        {/* Upgrade nudge */}
        {!isPro && (
          <div className="bg-primary/60/20 border border-violet-700/40 rounded-2xl p-6 mb-8 text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">Pro feature</h3>
            <p className="text-muted-foreground text-sm mb-4">Upgrade to Pro to generate unlimited AI study pathways from your files.</p>
            <Link to="/pricing" className="inline-block px-5 py-2 bg-primary hover:bg-primary/80 rounded-xl text-sm font-semibold">View plans →</Link>
          </div>
        )}

        {error && <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-6 text-red-300 text-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {/* Search & Filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/80" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search pathways…"
              className="w-full bg-card border border-border/80 rounded-xl pl-9 pr-3 py-2 text-white text-sm outline-none focus:border-primary"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${showFilters ? "bg-primary/60/30 border-primary/80 text-primary/80" : "bg-card border-border/80 text-muted-foreground hover:text-white"}`}>
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-card border border-border/80 rounded-xl px-3 py-1.5 text-sm text-white outline-none">
              <option value="">All statuses</option>
              <option value="ready">Ready</option>
              <option value="generating">Generating</option>
              <option value="error">Error</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-card border border-border/80 rounded-xl px-3 py-1.5 text-sm text-white outline-none">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        )}

        {/* Builder modal */}
        {showBuilder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white font-bold text-lg">Build a Pathway</h2>
                <button onClick={() => setShowBuilder(false)} className="text-muted-foreground hover:text-white"><XCircle className="w-5 h-5" /></button>
              </div>
              <label className="block text-sm text-muted-foreground mb-1">Pathway title (optional)</label>
              <input value={pathwayTitle} onChange={(e) => setPathwayTitle(e.target.value)} placeholder="e.g. Pharmacology Final Exam Prep" className="w-full bg-card/60 border border-border/80 rounded-xl px-3 py-2 text-white text-sm mb-4 outline-none focus:border-primary" />
              <label className="block text-sm text-muted-foreground mb-2">Select files to build from:</label>
              {files.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground/80 text-sm">No files yet. <Link to="/files" className="text-primary hover:underline">Upload files first →</Link></div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto mb-5">
                  {files.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 bg-card/60 border border-border/80 rounded-xl px-3 py-2 cursor-pointer">
                      <input type="checkbox" checked={selectedFiles.includes(f.id)} onChange={(e) => setSelectedFiles((prev) => e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id))} className="accent-primary" />
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-white text-sm truncate">{f.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={generate} disabled={building || !selectedFiles.length} className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                {building ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Pathway</>}
              </button>
            </div>
          </div>
        )}

        {/* Pathways list */}
        {pathways.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground/80">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{searchQ || filterStatus ? "No pathways match your search." : isPro ? "Create your first pathway from your files." : "Upgrade to Pro to get started."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pathways.map((pw) => {
              const dueCount = dueLessons.filter(d => d.pathwayId === pw.id).length;
              return (
                <div key={pw.id} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/60/40 flex items-center justify-center shrink-0">
                    {pw.status === "generating" ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> :
                     pw.status === "error" ? <XCircle className="w-5 h-5 text-red-400" /> :
                     <BookOpen className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold truncate">{pw.title}</p>
                      {dueCount > 0 && <span className="text-xs bg-[#1a5fa8] text-white px-2 py-0.5 rounded-full shrink-0">{dueCount} due</span>}
                    </div>
                    <p className="text-muted-foreground/80 text-xs mt-0.5">
                      {pw.status === "generating" ? "Generating course…" :
                       pw.status === "error" ? (pw.errorMessage || "Generation failed — file may not contain extractable text. Try a different file or retry.") :
                       `${pw.lessonCount} lessons · ${pw.stepCount} steps · ${new Date(pw.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pw.status === "error" && (
                      <>
                        <button onClick={() => retryPathway(pw.id)} disabled={retryingId === pw.id} className="flex items-center gap-1.5 px-4 py-2 bg-amber-800/40 hover:bg-amber-700/40 rounded-xl text-xs font-semibold transition-all" title={pw.errorMessage || "Generation failed. The file may not have extractable text."}>
                          {retryingId === pw.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Retry
                        </button>
                      </>
                    )}
                    {pw.status === "ready" && (
                      <>
                        <Link to={`/pathways/${pw.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/80 rounded-xl text-xs font-semibold transition-all">
                          Study <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        {(tier === "pro_plus" || tier === "max") && (
                          <button onClick={() => forkPathway(pw.id)} disabled={forkingId === pw.id} title="Duplicate pathway" className="p-2 rounded-lg text-muted-foreground/80 hover:text-primary/80 hover:bg-primary/60/20 transition-all">
                            {forkingId === pw.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={() => deletePathway(pw.id)} disabled={deletingId === pw.id} className="p-2 rounded-lg text-muted-foreground/80 hover:text-red-400 hover:bg-red-900/20 transition-all">
                      {deletingId === pw.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PathwaysPage() {
  return <AuthGate message="Sign in to access your study pathways."><PathwaysList /></AuthGate>;
}
