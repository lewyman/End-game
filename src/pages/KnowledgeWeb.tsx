import { useCallback, useEffect, useState, useRef } from "react";
import {
  Network, Plus, Loader2, XCircle, Sparkles, FileText, CheckCircle2,
  Lock, Zap, Flame, ChevronRight, ArrowLeft, Star, BookOpen, Search,
  GitBranch, RotateCcw, Maximize2, Minimize2, Upload, Bell, Filter
} from "lucide-react";
import { useZoAuth } from "../lib/auth";
import { getPlanTier, isProOrHigher } from "../lib/auth";
import AuthGate from "../components/AuthGate";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface WebQuizQuestion {
  id: string; question: string; options: string[]; correctOption: string; explanation: string;
}
interface WebNode {
  id: string; title: string; content: string; category: string;
  prerequisites: string[]; related: string[]; quiz: WebQuizQuestion[];
  xpValue: number; source: string; position?: { x: number; y: number };
  depth: number; createdAt: string;
  status?: "locked" | "available" | "in-progress" | "mastered";
  progress?: { answeredCorrect: number; totalAnswered: number; sm2: any };
}
interface UserFile { id: string; name: string; size: number; type: string; }
interface UserStats { totalXp: number; streak: number; }

const CAT_COLORS: Record<string, string> = {
  pharmacology: "#ef4444",
  pathophysiology: "#f97316",
  "nursing-intervention": "#22c55e",
  anatomy: "#3b82f6",
  assessment: "#a855f7",
  "clinical-reasoning": "#ec4899",
  procedures: "#14b8a6",
  fundamentals: "#eab308",
};

