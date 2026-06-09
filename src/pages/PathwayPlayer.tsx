import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Flame, BookOpen, ChevronRight, Star, Zap, Lock, PlayCircle, Volume2, Image as ImageIcon, FileText, RotateCcw, GitBranch, PlusCircle, GripVertical } from "lucide-react";
import { useZoAuth } from "../lib/auth";
import { hasFeature, isProOrHigher } from "../lib/auth";
import AuthGate from "../components/AuthGate";
import ReactMarkdown from "react-markdown";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContentStep { id: string; type: "read" | "image" | "video" | "audio"; title?: string; content: string; caption?: string; duration?: number; }
interface QuizStep { id: string; type: "mcq" | "flashcard"; question: string; options?: string[]; correctOption?: string; answer: string; explanation?: string; hint?: string; }
interface OrderedStep { id: string; type: "ordered"; question: string; items: string[]; correctOrder: string[]; explanation?: string; }
interface FillBlankStep { id: string; type: "fill-blank"; question: string; blank: string; correctAnswers: string[]; caseSensitive?: boolean; explanation?: string; }
interface CaseStudyStep { id: string; type: "case-study"; scenario: string; questions: Array<{ id: string; text: string; options: string[]; correct: string; rationale: string }>; }
type PathwayStep = ContentStep | QuizStep | OrderedStep | FillBlankStep | CaseStudyStep;
interface PathwayBranch { id: string; title: string; condition: string; targetModuleId: string; }
interface PathwayLesson { id: string; title: string; steps: PathwayStep[]; xpReward: number; estimatedMinutes?: number; }
interface PathwayModule { id: string; title: string; lessons: PathwayLesson[]; branches?: PathwayBranch[]; }
interface Pathway { id: string; title: string; description: string; modules: PathwayModule[]; status: string; }
interface StepProgress { completed: boolean; correct?: boolean; attempts: number; }
interface LessonProgress { completed: boolean; xpEarned: number; steps: Record<string, StepProgress>; sm2?: { ease: number; interval: number; repetitions: number; nextReview: string }; }
interface PathwayProgressData { lessons: Record<string, LessonProgress>; totalXp: number; }
interface UserStats { totalXp: number; streak: number; longestStreak: number; lastStudiedDate: string; }

type ViewState = "loading" | "map" | "playing" | "lesson-complete" | "pathway-complete";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isQuizStep(s: PathwayStep): s is QuizStep { return s.type === "mcq" || s.type === "flashcard"; }
function isContentStep(s: PathwayStep): s is ContentStep { return s.type === "read" || s.type === "image" || s.type === "video" || s.type === "audio"; }
function isOrderedStep(s: PathwayStep): s is OrderedStep { return s.type === "ordered"; }
function isFillBlankStep(s: PathwayStep): s is FillBlankStep { return s.type === "fill-blank"; }
function isCaseStudyStep(s: PathwayStep): s is CaseStudyStep { return s.type === "case-study"; }

function getLessonStatus(lessonId: string, moduleIdx: number, lessonIdx: number, allLessons: { id: string }[], progress: PathwayProgressData): "locked" | "available" | "in-progress" | "complete" {
  if (progress.lessons[lessonId]?.completed) return "complete";
  if (moduleIdx === 0 && lessonIdx === 0) return "available";
  const prevLesson = allLessons[allLessons.findIndex(l => l.id === lessonId) - 1];
  if (prevLesson && progress.lessons[prevLesson.id]?.completed) return "available";
  const lp = progress.lessons[lessonId];
  if (lp && Object.keys(lp.steps).length > 0) return "in-progress";
  return "locked";
}

function countCorrect(lesson: PathwayLesson, lp?: LessonProgress): number {
  if (!lp) return 0;
  return lesson.steps.filter(s => isQuizStep(s) && lp.steps[s.id]?.correct).length;
}

function totalQuizSteps(lesson: PathwayLesson): number {
  return lesson.steps.filter(isQuizStep).length;
}

