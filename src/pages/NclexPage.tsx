import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Brain } from "lucide-react";

interface NclexQuestion {
  id: string; type: string; topic: string; difficulty: string;
  stem: string; options: Array<{ id: string; text: string }>;
  correctAnswers: string[]; rationale: string;
  optionRationales: Record<string, string>;
}

export default function NclexPage() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("any");
  const [question, setQuestion] = useState<NclexQuestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const seenIds = useRef(new Set<string>());

  const fetchQuestion = useCallback(async () => {
    setLoading(true); setError(""); setSelected([]); setSubmitted(false);
    try {
      const res = await fetch("/api/nclex/bank-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ topic: topic.trim() || undefined, difficulty: difficulty !== "any" ? difficulty : undefined, excludeIds: [...seenIds.current] })
      });
      const data = await res.json();
      if (!res.ok || !data.question) { setError("No questions found for this topic. Try a different one."); setQuestion(null); return; }
      seenIds.current.add(data.question.id);
      if (seenIds.current.size > 200) { const arr = [...seenIds.current]; seenIds.current = new Set(arr.slice(-100)); }
      setQuestion(data.question);
    } catch { setError("Could not load question."); }
    finally { setLoading(false); }
  }, [topic, difficulty]);

  const toggleAnswer = (id: string) => {
    if (submitted || !question) return;
    if (question.type === "mcq") { setSelected([id]); return; }
    setSelected(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const sortedAnswers = (vals: string[]) => [...new Set(vals)].sort().join(",");

  const submitAnswer = () => {
    if (submitted || !question || selected.length === 0) return;
    const correct = sortedAnswers(selected) === sortedAnswers(question.correctAnswers);
    setScore(prev => ({ right: prev.right + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1) }));
    setSubmitted(true);
  };

  const total = score.right + score.wrong;
  const percent = total ? Math.round((score.right / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-emerald-400" />
            <h1 className="text-3xl font-bold text-white">Free NCLEX Practice</h1>
          </div>
          <p className="text-muted-foreground">Unlimited questions from our nursing question bank. No sign-in required.</p>
          {total > 0 && (
            <div className="mt-3 flex gap-4 text-sm">
              <span className="text-emerald-400">✓ {score.right} correct</span>
              <span className="text-red-400">✗ {score.wrong} wrong</span>
              <span className="text-muted-foreground">{percent}%</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic, e.g. pharmacology, cardiac..." className="flex-1 min-w-[200px] rounded-xl border border-border/80 bg-card p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none" />
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="rounded-xl border border-border/80 bg-card px-4 py-3 text-sm text-white outline-none">
            <option value="any">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button onClick={fetchQuestion} disabled={loading} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next Question"}
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 mb-6 text-red-200 text-sm">{error}</div>}

        {question && (
          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="rounded-full bg-emerald-950 px-2 py-1 text-emerald-200">{question.type === "sata" ? "SATA" : "Multiple Choice"}</span>
              <span className="rounded-full bg-card/60 px-2 py-1">{question.difficulty}</span>
              <span>{question.topic}</span>
            </div>
            <p className="whitespace-pre-wrap text-base font-semibold leading-relaxed text-white">{question.stem}</p>
            <div className="space-y-3">
              {question.options.map(option => {
                const sel = selected.includes(option.id);
                const isCorrect = question.correctAnswers.includes(option.id);
                const showResult = submitted;
                const cls = showResult && isCorrect ? "border-emerald-500/70 bg-emerald-950/30" : showResult && sel && !isCorrect ? "border-red-500/70 bg-red-950/30" : sel ? "border-primary/70 bg-primary/10" : "border-border/80 bg-background/60 hover:border-border/40";
                return (
                  <button key={option.id} onClick={() => toggleAnswer(option.id)} className={`w-full rounded-xl border p-4 text-left transition ${cls}`}>
                    <div className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-xs font-bold text-white">{option.id}</span>
                      <div className="flex-1">
                        <div className="text-sm text-foreground/80">{option.text}</div>
                        {showResult && question.optionRationales?.[option.id] && (
                          <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${isCorrect ? "bg-emerald-950/40 text-emerald-200" : "bg-card/60 text-muted-foreground"}`}>
                            {isCorrect ? "✓ " : "✗ "}{question.optionRationales[option.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!submitted ? (
              <button onClick={submitAnswer} disabled={selected.length === 0} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50">Submit Answer</button>
            ) : (
              <div className={`rounded-xl border p-4 ${sortedAnswers(selected) === sortedAnswers(question.correctAnswers) ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100" : "border-red-500/40 bg-red-950/20 text-red-100"}`}>
                <div className="font-semibold">{sortedAnswers(selected) === sortedAnswers(question.correctAnswers) ? "✓ Correct!" : "✗ Incorrect"}</div>
                <div className="mt-1 text-sm">Correct answer{question.correctAnswers.length > 1 ? "s" : ""}: {question.correctAnswers.join(", ")}</div>
                <p className="mt-3 text-sm text-foreground/60">{question.rationale}</p>
              </div>
            )}
          </div>
        )}

        {!question && !loading && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Enter a topic and click "Next Question" to start practicing.</p>
            <p className="text-sm mt-2">Try: pharmacology, cardiac, pediatrics, fundamentals, maternal-child</p>
          </div>
        )}
      </div>
    </div>
  );
}
