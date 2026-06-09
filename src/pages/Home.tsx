import { Link } from "react-router-dom";
import { Activity, Bot, Brain, Calculator, CheckCircle2, Send, Sparkles, Wrench, ArrowRight } from "lucide-react";
import EducatorChat from "@/components/EducatorChat";
import { useZoAuth, getTrialDaysLeft, isInTrial } from "../lib/auth";
import { useState, useRef } from "react";

const features = [
  { icon: Bot, title: "MAIA nursing tutor", text: "Ask clinical, pharmacology, pathophysiology, and NCLEX questions with step-by-step teaching." },
  { icon: Calculator, title: "Clinical tools", text: "Use drug interaction screening, dosing label extraction, cascade graphs, and NCLEX practice." },
  { icon: Wrench, title: "AI tool builder", text: "Request nursing calculators and study tools. Approved tools become available to the community." },
  { icon: Brain, title: "Drug cards", text: "Search a large FDA-backed drug directory and study high-yield nursing considerations." },
];

export default function Home() {
  const { isSignedIn, signInWithGoogle, loading, account } = useZoAuth();
  const [guestMessage, setGuestMessage] = useState("");
  const [guestResponse, setGuestResponse] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestAsked, setGuestAsked] = useState(false);
  const [guestError, setGuestError] = useState("");
  const guestInputRef = useRef<HTMLInputElement>(null);

  const trialDays = getTrialDaysLeft(account);
  const inTrial = isInTrial(account);

  if (isSignedIn) {
    return (
      <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
        {inTrial && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-center text-sm text-amber-100">
            <span className="font-bold">🎉 {trialDays} day{trialDays !== 1 ? "s" : ""} left in your free Pro trial</span>
            {" — "}Full access to MAIA, NCLEX, Clinical Tools, and more.{' '}
            <Link to="/pricing" className="underline text-amber-300 font-semibold">Upgrade to keep it</Link>
          </div>
        )}
        <div className="text-center pt-6 pb-2 px-4">
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            The AI study partner built for nursing students
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <EducatorChat />
        </div>
      </div>
    );
  }

  async function handleGuestAsk() {
    const msg = guestMessage.trim();
    if (!msg || guestLoading) return;
    setGuestLoading(true);
    setGuestError("");
    setGuestResponse("");
    try {
      const res = await fetch("/api/educator", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ message: msg, messages: [{ role: "user", content: msg }], tier: "free" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setGuestError(data.error || "Something went wrong. Try signing in for full access.");
        if (data.upgradeRequired) setGuestAsked(true);
      } else {
        setGuestResponse(data.response || "");
        setGuestAsked(true);
      }
    } catch {
      setGuestError("Could not reach MAIA. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background px-4 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/50/30 px-4 py-2 text-sm text-violet-200">
              <Sparkles className="h-4 w-4" /> Built for nursing school, NCLEX prep, and clinical confidence
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
              The nursing study workspace that adapts to what you need today.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/80">
              Bio-Sync Academy combines MAIA, FDA-backed drug cards, clinical tools, an infinite NCLEX generator, and AI-generated study tools in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={signInWithGoogle} disabled={loading} className="rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-primary/80 disabled:opacity-60">
                Start 7-Day Free Pro Trial
              </button>
              <Link to="/pricing" className="rounded-2xl border border-border/80 px-6 py-3 font-bold text-foreground/60 hover:bg-card">
                View pricing
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> 7-day free Pro trial</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> No credit card required</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Educational safety-first design</span>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground border-t border-border/60 pt-6">
              <div>
                <span className="text-emerald-400 font-bold">1,200+</span> nursing students
              </div>
              <div>
                <span className="text-emerald-400 font-bold">4.9</span> ★ rating
              </div>
              <div>
                <span className="text-emerald-400 font-bold">134K+</span> drug entries
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-2xl shadow-violet-950/20">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 p-3"><Activity className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-bold">Try MAIA right now</h2>
                <p className="text-sm text-muted-foreground">One free question — no sign-in needed</p>
              </div>
            </div>

            {!guestAsked ? (
              <>
                <div className="mt-3 flex gap-2">
                  <input
                    ref={guestInputRef}
                    value={guestMessage}
                    onChange={(e) => setGuestMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGuestAsk(); }}
                    placeholder="Ask a nursing question, e.g. What are the signs of digoxin toxicity?"
                    className="flex-1 rounded-xl border border-border/80 bg-background p-3 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    disabled={guestLoading}
                  />
                  <button onClick={handleGuestAsk} disabled={guestLoading || !guestMessage.trim()} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/80 disabled:opacity-50 flex items-center gap-1.5">
                    {guestLoading ? <span className="animate-pulse">...</span> : <><Send className="h-4 w-4" /> Ask</>}
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="text-xs text-muted-foreground">Popular questions:</p>
                  {[
                    "Quiz me on beta-blockers",
                    "Explain serotonin syndrome",
                    "What are signs of digoxin toxicity?",
                  ].map((text) => (
                    <button
                      key={text}
                      onClick={() => { setGuestMessage(text); guestInputRef.current?.focus(); }}
                      className="block w-full text-left rounded-xl border border-border/60 bg-background/70 p-3 text-foreground/60 hover:border-violet-500/50 hover:text-white transition text-xs"
                    >{text}</button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {guestResponse && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm text-emerald-100 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {guestResponse}
                  </div>
                )}
                {guestError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">{guestError}</div>
                )}
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
                  <p className="font-bold text-lg mb-2">Want unlimited access?</p>
                  <p className="text-sm text-muted-foreground mb-4">Get 7 days of Pro MAIA, NCLEX questions, clinical tools, drug cards, and more — no credit card required.</p>
                  <button onClick={signInWithGoogle} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-violet-900/30 hover:bg-primary/80">
                    Start Free 7-Day Trial <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-border bg-card/60 p-5">
              <Icon className="h-7 w-7 text-primary/80" />
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 rounded-3xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-amber-100">
          Bio-Sync Academy is for education and study support only. It is not medical advice and does not replace instructors, pharmacists, providers, facility policy, or clinical judgment.
        </div>
      </div>
    </div>
  );
}
