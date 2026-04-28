import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables. Auth features will be disabled.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthUser {
  id: string;
  email: string;
  tier: string;
  isAdmin: boolean;
  subscription_tier: string;
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInWithFacebook(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInWithMicrosoft(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "microsoft",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Email sign-in error:", error);
    return null;
  }

  return getUserWithTier(data.user);
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Email sign-up error:", error);
    return null;
  }

  return getUserWithTier(data.user);
}

async function getUserWithTier(user: any): Promise<AuthUser | null> {
  if (!user) return null;

  const email = user.email;
  if (!email) return null;

  try {
    const response = await fetch("/api/oauth-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provider: "email" }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        return {
          id: user.id,
          email: result.user.email,
          tier: result.user.tier || "free",
          isAdmin: result.user.isAdmin || false,
          subscription_tier: result.user.subscription_tier || "free",
        };
      }
    }
  } catch (e) {
    console.error("Failed to fetch user tier:", e);
  }

  return {
    id: user.id,
    email,
    tier: "free",
    isAdmin: false,
    subscription_tier: "free",
  };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getUserWithTier(user);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const user = await getUserWithTier(session.user);
      callback(user);
    } else {
      callback(null);
    }
  });
}