function KnowledgeWebInner() {
  const { getToken, account } = useZoAuth();
  const tier = getPlanTier(account);
  const isPro = isProOrHigher(account);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [web, setWeb] = useState<{ exists: boolean; nodes: Record<string, WebNode>; rootNodeIds: string[] }>({ exists: false, nodes: {}, rootNodeIds: [] });
  const [files, setFiles] = useState<UserFile[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalXp: 0, streak: 0 });
  const [dueNodes, setDueNodes] = useState<Array<{ nodeId: string; title: string; category: string; nextReview: string }>>([]);
  const [generating, setGenerating] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderMode, setBuilderMode] = useState<"new" | "add" | "topic">("new");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [webTopic, setWebTopic] = useState("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<WebNode | null>(null);
  const [panelView, setPanelView] = useState<"read" | "quiz" | "results">("read");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<any>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichFiles, setEnrichFiles] = useState<string[]>([]);
  const [viewScale, setViewScale] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } });
  }, [getToken]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [webRes, filesRes, statsRes, dueRes] = await Promise.all([
        authFetch("/api/web"),
        authFetch("/api/files"),
        authFetch("/api/user/stats"),
        authFetch("/api/web/due"),
      ]);
      if (webRes.ok) setWeb(await webRes.json());
      if (filesRes.ok) setFiles(await filesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (dueRes.ok) {
        const d = await dueRes.json();
        setDueNodes(d.due || []);
      }
    } catch (e) { setError("Failed to load."); }
    finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const generateWeb = async (mode: "new" | "add" | "topic") => {
    if (mode !== "topic" && !selectedFiles.length) return;
    if (mode === "topic" && !webTopic.trim()) return;
    setGenerating(true);
    try {
      let url = "/api/web/generate";
      let body: any = { fileIds: selectedFiles };
      if (mode === "add") url = "/api/web/add-files";
      if (mode === "topic") { url = "/api/web/generate-from-topic"; body = { topic: webTopic }; }
      const res = await authFetch(url, { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate"); return; }
      setShowBuilder(false); setSelectedFiles([]); setWebTopic("");
      setTimeout(() => fetchAll(), 2000);
    } catch { setError("Generation failed"); }
    finally { setGenerating(false); }
  };

  const openNode = async (node: WebNode) => {
    if (node.status === "locked") return;
    try {
      const res = await authFetch(`/api/web/nodes/${node.id}`);
      if (res.ok) {
        const fullNode = await res.json();
        setActiveNode(fullNode);
        setPanelView("read");
        setQuizAnswers({});
        setQuizResults(null);
      }
    } catch {}
  };

  const submitQuiz = async () => {
    if (!activeNode) return;
    setQuizSubmitting(true);
    try {
      const res = await authFetch(`/api/web/nodes/${activeNode.id}/quiz`, {
        method: "POST",
        body: JSON.stringify({ answers: quizAnswers }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuizResults(data);
        setPanelView("results");
        setTimeout(() => fetchAll(), 1000);
      }
    } catch {}
    setQuizSubmitting(false);
  };

  const expandNode = async (nodeId: string) => {
    setExpanding(nodeId);
    try {
      const res = await authFetch(`/api/web/nodes/${nodeId}/expand`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setTimeout(() => fetchAll(), 2000);
    } catch {}
    setExpanding(null);
  };

  const enrichNode = async () => {
    if (!activeNode || !enrichFiles.length) return;
    setEnriching(true);
    try {
      const res = await authFetch(`/api/web/nodes/${activeNode.id}/enrich`, {
        method: "POST",
        body: JSON.stringify({ fileIds: enrichFiles }),
      });
      if (res.ok) {
        setTimeout(() => { fetchAll(); openNode(activeNode); }, 2000);
        setEnrichFiles([]);
      }
    } catch {}
    setEnriching(false);
  };

  // SVG pan/zoom
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as any).tagName === "svg") {
      setDragging(true);
      setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
    }
  };
  const handleSvgMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setViewOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleSvgMouseUp = () => setDragging(false);

  const nodes = Object.values(web.nodes);
  const svgWidth = 2000;
  const svgHeight = 2000;
  const centerX = svgWidth / 2 + viewOffset.x;
  const centerY = svgHeight / 2 + viewOffset.y;
  const nodeRadius = 32;
  const rootNodeIds = web.rootNodeIds || [];

  const filteredNodes = categoryFilter
    ? nodes.filter(n => n.category === categoryFilter)
    : nodes;

  const categoriesSeen = [...new Set(nodes.map(n => n.category))];

  // Compute locked count
  const lockedCount = nodes.filter(n => n.status === "locked").length;
  const masteredCount = nodes.filter(n => n.status === "mastered").length;
  const availableCount = nodes.filter(n => n.status === "available").length;
  const totalNodeCount = nodes.length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background text-white relative">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/pathways" className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Pathways
            </Link>
            <div className="h-5 w-px bg-border" />
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Knowledge Web
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isPro && (
              <>
                {web.exists && (
                  <button onClick={() => { setBuilderMode("add"); setShowBuilder(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-white text-xs font-medium transition-all">
                    <Upload className="w-3.5 h-3.5" /> Add Files
                  </button>
                )}
                <button onClick={() => { setBuilderMode("new"); setShowBuilder(true); }} disabled={!isPro} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-xs font-medium text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-3.5 h-3.5" /> From Topic
                </button>
                <button onClick={() => { setBuilderMode("new"); setShowBuilder(true); }} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/80 text-white text-xs font-semibold transition-all">
                  <Plus className="w-3.5 h-3.5" /> {web.exists ? "New Web" : "Create Web"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {web.exists && totalNodeCount > 0 && (
          <div className="max-w-full mx-auto px-4 pb-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1">
              <Network className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">{totalNodeCount}</span>
              <span className="text-xs text-muted-foreground">concepts</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-800/30 rounded-lg px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">{masteredCount}</span>
              <span className="text-xs text-muted-foreground">mastered</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-800/30 rounded-lg px-2.5 py-1">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">{availableCount}</span>
              <span className="text-xs text-muted-foreground">available</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/40 border border-slate-700/30 rounded-lg px-2.5 py-1">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-400">{lockedCount}</span>
              <span className="text-xs text-muted-foreground">locked</span>
            </div>
            {stats.streak > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-900/20 border border-orange-800/30 rounded-lg px-2.5 py-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-orange-300">{stats.streak}d</span>
              </div>
            )}
            {stats.totalXp > 0 && (
              <div className="flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-2.5 py-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-300">{stats.totalXp} XP</span>
              </div>
            )}
            {/* Category filter */}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setCategoryFilter(null)} className={`px-2 py-0.5 rounded text-xs font-medium transition ${!categoryFilter ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>All</button>
              {categoriesSeen.slice(0, 6).map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)} className={`px-2 py-0.5 rounded text-xs font-medium transition whitespace-nowrap`} style={{ backgroundColor: categoryFilter === cat ? `${CAT_COLORS[cat]}20` : "transparent", color: categoryFilter === cat ? CAT_COLORS[cat] : undefined }}>
                  {cat.replace("-", " ")}
                </button>
              ))}
            </div>
            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button onClick={() => setViewScale(s => Math.max(0.3, s - 0.1))} className="p-1 rounded text-muted-foreground hover:text-white"><Minimize2 className="w-3.5 h-3.5" /></button>
              <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(viewScale * 100)}%</span>
              <button onClick={() => setViewScale(s => Math.min(2, s + 0.1))} className="p-1 rounded text-muted-foreground hover:text-white"><Maximize2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setViewScale(1); setViewOffset({ x: 0, y: 0 }); }} className="p-1 rounded text-muted-foreground hover:text-white" title="Reset view"><RotateCcw className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="absolute top-24 left-4 z-30 bg-red-900/70 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2 backdrop-blur">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">×</button>
        </div>
      )}

      {/* Main SVG Canvas */}
      {web.exists && totalNodeCount > 0 ? (
        <div className="absolute inset-0 top-[88px] overflow-hidden" style={{ cursor: dragging ? "grabbing" : "grab" }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${-svgWidth/2 - viewOffset.x} ${-svgHeight/2 - viewOffset.y} ${svgWidth} ${svgHeight}`}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
            style={{ transform: `scale(${viewScale})`, transformOrigin: "center center" }}
          >
            {/* Edges: prerequisite lines */}
            {Object.entries(web.nodes).map(([id, node]) =>
              (node.prerequisites || []).map(preReqId => {
                const parent = web.nodes[preReqId];
                if (!parent?.position || !node.position) return null;
                const isVisible = !categoryFilter || node.category === categoryFilter || parent.category === categoryFilter;
                const isHovered = hoveredNode === id || hoveredNode === preReqId;
                return (
                  <line
                    key={`${preReqId}-${id}`}
                    x1={centerX + parent.position.x}
                    y1={centerY + parent.position.y}
                    x2={centerX + node.position.x}
                    y2={centerY + node.position.y}
                    stroke={isHovered ? "rgba(139, 92, 246, 0.6)" : "rgba(100, 100, 120, 0.25)"}
                    strokeWidth={isHovered ? 2 : 1}
                    opacity={isVisible ? 1 : 0.1}
                  />
                );
              })
            )}

            {/* Nodes */}
            {nodes.map(node => {
              const pos = node.position || { x: 0, y: 0 };
              const isRoot = rootNodeIds.includes(node.id);
              const isVisible = !categoryFilter || node.category === categoryFilter;
              const catColor = CAT_COLORS[node.category] || "#888";
              const isHovered = hoveredNode === node.id;
              const isDue = dueNodes.some(d => d.nodeId === node.id);
              const hasChildren = nodes.some(n => (n.prerequisites || []).includes(node.id));

              let ringColor = "transparent";
              let innerColor = "rgba(30, 30, 40, 0.9)";
              if (node.status === "locked") { innerColor = "rgba(20, 20, 30, 0.6)"; ringColor = "rgba(80, 80, 100, 0.4)"; }
              else if (node.status === "mastered") { innerColor = "rgba(34, 197, 94, 0.2)"; ringColor = "rgba(34, 197, 94, 0.6)"; }
              else if (node.status === "in-progress") { innerColor = "rgba(234, 179, 8, 0.15)"; ringColor = "rgba(234, 179, 8, 0.5)"; }
              else if (node.status === "available") { innerColor = "rgba(40, 40, 55, 0.85)"; ringColor = catColor; }

              const pulse = isDue ? { animation: "pulse 2s infinite" } : {};

              return (
                <g
                  key={node.id}
                  transform={`translate(${centerX + pos.x}, ${centerY + pos.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => openNode(node)}
                  style={{ cursor: node.status === "locked" ? "not-allowed" : "pointer", opacity: isVisible ? 1 : 0.15 }}
                >
                  {/* Root ring */}
                  {isRoot && (
                    <circle r={nodeRadius + 6} fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth={2} strokeDasharray="4 3" />
                  )}
                  {/* Outer ring */}
                  <circle r={nodeRadius + 3} fill="none" stroke={ringColor} strokeWidth={isHovered ? 3 : 2} style={pulse} />
                  {/* Inner circle */}
                  <circle r={nodeRadius} fill={innerColor} stroke={isHovered ? ringColor : "transparent"} strokeWidth={1} />
                  {/* Icon or initial */}
                  <text textAnchor="middle" dy="0.35em" fill={node.status === "mastered" ? CAT_COLORS[node.category] : node.status === "locked" ? "#666" : "#ccc"} fontSize={node.status === "mastered" ? 12 : 10} fontWeight="bold" fontFamily="sans-serif">
                    {node.status === "locked" ? "L" : node.status === "mastered" ? "✓" : node.title.slice(0, 2).toUpperCase()}
                  </text>
                  {/* Mastered tick overlay */}
                  {node.status === "mastered" && (
                    <g>
                      <circle r={nodeRadius} fill="none" stroke="rgba(34, 197, 94, 0.5)" strokeWidth={2.5} />
                      <line x1={-6} y1={0} x2={-2} y2={4} stroke="#22c55e" strokeWidth={2} strokeLinecap="round" />
                      <line x1={-2} y1={4} x2={7} y2={-5} stroke="#22c55e" strokeWidth={2} strokeLinecap="round" />
                    </g>
                  )}
                  {/* Label */}
                  <text textAnchor="middle" y={nodeRadius + 14} fill={isHovered ? "#fff" : "#999"} fontSize={11} fontFamily="sans-serif" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                    {node.title.slice(0, 20)}{node.title.length > 20 ? "…" : ""}
                  </text>
                  {/* Category dot */}
                  <circle cx={nodeRadius - 5} cy={-nodeRadius + 5} r={4} fill={catColor} />
                  {/* Due indicator */}
                  {isDue && node.status === "mastered" && (
                    <circle cx={-nodeRadius + 5} cy={-nodeRadius + 5} r={5} fill="#3b82f6" stroke="#1e40af" strokeWidth={1}>
                      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Children indicator */}
                  {hasChildren && (
                    <circle cx={0} cy={nodeRadius + 5} r={3} fill="rgba(139, 92, 246, 0.5)" />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur border border-border rounded-xl px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border-2 border-violet-500" /> Available</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500/30 border-2 border-emerald-500" /> Mastered</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-700/60 border-2 border-slate-600" /> Locked</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border-2 border-blue-500" /> Due</span>
            <span className="flex items-center gap-1 ml-2"><div className="w-2 h-2 rounded-full bg-purple-500/50" /> Has children</span>
          </div>

          {/* Due nodes list */}
          {dueNodes.length > 0 && (
            <div className="absolute top-4 right-4 z-20 bg-card/90 backdrop-blur border border-blue-700/30 rounded-xl p-3 w-64">
              <p className="text-xs font-semibold text-blue-300 flex items-center gap-1.5 mb-2"><Bell className="w-3 h-3" /> Due for Review</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {dueNodes.slice(0, 5).map(dn => (
                  <button key={dn.nodeId} onClick={() => { const n = web.nodes[dn.nodeId]; if (n) openNode(n); }} className="w-full text-left text-xs text-muted-foreground hover:text-white px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                    {dn.title}
                  </button>
                ))}
                {dueNodes.length > 5 && <p className="text-xs text-muted-foreground/60 px-2">+{dueNodes.length - 5} more</p>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 top-[88px] flex flex-col items-center justify-center">
          {!isPro ? (
            <div className="text-center bg-card/50 border border-violet-700/30 rounded-2xl p-8 max-w-md">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="text-white font-bold mb-1">Pro Feature</h2>
              <p className="text-muted-foreground text-sm mb-4">Upgrade to Pro to build an interconnected knowledge web from your study materials.</p>
              <Link to="/pricing" className="inline-block px-5 py-2 bg-primary hover:bg-primary/80 rounded-xl text-sm font-semibold">View Plans →</Link>
            </div>
          ) : (
            <div className="text-center">
              <Network className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg text-muted-foreground mb-1">No knowledge web yet</p>
              <p className="text-sm text-muted-foreground/60 mb-6">Upload your nursing notes or generate from a topic using AI</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setBuilderMode("new"); setShowBuilder(true); }} className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/80 rounded-xl text-sm font-semibold transition-all">
                  <FileText className="w-4 h-4" /> From Files
                </button>
                <button onClick={() => { setBuilderMode("topic"); setShowBuilder(true); }} className="inline-flex items-center gap-2 px-6 py-3 bg-violet-800/60 hover:bg-violet-700/60 border border-violet-700/40 rounded-xl text-sm font-semibold transition-all">
                  <Sparkles className="w-4 h-4" /> From AI Topic
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Builder modal */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-lg">{builderMode === "topic" ? "Generate from AI" : builderMode === "add" ? "Add to Knowledge Web" : "Build Knowledge Web"}</h2>
              <button onClick={() => setShowBuilder(false)} className="text-muted-foreground hover:text-white"><XCircle className="w-5 h-5" /></button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              {(["new","add","topic"] as const).map(m => (
                <button key={m} onClick={() => { setBuilderMode(m); setSelectedFiles([]); setWebTopic(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    builderMode === m ? "bg-primary/20 border border-primary text-primary" : "bg-card/60 border border-border text-muted-foreground hover:text-white"
                  }`}>
                  {m === "new" ? "From Files" : m === "add" ? "Add to Web" : "From AI Topic"}
                </button>
              ))}
            </div>

            {builderMode === "topic" ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">Enter a topic and MAIA will generate a full knowledge web from scratch — no files needed.</p>
                <input
                  value={webTopic}
                  onChange={e => setWebTopic(e.target.value)}
                  placeholder="e.g. Cardiac Pharmacology, IV Therapy, Wound Care..."
                  className="w-full bg-card/60 border border-border/80 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary"
                />
                <button onClick={() => generateWeb("topic")} disabled={generating || !webTopic.trim()} className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Knowledge Web</>}
                </button>
              </div>
            ) : (
              <>
            <p className="text-muted-foreground text-sm mb-4">
              {builderMode === "add"
                ? "Select files to add new concepts and enrich existing ones in your web."
                : "Select files and MAIA will create a full interconnected knowledge web with concepts, connections, and quizzes."}
            </p>
            {files.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground/80 text-sm">
                No files yet. <Link to="/files" className="text-primary hover:underline">Upload files first →</Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-5">
                {files.map((f) => (
                  <label key={f.id} className="flex items-center gap-3 bg-card/60 border border-border/80 rounded-xl px-3 py-2 cursor-pointer">
                    <input type="checkbox" checked={selectedFiles.includes(f.id)} onChange={(e) => setSelectedFiles(prev => e.target.checked ? [...prev, f.id] : prev.filter(id => id !== f.id))} className="accent-primary" />
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-white text-sm truncate">{f.name}</span>
                  </label>
                ))}
              </div>
            )}
            <button onClick={() => generateWeb(builderMode)} disabled={generating || !selectedFiles.length} className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> {builderMode === "new" ? "Generate Knowledge Web" : "Add to Web"}</>}
            </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Node Detail Panel */}
      {activeNode && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveNode(null)} />
          <div className="relative w-full max-w-xl bg-card border-l border-border overflow-y-auto animate-slide-in">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${CAT_COLORS[activeNode.category]}20`, color: CAT_COLORS[activeNode.category] }}>
                    {activeNode.category.replace("-", " ")}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeNode.status === "mastered" ? "bg-emerald-900/30 text-emerald-300" :
                    activeNode.status === "in-progress" ? "bg-amber-900/30 text-amber-300" :
                    activeNode.status === "available" ? "bg-violet-900/30 text-violet-300" :
                    "bg-slate-800 text-slate-400"
                  }`}>
                    {activeNode.status}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{activeNode.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                {panelView !== "read" && (
                  <button onClick={() => setPanelView("read")} className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-muted">
                    <BookOpen className="w-4 h-4" />
                  </button>
                )}
                {panelView !== "quiz" && activeNode.quiz?.length > 0 && (
                  <button onClick={() => { setPanelView("quiz"); setQuizAnswers({}); setQuizResults(null); }} className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-muted">
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setActiveNode(null)} className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-muted">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              {/* Panel view: Read */}
              {panelView === "read" && (
                <div className="space-y-6">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{activeNode.content}</ReactMarkdown>
                  </div>

                  {/* Prerequisites */}
                  {activeNode.prerequisites?.length > 0 && (
                    <div className="bg-card/60 border border-border rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <GitBranch className="w-3 h-3" /> Prerequisites
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {activeNode.prerequisites.map(preId => {
                          const pn = web.nodes[preId];
                          return pn ? (
                            <button key={preId} onClick={() => openNode(pn)} className="px-3 py-1 rounded-lg border border-border bg-card/40 text-xs text-muted-foreground hover:text-white hover:border-primary/50 transition-all flex items-center gap-1.5">
                              {pn.status === "mastered" ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-slate-500" />}
                              {pn.title}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Related */}
                  {activeNode.related?.length > 0 && (
                    <div className="bg-card/60 border border-border rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Network className="w-3 h-3" /> Related Concepts
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {activeNode.related.map(relId => {
                          const rn = web.nodes[relId];
                          if (!rn) return null;
                          const catColor = CAT_COLORS[rn.category] || "#888";
                          return (
                            <button key={relId} onClick={() => openNode(rn)}
                              className="px-3 py-1 rounded-lg border text-xs transition-all hover:text-white hover:border-current flex items-center gap-1.5"
                              style={{ borderColor: `${catColor}30`, color: catColor, backgroundColor: `${catColor}08` }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                              {rn.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expand */}
                  <button
                    onClick={() => expandNode(activeNode.id)}
                    disabled={expanding === activeNode.id}
                    className="w-full py-2.5 rounded-xl border border-violet-800/40 bg-violet-900/15 text-violet-300 hover:bg-violet-900/25 text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {expanding === activeNode.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                    Expand from this Concept
                  </button>

                  {/* Enrich */}
                  <div className="bg-card/60 border border-border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Enrich with more content</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                      {files.filter(f => !enrichFiles.includes(f.id)).slice(0, 10).map(f => (
                        <label key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={enrichFiles.includes(f.id)} onChange={(e) => setEnrichFiles(prev => e.target.checked ? [...prev, f.id] : prev.filter(id => id !== f.id))} className="accent-primary" />
                          {f.name}
                        </label>
                      ))}
                      {files.length === 0 && <p className="text-xs text-muted-foreground/60">No files uploaded yet.</p>}
                    </div>
                    <button onClick={enrichNode} disabled={enriching || !enrichFiles.length} className="w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-all disabled:opacity-50">
                      {enriching ? "Enriching…" : "Enrich with Selected Files"}
                    </button>
                  </div>

                  {/* Quiz CTA */}
                  {activeNode.quiz?.length > 0 && activeNode.status !== "mastered" && (
                    <button onClick={() => { setPanelView("quiz"); setQuizAnswers({}); setQuizResults(null); }} className="w-full py-3 bg-primary hover:bg-primary/80 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all">
                      <Star className="w-4 h-4" /> Take Quiz ({activeNode.quiz.length} questions)
                    </button>
                  )}
                </div>
              )}

              {/* Panel view: Quiz */}
              {panelView === "quiz" && (
                <div className="space-y-6">
                  <h3 className="text-white font-semibold">Quiz: {activeNode.title}</h3>
                  {activeNode.quiz.map((q, i) => (
                    <div key={q.id} className="bg-card/60 border border-border rounded-xl p-4">
                      <p className="text-sm font-medium text-white mb-3">{i + 1}. {q.question}</p>
                      <div className="space-y-2">
                        {q.options.map(opt => (
                          <label key={opt} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                            quizAnswers[q.id] === opt
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/50"
                          }`}>
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={quizAnswers[q.id] === opt}
                              onChange={(e) => setQuizAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              className="accent-primary"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={submitQuiz}
                    disabled={quizSubmitting || Object.keys(quizAnswers).length < activeNode.quiz.length}
                    className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {quizSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : "Submit Answers"}
                  </button>
                </div>
              )}

              {/* Panel view: Results */}
              {panelView === "results" && quizResults && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${
                      quizResults.mastered ? "bg-emerald-900/50 border-2 border-emerald-500" :
                      quizResults.pct >= 70 ? "bg-amber-900/50 border-2 border-amber-500" :
                      "bg-red-900/50 border-2 border-red-500"
                    }`}>
                      <span className="text-2xl font-bold">{quizResults.correct}/{quizResults.total}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg">
                      {quizResults.mastered ? "Concept Mastered! 🎉" : quizResults.pct >= 70 ? "Good Progress" : "Keep Studying"}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      {quizResults.mastered
                        ? `You earned ${quizResults.xpEarned} XP and unlocked ${quizResults.newlyUnlocked?.length || 0} new concepts.`
                        : `${quizResults.pct}% correct — you need 80% to master this concept.`}
                    </p>
                    {quizResults.sm2 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Next review: {new Date(quizResults.sm2.nextReview).toLocaleDateString()} ({quizResults.sm2.interval > 1 ? `${quizResults.sm2.interval}d` : "tomorrow"})
                      </p>
                    )}
                  </div>

                  {/* Newly unlocked */}
                  {quizResults.newlyUnlocked?.length > 0 && (
                    <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-emerald-300 mb-2">🔓 New Concepts Unlocked</p>
                      <div className="space-y-1">
                        {quizResults.newlyUnlocked.map((n: any) => (
                          <button key={n.id} onClick={() => { const node = web.nodes[n.id]; if (node) openNode(node); }} className="block w-full text-left px-3 py-1.5 rounded-lg text-sm text-emerald-200 hover:bg-emerald-900/30 transition-colors">
                            → {n.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-question results */}
                  <div className="space-y-3">
                    {activeNode.quiz.map((q, i) => {
                      const result = quizResults.results?.[q.id];
                      return (
                        <div key={q.id} className={`rounded-xl p-4 border ${
                          result?.correct ? "bg-emerald-900/15 border-emerald-700/30" : "bg-red-900/15 border-red-700/30"
                        }`}>
                          <p className="text-sm font-medium text-white mb-1">
                            {result?.correct ? "✓" : "✗"} {i + 1}. {q.question}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Your answer: <span className={result?.correct ? "text-emerald-400" : "text-red-400"}>{quizAnswers[q.id] || "—"}</span>
                            {!result?.correct && <span className="text-emerald-400 ml-2">Correct: {q.correctOption}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground/80 mt-1">{q.explanation}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setPanelView("read"); setQuizAnswers({}); setQuizResults(null); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-white text-sm font-medium transition-all">
                      Review Content
                    </button>
                    {!quizResults.mastered && (
                      <button onClick={() => { setPanelView("quiz"); setQuizAnswers({}); setQuizResults(null); }} className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-all">
                        Retry Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KnowledgeWebPage() {
  return <AuthGate message="Sign in to explore your knowledge web."><KnowledgeWebInner /></AuthGate>;
}
