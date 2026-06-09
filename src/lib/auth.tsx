import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export type PlanTier = "free" | "pro" | "pro_plus" | "max";

export interface AuthAccount {
  plan: PlanTier;
  subscriptionStatus?: string | null;
  tier?: PlanTier;
  trialEnd?: number | null;
  trialStart?: number | null;
  currentPeriodEnd?: number | null;
  isPro?: boolean;
}

export interface AuthUsage {
  messages: number;
  limit: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  account: AuthAccount | null;
  usage: AuthUsage | null;
  isSignedIn: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [usage, setUsage] = useState<AuthUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { headers: { Accept: "application/json" } });
      if (!res.ok) {
        setUser(null);
        setAccount(null);
        setUsage(null);
        return;
      }
      const data = await res.json() as { user?: AuthUser | null; account?: AuthAccount | null; usage?: AuthUsage | null };
      setUser(data.user ?? null);
      setAccount(data.account ?? null);
      setUsage(data.usage ?? null);
    } catch {
      setUser(null);
      setAccount(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signInWithGoogle = useCallback(() => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
    setUser(null);
    setAccount(null);
    setUsage(null);
  }, []);

  const getToken = useCallback(async () => {
    return user ? "zo-session" : null;
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    account,
    usage,
    isSignedIn: !!user,
    loading,
    refresh,
    signInWithGoogle,
    signOut,
    getToken,
  }), [user, account, usage, loading, refresh, signInWithGoogle, signOut, getToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useZoAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useZoAuth must be used inside AuthProvider");
  return value;
}

export function getPlanTier(account: AuthAccount | null | undefined): PlanTier {
  const t = account?.tier || account?.plan || "free";
  return (["free", "pro", "pro_plus", "max"].includes(t) ? t : "free") as PlanTier;
}

export function getDailyLimit(tier: PlanTier): number {
  if (tier === "max") return 150;
  if (tier === "pro_plus") return 50;
  if (tier === "pro") return 20;
  return 2;
}

export function getPathwayLimit(tier: PlanTier): number {
  if (tier === "max") return 150;
  if (tier === "pro_plus") return 50;
  if (tier === "pro") return 20;
  return 1;
}

export function getToolLimit(tier: PlanTier): number {
  if (tier === "max") return 100;
  if (tier === "pro_plus") return 20;
  if (tier === "pro") return 5;
  return 1;
}

export function isProOrHigher(account: AuthAccount | null | undefined): boolean {
  const tier = getPlanTier(account);
  return ["pro", "pro_plus", "max"].includes(tier);
}

export function isInTrial(account: AuthAccount | null | undefined): boolean {
  if (!account?.trialEnd) return false;
  if (account.subscriptionStatus && ["active", "trialing", "complete", "paid"].includes(account.subscriptionStatus)) return false;
  return Date.now() < account.trialEnd;
}

export function getTrialDaysLeft(account: AuthAccount | null | undefined): number {
  if (!account?.trialEnd) return 0;
  return Math.max(0, Math.ceil((account.trialEnd - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function hasFeature(account: AuthAccount | null | undefined, feature: "tutor_mode" | "timed_mode" | "custom_focus" | "pathway_branching" | "file_library" | "pathway_fork" | "manual_pathway" | "clinical_tools_advanced" | "sm2"): boolean {
  const tier = getPlanTier(account);
  switch (feature) {
    case "tutor_mode":
    case "timed_mode":
    case "file_library":
    case "pathway_branching":
    case "sm2":
      return ["pro_plus", "max"].includes(tier);
    case "custom_focus":
    case "clinical_tools_advanced":
      return tier === "max";
    case "pathway_fork":
    case "manual_pathway":
      return ["pro_plus", "max"].includes(tier);
    default:
      return false;
  }
}
