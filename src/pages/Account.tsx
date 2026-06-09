import { useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Loader2, MessageSquare, ShieldCheck, XCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useZoAuth, getPlanTier, getDailyLimit, isProOrHigher, isInTrial, getTrialDaysLeft } from "../lib/auth";

export default function Account() {
  const { isSignedIn, user, account, usage, loading, signInWithGoogle, refresh } = useZoAuth();
  const [canceling, setCanceling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background px-4 py-20 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card/70 p-8 text-center">
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="mt-3 text-muted-foreground">Sign in to view your plan and daily MAIA usage.</p>
          <button onClick={signInWithGoogle} className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold hover:bg-primary/80">Sign in with Google</button>
        </div>
      </div>
    );
  }

  if (loading || !account) return <div className="min-h-screen bg-background px-4 py-20 text-center text-foreground/80"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;

  const tier = getPlanTier(account);
  const isPro = isProOrHigher(account);
  const subStatus = account.subscriptionStatus;
  const isCanceling = subStatus === "canceling" || subStatus === "cancel_at_period_end";
  const inTrial = isInTrial(account);
  const trialDaysLeft = getTrialDaysLeft(account);
  const planLimit = getDailyLimit(tier);
  const messageCount = usage?.messages ?? 0;
  const percent = planLimit ? Math.min(100, Math.round((messageCount / planLimit) * 100)) : 0;
  const periodEnd = account.currentPeriodEnd ? new Date(account.currentPeriodEnd * 1000).toLocaleDateString() : null;
  const planLabel = tier === "max" ? "Max" : tier === "pro_plus" ? "Pro Plus" : isPro ? "Pro MAIA" : "Free MAIA";

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel? You'll keep Pro access until the end of your billing period.")) return;
    setCanceling(true);
    setCancelMsg(null);
    try {
      const res = await fetch("/api/cancel-subscription", { method: "POST", headers: { Accept: "application/json" } });
      const data = await res.json() as any;
      if (res.ok && data.canceled) {
        setCancelMsg({ ok: true, text: `Subscription canceled. You'll keep Pro access until ${data.currentPeriodEnd ? new Date(data.currentPeriodEnd * 1000).toLocaleDateString() : "the end of your billing period"}.` });
        refresh();
      } else {
        setCancelMsg({ ok: false, text: data.error || "Cancel failed. Please try again." });
      }
    } catch {
      setCancelMsg({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setCanceling(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await fetch("/api/billing/sync-subscription", { method: "POST", headers: { Accept: "application/json" } });
      const data = await res.json() as any;
      if (res.ok && data.synced) {
        setVerifyMsg({ ok: true, text: `Account verified — ${data.plan === "pro" ? `Pro (${data.subscriptionStatus})` : "Free plan"}.` });
        refresh();
      } else {
        setVerifyMsg({ ok: false, text: data.error || data.message || "Verification failed." });
      }
    } catch {
      setVerifyMsg({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-20 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="mt-2 text-muted-foreground">Plan, billing, and MAIA usage for {user?.email}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {inTrial && (
            <div className="md:col-span-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-center text-sm text-amber-100">
              <span className="font-bold">🎉 {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your free Pro trial</span>
              {" — "}Full access. No credit card.{' '}
              <Link to="/pricing" className="underline text-amber-300 font-semibold">Choose a plan to keep it</Link>
            </div>
          )}
          {/* Plan card */}
          <div className={`rounded-3xl border p-6 ${isPro ? "border-primary/30 bg-primary/20" : "border-border/80 bg-card/70"}`}>
            <div className="flex items-center gap-3 mb-3">
              <Crown className={`h-6 w-6 ${isPro ? "text-primary/80" : "text-muted-foreground/80"}`} />
              <h2 className="text-xl font-bold">{planLabel}</h2>
            </div>

            <div className="space-y-1 text-sm text-foreground/80">
              <p>Status: <span className={`font-semibold ${isPro && !isCanceling ? "text-emerald-400" : isCanceling ? "text-amber-400" : "text-muted-foreground"}`}>
                {isCanceling ? "Canceling" : subStatus || (isPro ? "Active" : "Free")}
              </span></p>
              {periodEnd && <p className="text-muted-foreground">{isCanceling ? `Access ends: ${periodEnd}` : `Renews: ${periodEnd}`}</p>}
            </div>

            {!isPro && (
              <Link to="/pricing" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold hover:bg-primary/80 transition-all">
                Upgrade to Pro →
              </Link>
            )}

            {isPro && !isCanceling && (
              <div className="mt-5">
                <button
                  onClick={handleCancel}
                  disabled={canceling}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-950/60 hover:text-red-300 disabled:opacity-50 transition-all"
                >
                  {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {canceling ? "Canceling…" : "Cancel subscription"}
                </button>
                <p className="mt-2 text-xs text-muted-foreground/80">You'll keep Pro access until the end of your billing period.</p>
              </div>
            )}

            {isCanceling && (
              <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-300">
                Subscription canceled — Pro access active until {periodEnd || "end of billing period"}.
              </div>
            )}

            {cancelMsg && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${cancelMsg.ok ? "bg-emerald-950/30 text-emerald-300 border border-emerald-700/40" : "bg-red-950/30 text-red-300 border border-red-700/40"}`}>
                {cancelMsg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {cancelMsg.text}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border/80">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted hover:text-white disabled:opacity-50 transition-all"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {verifying ? "Checking Stripe…" : "Verify account status"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground/80">Syncs your account with Stripe to confirm your subscription.</p>
              {verifyMsg && (
                <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${verifyMsg.ok ? "bg-emerald-950/30 text-emerald-300 border border-emerald-700/40" : "bg-red-950/30 text-red-300 border border-red-700/40"}`}>
                  {verifyMsg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  {verifyMsg.text}
                </div>
              )}
            </div>
          </div>

          {/* Usage card */}
          <div className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="h-6 w-6 text-emerald-300" />
              <h2 className="text-xl font-bold">Daily MAIA usage</h2>
            </div>
            <p className="text-sm text-foreground/80">{messageCount} / {planLimit} messages used today</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-card/60">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground/80">Resets at midnight. Pro plan: {getDailyLimit("pro")} messages/day.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-amber-100">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Bio-Sync Academy is an educational study tool, not clinical advice. Always verify medication, dosage, and clinical decisions with your instructor, pharmacist, provider, and facility policy.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
