import { Chrome, Loader2 } from "lucide-react";
import { useZoAuth } from "../lib/auth";

export default function AuthCallback() {
  const { signInWithGoogle, loading, user } = useZoAuth();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-2xl shadow-violet-950/30 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center mb-5">
          {loading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Chrome className="w-7 h-7 text-white" />}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Login to Bio-Sync Academy</h1>
        <p className="text-muted-foreground text-sm mb-6">
          {user ? `You're signed in as ${user.email}.` : "Use your Google account to save conversations and manage your account."}
        </p>
        {user ? (
          <a href="/" className="inline-flex items-center justify-center w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/80 transition-colors">
            Continue to M.A.I.A
          </a>
        ) : (
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-60 transition-colors"
          >
            <Chrome className="w-5 h-5" />
            Continue with Google
          </button>
        )}
        <p className="mt-5 text-xs text-slate-600">Authentication is handled by this Zo-hosted site using Google OAuth.</p>
      </div>
    </div>
  );
}