// ── Stars rating ──────────────────────────────────────────────────────────────
function calcStars(correct: number, total: number): number {
  if (total === 0) return 3;
  const pct = correct / total;
  if (pct >= 0.9) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

// ── Main component ─────────────────────────────────────────────────────────────
function Player() {
  const { id } = useParams<{ id: string }>();
  const { getToken, account } = useZoAuth();
  const canAddContent = isProOrHigher(account);
  const canBranch = hasFeature(account, "pathway_branching");

  const [view, setView] = useState<ViewState>("loading");
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [progress, setProgress] = useState<PathwayProgressData>({ lessons: {}, totalXp: 0 });
  const [stats, setStats] = useState<UserStats>({ totalXp: 0, streak: 0, longestStreak: 0, lastStudiedDate: "" });
  const [error, setError] = useState("");

  // Active lesson state
  const [activeLesson, setActiveLesson] = useState<PathwayLesson | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [quizState, setQuizState] = useState<"unanswered" | "correct" | "incorrect">("unanswered");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [flipped, setFlipped] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lessonResult, setLessonResult] = useState<{ xpEarned: number; stars: number; stats: UserStats; sm2Res?: string; sm2ResType?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sm2Result, setSm2Result] = useState<{ nextReview: string; interval: number; ease: number } | null>(null);
  const completedRef = useRef(false);

  const [addingContent, setAddingContent] = useState(false);
  const [addContentPrompt, setAddContentPrompt] = useState("");
  const [addContentError, setAddContentError] = useState("");

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } });
  }, [getToken]);

  // Load pathway + progress + stats
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [pwRes, progRes, statsRes] = await Promise.all([
          authFetch(`/api/pathways/${id}`),
          authFetch(`/api/pathways/${id}/progress`),
          authFetch("/api/user/stats"),
        ]);
        if (!pwRes.ok) throw new Error("Pathway not found");
        const pw = await pwRes.json() as Pathway;
        const prog = progRes.ok ? await progRes.json() as PathwayProgressData : { lessons: {}, totalXp: 0 };
        const st = statsRes.ok ? await statsRes.json() as UserStats : { totalXp: 0, streak: 0, longestStreak: 0, lastStudiedDate: "" };
        setPathway(pw);
        setProgress(prog);
        setStats(st);
        setView("map");
      } catch (e: any) {
        setError(e.message || "Failed to load");
        setView("map");
      }
    })();
  }, [id, authFetch]);

  const allLessonsFlat = pathway ? pathway.modules.flatMap(m => m.lessons) : [];

  // Start a lesson
  function startLesson(lesson: PathwayLesson) {
    completedRef.current = false;
    setActiveLesson(lesson);
    // Find first incomplete step
    const lp = progress.lessons[lesson.id];
    let startIdx = 0;
    if (lp && !lp.completed) {
      for (let i = 0; i < lesson.steps.length; i++) {
        if (!lp.steps[lesson.steps[i].id]?.completed) { startIdx = i; break; }
        startIdx = i + 1;
      }
      if (startIdx >= lesson.steps.length) startIdx = 0;
    }
    setStepIndex(startIdx);
    setQuizState("unanswered");
    setSelectedOption("");
    setFlipped(false);
    setAttempts(0);
    setLessonResult(null);
    setSm2Result(null);
    setView("playing");
  }

  const currentStep = activeLesson?.steps[stepIndex] ?? null;

  // Submit step progress to server (fire and forget for content, await for quiz)
  async function recordStep(stepId: string, result: "viewed" | "correct" | "incorrect", att: number) {
    if (!activeLesson) return;
    try {
      await authFetch(`/api/pathways/${id}/progress/step`, {
        method: "POST",
        body: JSON.stringify({ lessonId: activeLesson.id, stepId, result, attempts: att }),
      });
    } catch {}
  }

  async function completeLesson() {
    if (!activeLesson || completedRef.current) return;
    completedRef.current = true;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/pathways/${id}/progress/lesson`, {
        method: "POST",
        body: JSON.stringify({ lessonId: activeLesson.id }),
      });
      const data = res.ok ? await res.json() : { xpEarned: activeLesson.xpReward ?? 20, stats };
      const lp = progress.lessons[activeLesson.id];
      const correct = countCorrect(activeLesson, lp);
      const total = totalQuizSteps(activeLesson);
      const stars = calcStars(correct, total);
      const sm2Quality = stars >= 3 ? 4 : stars >= 2 ? 3 : 2;
      callSm2(activeLesson.id, sm2Quality);
      setLessonResult({ xpEarned: data.xpEarned ?? activeLesson.xpReward ?? 20, stars, stats: data.stats ?? stats });
      setStats(data.stats ?? stats);
      // Refresh progress
      const progRes = await authFetch(`/api/pathways/${id}/progress`);
      if (progRes.ok) setProgress(await progRes.json());
    } catch {}
    setSubmitting(false);
    setView("lesson-complete");
  }

  async function callSm2(lessonId: string, quality: number) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/pathways/${id}/sm2`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ lessonId, quality }),
      });
      if (res.ok) {
        const data = await res.json();
        setSm2Result({ nextReview: data.nextReview, interval: data.interval, ease: data.ease });
      }
    } catch { }
  }

  // Content step: user clicks Continue
  async function handleContentContinue() {
    if (!currentStep || !activeLesson) return;
    await recordStep(currentStep.id, "viewed", 1);
    // Update local progress optimistically
    setProgress(prev => {
      const lp = prev.lessons[activeLesson.id] ?? { completed: false, xpEarned: 0, steps: {} };
      return { ...prev, lessons: { ...prev.lessons, [activeLesson.id]: { ...lp, steps: { ...lp.steps, [currentStep.id]: { completed: true, attempts: 1 } } } } };
    });
    advanceStep();
  }

  function advanceStep() {
    if (!activeLesson) return;
    const next = stepIndex + 1;
    if (next >= activeLesson.steps.length) {
      completeLesson();
    } else {
      setStepIndex(next);
      setQuizState("unanswered");
      setSelectedOption("");
      setFlipped(false);
      setAttempts(0);
    }
  }

  // MCQ: check answer
  async function handleMcqCheck() {
    if (!currentStep || !isQuizStep(currentStep) || !selectedOption || !activeLesson) return;
    const att = attempts + 1;
    setAttempts(att);
    const correct = selectedOption === (currentStep.correctOption ?? currentStep.answer);
    setQuizState(correct ? "correct" : "incorrect");
    await recordStep(currentStep.id, correct ? "correct" : "incorrect", att);
    if (correct) {
      setProgress(prev => {
        const lp = prev.lessons[activeLesson.id] ?? { completed: false, xpEarned: 0, steps: {} };
        return { ...prev, lessons: { ...prev.lessons, [activeLesson.id]: { ...lp, steps: { ...lp.steps, [currentStep.id]: { completed: true, correct: true, attempts: att } } } } };
      });
    }
  }

  // Flashcard: flip then rate
  async function handleFlashcardContinue() {
    if (!currentStep || !activeLesson) return;
    if (!flipped) { setFlipped(true); return; }
    const correct = quizState === "correct";
    await recordStep(currentStep.id, correct ? "correct" : "viewed", attempts + 1);
    setProgress(prev => {
      const lp = prev.lessons[activeLesson.id] ?? { completed: false, xpEarned: 0, steps: {} };
      return { ...prev, lessons: { ...prev.lessons, [activeLesson.id]: { ...lp, steps: { ...lp.steps, [currentStep.id]: { completed: true, correct, attempts: attempts + 1 } } } } };
    });
    advanceStep();
  }

  async function handleAddContent() {
    if (!addContentPrompt.trim() || !id) return;
    setAddingContent(true);
    setAddContentError("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/pathways/${id}/content`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ prompt: addContentPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add content");
      setAddContentPrompt("");
      const pwRes = await authFetch(`/api/pathways/${id}`);
      if (pwRes.ok) setPathway(await pwRes.json() as Pathway);
    } catch (e: any) {
      setAddContentError(e.message || "Failed to add content");
    } finally {
      setAddingContent(false);
    }
  }

  // ── RENDER: Loading ──────────────────────────────────────────────────────────
  if (view === "loading") return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  // ── RENDER: Lesson Complete ──────────────────────────────────────────────────
  if (view === "lesson-complete" && lessonResult && activeLesson) {
    const stars = lessonResult.stars;
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center px-4 py-16 gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="text-6xl mb-2 animate-bounce">🎉</div>
          <h1 className="text-3xl font-bold text-white">Lesson Complete!</h1>
          <p className="text-muted-foreground text-sm">{activeLesson.title}</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(n => (
            <Star key={n} className={`w-10 h-10 ${n <= stars ? "text-yellow-400 fill-yellow-400" : "text-slate-700"}`} />
          ))}
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-1 bg-primary/60/30 border border-violet-700/40 rounded-2xl px-6 py-4">
            <Zap className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-300">+{lessonResult.xpEarned}</span>
            <span className="text-xs text-muted-foreground">XP Earned</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-orange-900/30 border border-orange-700/40 rounded-2xl px-6 py-4">
            <Flame className="w-6 h-6 text-orange-400" />
            <span className="text-2xl font-bold text-orange-300">{lessonResult.stats.streak}</span>
            <span className="text-xs text-muted-foreground">Day Streak</span>
          </div>
        </div>
        {sm2Result && (
          <div className="bg-blue-950/30 border border-blue-700/30 rounded-2xl px-5 py-3 text-sm text-blue-300">
            <span className="font-semibold">📅 Review in {sm2Result.interval} {sm2Result.interval === 1 ? 'day' : 'days'}</span>
            <span className="text-blue-400/60 ml-2">· Next: {new Date(sm2Result.nextReview).toLocaleDateString()}</span>
          </div>
        )}
        {/* Check if pathway is complete */}
        {(() => {
          const allDone = pathway?.modules.flatMap(m => m.lessons).every(l => progress.lessons[l.id]?.completed);
          return allDone ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-4xl">🏆</span>
              <p className="text-primary/80 font-semibold">You completed the entire pathway!</p>
            </div>
          ) : null;
        })()}
        <button onClick={() => { setView("map"); setActiveLesson(null); }} className="px-8 py-3 bg-primary hover:bg-primary/80 rounded-2xl font-bold text-white transition-all">
          Continue →
        </button>
      </div>
    );
  }

  // ── RENDER: Step Player ──────────────────────────────────────────────────────
  if (view === "playing" && activeLesson && currentStep) {
    const totalSteps = activeLesson.steps.length;
    const progressPct = (stepIndex / totalSteps) * 100;
    const isContent = isContentStep(currentStep);
    const isQuiz = isQuizStep(currentStep);

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/60">
          <button onClick={() => { setView("map"); setActiveLesson(null); }} className="p-1 text-muted-foreground hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
          <div className="flex-1 h-2.5 bg-card/60 rounded-full overflow-hidden">
            <div className="h-full bg-primary/80 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground/80 font-mono shrink-0">{stepIndex + 1}/{totalSteps}</span>
        </div>

        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 gap-6">
          {/* Step type badge */}
          <div className="flex items-center gap-2">
            {isContent && <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4da6ff] bg-blue-900/30 px-2.5 py-1 rounded-full">
              {currentStep.type === "read" ? <FileText className="w-3 h-3" /> : currentStep.type === "video" ? <PlayCircle className="w-3 h-3" /> : currentStep.type === "audio" ? <Volume2 className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              {currentStep.type === "read" ? "Reading" : currentStep.type === "video" ? "Video" : currentStep.type === "audio" ? "Audio" : "Image"}
            </span>}
            {isQuiz && <span className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/60/30 px-2.5 py-1 rounded-full">
              <Star className="w-3 h-3" /> {currentStep.type === "mcq" ? "Question" : "Flashcard"}
            </span>}
            <span className="text-xs text-slate-600">{activeLesson.title}</span>
          </div>

          {/* ── READ STEP ─────────────────────────────────────────────────── */}
          {isContent && currentStep.type === "read" && (
            <div className="flex-1 flex flex-col gap-4">
              {(currentStep as ContentStep).title && <h2 className="text-xl font-bold text-white">{(currentStep as ContentStep).title}</h2>}
              <div className="flex-1 bg-card/60 border border-border/60 rounded-2xl p-5 overflow-y-auto prose prose-invert prose-sm max-w-none
                prose-headings:text-primary/80 prose-strong:text-white prose-p:text-foreground/80 prose-li:text-foreground/80">
                <ReactMarkdown>{(currentStep as ContentStep).content}</ReactMarkdown>
              </div>
              {(currentStep as ContentStep).duration && (
                <p className="text-xs text-slate-600 text-center">~{Math.ceil(((currentStep as ContentStep).duration ?? 60) / 60)} min read</p>
              )}
            </div>
          )}

          {/* ── IMAGE STEP ────────────────────────────────────────────────── */}
          {isContent && currentStep.type === "image" && (
            <div className="flex-1 flex flex-col gap-4">
              {(currentStep as ContentStep).title && <h2 className="text-xl font-bold text-white">{(currentStep as ContentStep).title}</h2>}
              <img src={(currentStep as ContentStep).content} alt={(currentStep as ContentStep).caption || "Learning content"} className="w-full rounded-2xl border border-border/60 object-cover" />
              {(currentStep as ContentStep).caption && <p className="text-sm text-muted-foreground text-center italic">{(currentStep as ContentStep).caption}</p>}
            </div>
          )}

          {/* ── VIDEO STEP ────────────────────────────────────────────────── */}
          {isContent && currentStep.type === "video" && (
            <div className="flex-1 flex flex-col gap-4">
              {(currentStep as ContentStep).title && <h2 className="text-xl font-bold text-white">{(currentStep as ContentStep).title}</h2>}
              <div className="aspect-video rounded-2xl overflow-hidden border border-border/60 bg-card">
                <iframe src={(currentStep as ContentStep).content} className="w-full h-full" allowFullScreen title={(currentStep as ContentStep).title} />
              </div>
              {(currentStep as ContentStep).caption && <p className="text-sm text-muted-foreground text-center italic">{(currentStep as ContentStep).caption}</p>}
            </div>
          )}

          {/* ── AUDIO STEP ────────────────────────────────────────────────── */}
          {isContent && currentStep.type === "audio" && (
            <div className="flex-1 flex flex-col items-center gap-6">
              {(currentStep as ContentStep).title && <h2 className="text-xl font-bold text-white text-center">{(currentStep as ContentStep).title}</h2>}
              <div className="w-24 h-24 rounded-full bg-primary/60/40 border-2 border-primary/80/50 flex items-center justify-center">
                <Volume2 className="w-10 h-10 text-primary" />
              </div>
              <audio controls className="w-full" src={(currentStep as ContentStep).content} />
              {(currentStep as ContentStep).caption && <p className="text-sm text-muted-foreground text-center italic">{(currentStep as ContentStep).caption}</p>}
            </div>
          )}

          {/* ── FILL-IN-BLANK STEP ────────────────────────────────────────── */}
          {isFillBlankStep(currentStep) && (() => {
            const q = currentStep as FillBlankStep;
            const answered = quizState !== "unanswered";
            return (
              <div className="flex-1 flex flex-col gap-5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-900/30 px-2.5 py-1 rounded-full w-fit">
                  <FileText className="w-3 h-3" /> Fill in the Blank
                </span>
                <h2 className="text-lg font-semibold text-white leading-snug">{q.question}</h2>
                <input
                  disabled={answered}
                  value={selectedOption}
                  onChange={e => setSelectedOption(e.target.value)}
                  placeholder={`Fill in: ${q.blank}`}
                  className="w-full rounded-xl border border-border/80 bg-card text-white px-4 py-3 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                />
                {answered && (
                  <div className={`rounded-xl p-4 text-sm ${quizState === "correct" ? "bg-emerald-900/30 border border-emerald-600/40 text-emerald-300" : "bg-red-900/30 border border-red-600/40 text-red-300"}`}>
                    <p className="font-semibold">{quizState === "correct" ? "✓ Correct!" : `✗ Expected: ${q.correctAnswers.join(" or ")}`}</p>
                    {q.explanation && <p className="mt-1 text-foreground/80">{q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── ORDERED STEP ──────────────────────────────────────────────── */}
          {isOrderedStep(currentStep) && (() => {
            const q = currentStep as OrderedStep;
            const answered = quizState !== "unanswered";
            const [orderedItems, setOrderedItems] = [selectedOption ? JSON.parse(selectedOption) : [...q.items], (items: string[]) => setSelectedOption(JSON.stringify(items))];
            return (
              <div className="flex-1 flex flex-col gap-5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-900/30 px-2.5 py-1 rounded-full w-fit">
                  <GripVertical className="w-3 h-3" /> Put in Order
                </span>
                <h2 className="text-lg font-semibold text-white leading-snug">{q.question}</h2>
                <div className="flex flex-col gap-2">
                  {(selectedOption ? JSON.parse(selectedOption) : q.items).map((item: string, idx: number) => (
                    <div key={item} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${answered ? (q.correctOrder[idx] === item ? "border-emerald-600/40 bg-emerald-900/20 text-emerald-300" : "border-red-600/40 bg-red-900/20 text-red-300") : "border-border/80 bg-card text-white"}`}>
                      <span className="text-muted-foreground/80 w-5 text-center font-mono text-xs">{idx + 1}</span>
                      <span className="flex-1">{item}</span>
                      {!answered && (
                        <div className="flex gap-1">
                          <button disabled={idx === 0} onClick={() => { const arr = [...(selectedOption ? JSON.parse(selectedOption) : q.items)]; [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; setSelectedOption(JSON.stringify(arr)); }} className="p-1 text-muted-foreground/80 hover:text-white disabled:opacity-20">↑</button>
                          <button disabled={idx === (selectedOption ? JSON.parse(selectedOption) : q.items).length - 1} onClick={() => { const arr = [...(selectedOption ? JSON.parse(selectedOption) : q.items)]; [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]]; setSelectedOption(JSON.stringify(arr)); }} className="p-1 text-muted-foreground/80 hover:text-white disabled:opacity-20">↓</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {answered && q.explanation && (
                  <div className="rounded-xl p-4 bg-card border border-border/80 text-sm text-foreground/80">{q.explanation}</div>
                )}
              </div>
            );
          })()}

          {/* ── CASE STUDY STEP ───────────────────────────────────────────── */}
          {isCaseStudyStep(currentStep) && (() => {
            const q = currentStep as CaseStudyStep;
            const answered = quizState !== "unanswered";
            const selected: Record<string, string> = selectedOption ? JSON.parse(selectedOption) : {};
            return (
              <div className="flex-1 flex flex-col gap-5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0d7a47] bg-fuchsia-900/30 px-2.5 py-1 rounded-full w-fit">
                  <BookOpen className="w-3 h-3" /> Case Study
                </span>
                <div className="rounded-2xl bg-card/80 border border-border p-4 text-sm text-foreground/80 leading-relaxed">
                  <ReactMarkdown>{q.scenario}</ReactMarkdown>
                </div>
                {q.questions.map((cq, cIdx) => (
                  <div key={cq.id} className="flex flex-col gap-2">
                    <p className="text-sm font-semibold text-white">{cIdx + 1}. {cq.text}</p>
                    <div className="flex flex-col gap-1.5">
                      {cq.options.map(opt => {
                        const picked = selected[cq.id] === opt;
                        const isCorrect = answered && opt === cq.correct;
                        const isWrong = answered && picked && opt !== cq.correct;
                        return (
                          <button key={opt} disabled={answered} onClick={() => { setSelectedOption(JSON.stringify({ ...selected, [cq.id]: opt })); }}
                            className={`text-left rounded-xl px-4 py-2.5 text-sm border transition ${isCorrect ? "border-emerald-600/50 bg-emerald-900/20 text-emerald-300" : isWrong ? "border-red-600/50 bg-red-900/20 text-red-300" : picked ? "border-primary/60 bg-primary/60/30 text-white" : "border-border/80 bg-card text-foreground/80 hover:border-border/60"}`}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {answered && <p className="text-xs text-muted-foreground italic">{cq.rationale}</p>}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── MCQ STEP ──────────────────────────────────────────────────── */}
          {isQuiz && currentStep.type === "mcq" && (() => {
            const q = currentStep as QuizStep;
            const answered = quizState !== "unanswered";
            return (
              <div className="flex-1 flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-white leading-snug">{q.question}</h2>
                <div className="flex flex-col gap-3">
                  {(q.options ?? []).map((opt) => {
                    const isSelected = selectedOption === opt;
                    const isCorrect = opt === (q.correctOption ?? q.answer);
                    let cls = "px-4 py-3.5 rounded-2xl border text-sm font-medium text-left transition-all ";
                    if (!answered) {
                      cls += isSelected ? "border-primary bg-primary/60/40 text-white" : "border-border/80 bg-card/60 text-foreground/80 hover:border-border/40 hover:text-white";
                    } else {
                      if (isCorrect) cls += "border-green-500 bg-green-900/30 text-green-200";
                      else if (isSelected && !isCorrect) cls += "border-red-500 bg-red-900/30 text-red-200";
                      else cls += "border-border bg-card/30 text-muted-foreground/80";
                    }
                    return (
                      <button key={opt} disabled={answered} onClick={() => setSelectedOption(opt)} className={cls}>
                        <span className="flex items-center gap-3">
                          {answered && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                          {answered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Feedback */}
                {answered && q.explanation && (
                  <div className={`rounded-2xl px-4 py-3 text-sm border ${quizState === "correct" ? "bg-green-900/20 border-green-700/40 text-green-200" : "bg-amber-900/20 border-amber-700/40 text-amber-200"}`}>
                    <p className="font-semibold mb-1">{quizState === "correct" ? "✓ Correct!" : "✗ Not quite"}</p>
                    <p>{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── FLASHCARD STEP ─────────────────────────────────────────────── */}
          {isQuiz && currentStep.type === "flashcard" && (() => {
            const q = currentStep as QuizStep;
            return (
              <div className="flex-1 flex flex-col gap-5">
                <div
                  onClick={() => !flipped && setFlipped(true)}
                  className={`flex-1 min-h-48 flex flex-col items-center justify-center rounded-2xl border p-6 text-center cursor-pointer transition-all duration-300 ${
                    flipped ? "bg-card/60/80 border-primary/80/40" : "bg-card/60 border-border/80/60 hover:border-border/40"
                  }`}
                >
                  {!flipped ? (
                    <>
                      <p className="text-muted-foreground text-xs mb-3 uppercase tracking-wider">Question — tap to flip</p>
                      <p className="text-white text-lg font-semibold">{q.question}</p>
                      {q.hint && <p className="mt-3 text-muted-foreground/80 text-sm italic">{q.hint}</p>}
                    </>
                  ) : (
                    <>
                      <p className="text-primary text-xs mb-3 uppercase tracking-wider">Answer</p>
                      <p className="text-white text-lg">{q.answer}</p>
                      {q.explanation && <p className="mt-3 text-muted-foreground text-sm">{q.explanation}</p>}
                    </>
                  )}
                </div>
                {flipped && (
                  <div className="flex gap-3">
                    <button onClick={() => { setQuizState("incorrect"); handleFlashcardContinue(); }} className="flex-1 py-3 rounded-2xl bg-red-900/40 border border-red-700/40 text-red-300 font-semibold text-sm hover:bg-red-900/60 transition-all">
                      ✗ Missed it
                    </button>
                    <button onClick={() => { setQuizState("correct"); handleFlashcardContinue(); }} className="flex-1 py-3 rounded-2xl bg-green-900/40 border border-green-700/40 text-green-300 font-semibold text-sm hover:bg-green-900/60 transition-all">
                      ✓ Got it
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Bottom action bar */}
        <div className="sticky bottom-0 px-4 pb-8 pt-4 bg-gradient-to-t from-slate-950 to-transparent">
          <div className="max-w-2xl mx-auto">
            {isContent && (
              <button onClick={handleContentContinue} className="w-full py-4 bg-primary hover:bg-primary/80 rounded-2xl font-bold text-white text-base transition-all active:scale-[0.98]">
                Continue <ChevronRight className="inline w-4 h-4" />
              </button>
            )}
            {isQuiz && currentStep.type === "mcq" && quizState === "unanswered" && (
              <button disabled={!selectedOption} onClick={handleMcqCheck} className="w-full py-4 bg-primary hover:bg-primary/80 disabled:bg-card/60 disabled:text-slate-600 rounded-2xl font-bold text-white text-base transition-all active:scale-[0.98]">
                Check Answer
              </button>
            )}
            {isQuiz && currentStep.type === "mcq" && quizState === "correct" && (
              <button onClick={advanceStep} className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-2xl font-bold text-white text-base transition-all active:scale-[0.98]">
                Continue <ChevronRight className="inline w-4 h-4" />
              </button>
            )}
            {isQuiz && currentStep.type === "mcq" && quizState === "incorrect" && (
              <div className="flex gap-3">
                <button onClick={() => { setQuizState("unanswered"); setSelectedOption(""); }} className="flex-1 py-4 bg-card/60 hover:bg-muted rounded-2xl font-bold text-white text-sm transition-all">
                  <RotateCcw className="inline w-4 h-4 mr-1" /> Try Again
                </button>
                <button onClick={advanceStep} className="flex-1 py-4 bg-muted hover:bg-muted/80 rounded-2xl font-bold text-foreground/80 text-sm transition-all">
                  Got it, continue →
                </button>
              </div>
            )}
            {isQuiz && currentStep.type === "flashcard" && !flipped && (
              <button onClick={() => setFlipped(true)} className="w-full py-4 bg-primary hover:bg-primary/80 rounded-2xl font-bold text-white text-base transition-all">
                Flip Card
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Map View ─────────────────────────────────────────────────────────
  if (!pathway) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="text-red-400">{error || "Pathway not found."}</p>
      <Link to="/pathways" className="text-primary hover:underline text-sm">← Back to Pathways</Link>
    </div>
  );

  const allLessons = pathway.modules.flatMap(m => m.lessons);
  const completedCount = allLessons.filter(l => progress.lessons[l.id]?.completed).length;
  const totalXp = pathway.modules.flatMap(m => m.lessons).reduce((sum, l) => sum + (l.xpReward ?? 20), 0);
  const earnedXp = progress.totalXp ?? 0;
  const overallPct = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/pathways" className="p-1.5 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-card/60">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate">{pathway.title}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex-1 h-1.5 bg-card/60 rounded-full overflow-hidden max-w-32">
                <div className="h-full bg-primary/80 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="text-xs text-muted-foreground/80">{overallPct}%</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 bg-orange-900/30 px-2.5 py-1 rounded-full border border-orange-800/40">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-bold text-orange-300">{stats.streak}</span>
            </div>
            <div className="flex items-center gap-1 bg-yellow-900/30 px-2.5 py-1 rounded-full border border-yellow-800/40">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-bold text-yellow-300">{earnedXp}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        {pathway.description && (
          <p className="text-muted-foreground text-sm mb-8 text-center">{pathway.description}</p>
        )}

        {/* Module / Lesson path */}
        {pathway.modules.map((mod, mIdx) => {
          const modLessons = mod.lessons;
          const modDone = modLessons.filter(l => progress.lessons[l.id]?.completed).length;
          return (
            <div key={mod.id} className="mb-10">
              {/* Module header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-card/60" />
                <div className="flex items-center gap-2 bg-card border border-border/80/60 rounded-full px-4 py-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground/80">{mod.title}</span>
                  <span className="text-xs text-slate-600">{modDone}/{modLessons.length}</span>
                </div>
                <div className="flex-1 h-px bg-card/60" />
              </div>

              {/* Lesson nodes */}
              <div className="flex flex-col items-center gap-0">
                {modLessons.map((lesson, lIdx) => {
                  const status = getLessonStatus(lesson.id, mIdx, lIdx, allLessons, progress);
                  const lp = progress.lessons[lesson.id];
                  const correct = countCorrect(lesson, lp);
                  const total = totalQuizSteps(lesson);
                  const stars = lp?.completed ? calcStars(correct, total) : 0;
                  const quizCount = lesson.steps.filter(isQuizStep).length;
                  const readCount = lesson.steps.filter(isContentStep).length;
                  const isLocked = status === "locked";
                  const isComplete = status === "complete";
                  const isActive = status === "available" || status === "in-progress";

                  return (
                    <div key={lesson.id} className="flex flex-col items-center w-full">
                      {/* Connector line */}
                      {lIdx > 0 && <div className={`w-0.5 h-6 ${isComplete ? "bg-primary/80" : "bg-card/60"}`} />}

                      <button
                        disabled={isLocked}
                        onClick={() => !isLocked && startLesson(lesson)}
                        className={`group relative w-full max-w-sm rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isComplete ? "bg-primary/60/20 border-violet-700/50 hover:bg-primary/60/30" :
                          isActive ? "bg-card/80 border-primary/80/60 hover:border-primary hover:bg-card shadow-lg shadow-violet-900/20" :
                          "bg-card/30 border-border/40 cursor-not-allowed opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isComplete ? "bg-primary" : isActive ? "bg-primary/60/60 border border-primary/80/50" : "bg-card/60"
                          }`}>
                            {isComplete ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                             isLocked ? <Lock className="w-4 h-4 text-slate-600" /> :
                             <BookOpen className="w-4 h-4 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${isLocked ? "text-slate-600" : "text-white"}`}>{lesson.title}</span>
                              {status === "in-progress" && <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700/40 px-1.5 py-0.5 rounded-full">In progress</span>}
                              {isComplete && lp?.sm2?.nextReview && (() => { const now = new Date().toISOString(); return lp.sm2.nextReview <= now ? <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded-full">Due for review</span> : null; })()}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                <FileText className="w-3 h-3" />{readCount} {readCount === 1 ? "reading" : "readings"}
                              </span>
                              <span className="text-xs text-muted-foreground/80 flex items-center gap-1">
                                <Star className="w-3 h-3" />{quizCount} {quizCount === 1 ? "question" : "questions"}
                              </span>
                              {lesson.estimatedMinutes && (
                                <span className="text-xs text-slate-600">~{lesson.estimatedMinutes}m</span>
                              )}
                            </div>
                            {/* Stars for completed */}
                            {isComplete && stars > 0 && (
                              <div className="flex gap-0.5 mt-1.5">
                                {[1,2,3].map(n => <Star key={n} className={`w-3 h-3 ${n <= stars ? "text-yellow-400 fill-yellow-400" : "text-slate-700"}`} />)}
                              </div>
                            )}
                          </div>
                          {/* XP badge */}
                          <div className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isComplete ? "text-primary bg-primary/60/30" : "text-muted-foreground/80 bg-card/60/60"}`}>
                            <Zap className="w-3 h-3" />{lesson.xpReward ?? 20}
                          </div>
                        </div>
                        {/* Progress bar for in-progress */}
                        {status === "in-progress" && lp && (() => {
                          const done = Object.values(lp.steps).filter(s => s.completed).length;
                          const tot = lesson.steps.length;
                          return (
                            <div className="mt-3 h-1 bg-card/60 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/80 rounded-full" style={{ width: `${(done/tot)*100}%` }} />
                            </div>
                          );
                        })()}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Branch options after module */}
              {mod.branches && mod.branches.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 items-center">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80 mb-1">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Branching paths available</span>
                  </div>
                  {mod.branches.map(branch => {
                    const targetMod = pathway.modules.find(m => m.id === branch.targetModuleId);
                    if (!targetMod) return null;
                    return (
                      <div key={branch.id} className="flex items-center gap-2 bg-card/60 border border-violet-800/30 rounded-xl px-4 py-2 text-sm max-w-sm w-full">
                        <GitBranch className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-white font-medium text-xs">{branch.title}</p>
                          <p className="text-muted-foreground/80 text-xs">{branch.condition}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/80" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Pathway completion */}
        {completedCount === allLessons.length && allLessons.length > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 bg-gradient-to-br from-violet-900/30 to-indigo-900/30 border border-violet-700/40 rounded-3xl p-8 text-center">
            <span className="text-5xl">🏆</span>
            <h3 className="text-xl font-bold text-white">Pathway Complete!</h3>
            <p className="text-muted-foreground text-sm">You've mastered all {allLessons.length} lessons and earned {earnedXp} XP.</p>
            <div className="flex gap-2 mt-2">
              {[1,2,3].map(n => <Star key={n} className="w-8 h-8 text-yellow-400 fill-yellow-400" />)}
            </div>
          </div>
        )}

        {/* Extend Pathway — Pro+ */}
        {canAddContent && pathway.status === "ready" && (
          <div className="mt-6 bg-card/50 border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" /> Extend this Pathway
            </h3>
            <p className="text-xs text-muted-foreground/80 mb-3">Add a new module on any topic. MAIA will generate lessons and questions and append them.</p>
            <div className="flex gap-2">
              <input
                value={addContentPrompt}
                onChange={e => setAddContentPrompt(e.target.value)}
                placeholder="e.g. Add a module on beta-blocker toxicity"
                className="flex-1 rounded-xl bg-card/60 border border-border/80 text-sm text-white px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleAddContent}
                disabled={addingContent || !addContentPrompt.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition"
              >
                {addingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </button>
            </div>
            {addContentError && <p className="text-red-400 text-xs mt-2">{addContentError}</p>}
          </div>
        )}

        {pathway.status === "generating" && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Generating your pathway…</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PathwayPlayerPage() {
  return <AuthGate><Player /></AuthGate>;
}
