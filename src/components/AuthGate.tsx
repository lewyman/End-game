import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useZoAuth } from "../lib/auth";

interface AuthGateProps {
  children: React.ReactNode;
  message?: string;
}

export default function AuthGate({ children, message = "Sign in to access this feature." }: AuthGateProps) {
  const { isSignedIn, loading, signInWithGoogle } = useZoAuth();

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!isSignedIn) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-card/60 border border-border/80 flex items-center justify-center mb-6">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Sign in required</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">{message}</p>
      <button
        onClick={signInWithGoogle}
        className="px-6 py-3 bg-primary hover:bg-primary/80 text-white font-semibold rounded-xl transition-all"
      >
        Sign in with Google
      </button>
      <Link to="/pricing" className="mt-4 text-sm text-muted-foreground/80 hover:text-primary transition-colors">
        View plans →
      </Link>
    </div>
  );

  return <>{children}</>;
}
