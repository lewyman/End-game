import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"loading" | "upgraded" | "already_pro" | "failed">("loading");

  useEffect(() => {
    if (!sessionId) { setStatus("failed"); return; }
    fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data.upgraded || data.plan === "pro") setStatus("upgraded");
        else if (data.status === "paid") setStatus("upgraded");
        else setStatus("failed");
      })
      .catch(() => setStatus("failed"));
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background px-4 py-20 text-white flex items-center justify-center">
      <div className="mx-auto max-w-xl rounded-3xl border p-8 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-14 w-14 text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Activating your Pro account…</h1>
            <p className="mt-3 text-muted-foreground">Verifying your payment, just a moment.</p>
          </>
        )}
        {(status === "upgraded" || status === "already_pro") && (
          <div className="border-emerald-500/30 bg-emerald-950/20 rounded-3xl p-2">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-400" />
            <h1 className="text-3xl font-bold">Welcome to Pro MAIA! 🎉</h1>
            <p className="mt-3 text-foreground/80">Your account has been upgraded. You now have 20 Pro MAIA messages per day.</p>
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <Link to="/" className="rounded-xl bg-primary px-5 py-3 font-semibold hover:bg-primary/80 transition-all">Start studying</Link>
              <Link to="/account" className="rounded-xl bg-card/60 px-5 py-3 font-semibold hover:bg-muted transition-all">View account</Link>
            </div>
          </div>
        )}
        {status === "failed" && (
          <div className="border-amber-500/30 bg-amber-950/20 rounded-3xl p-2">
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-amber-400" />
            <h1 className="text-2xl font-bold">Payment received</h1>
            <p className="mt-3 text-foreground/80">Your payment went through, but we couldn't verify your session automatically. Your account will be upgraded within a few minutes via our billing system.</p>
            <p className="mt-2 text-muted-foreground text-sm">If you're still on Free after 5 minutes, email us at <a href="mailto:christian.c.lewis@endgameenhancements.com" className="underline text-primary">christian.c.lewis@endgameenhancements.com</a></p>
            <Link to="/account" className="mt-6 inline-flex rounded-xl bg-card/60 px-5 py-3 font-semibold hover:bg-muted transition-all">Check account status</Link>
          </div>
        )}
      </div>
    </div>
  );
}
