import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import path from "node:path";
import { 
  usersDir, usageDir, 
  FREE_MAIA_DAILY_LIMIT, PRO_MAIA_DAILY_LIMIT, PRO_PLUS_MAIA_DAILY_LIMIT, MAX_MAIA_DAILY_LIMIT,
  FREE_PATHWAY_LIMIT, PRO_PATHWAY_LIMIT, PRO_PLUS_PATHWAY_LIMIT, MAX_PATHWAY_LIMIT,
  FREE_TOOL_LIMIT, PRO_TOOL_LIMIT, PRO_PLUS_TOOL_LIMIT, MAX_TOOL_LIMIT,
  platformAdminEmails, PRO_MAIA_MODEL,
  type AuthUserRecord, type StoredUser,
} from "./constants";
import { safeId, ensureDir, readJsonFile, writeJsonFile } from "./storage";

export const sessionCookie = "biosync_session";
export const guestSessionCookie = "biosync_guest";
export const oauthCookie = "biosync_oauth_state";

export function authSecret(): string {
  return process.env.BIOSYNC_AUTH_SECRET || process.env.ZO_HOST_SERVICE_JWT || process.env.ZO_CLIENT_IDENTITY_TOKEN || "bio-sync-dev-secret";
}

export function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function getBaseUrl(c: any): string {
  const forwardedProto = c.req.header("x-forwarded-proto") || "";
  const proto = forwardedProto.includes("https") ? "https" : "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  return `${proto}://${host}`;
}

export function getCookie(c: any, name: string): string | null {
  const raw = c.req.header("cookie") || "";
  const found = raw.split(";").map((v: string) => v.trim()).find((v: string) => v.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function cookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function encodeSession(user: unknown): string {
  const payload = Buffer.from(JSON.stringify({ user, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | null): any | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function encodeGuestSession(payload: { id: string; createdAt: number }): string {
  const raw = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

export function decodeGuestSession(token: string | null): { id: string; createdAt: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return { id: String(parsed.id || ""), createdAt: Number(parsed.createdAt || 0) };
  } catch {
    return null;
  }
}

export async function ensureGuestSession(c: any) {
  const existing = decodeGuestSession(getCookie(c, guestSessionCookie));
  if (existing) return existing;
  const payload = { id: `guest_${randomBytes(8).toString("hex")}`, createdAt: Date.now() };
  return { payload, cookie: encodeGuestSession(payload) };
}

export function getCurrentUser(c: any): AuthUserRecord | null {
  return decodeSession(getCookie(c, sessionCookie));
}

export function requireCurrentUser(c: any): AuthUserRecord | null {
  return getCurrentUser(c);
}

function userPath(userId: string) {
  return path.join(usersDir, `${safeId(userId)}.json`);
}

async function getStoredUser(user: AuthUserRecord): Promise<StoredUser> {
  await ensureDir(usersDir);
  const existing = await readJsonFile<StoredUser | null>(userPath(user.id), null);
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const merged: StoredUser = {
    ...(existing || {} as any),
    id: user.id,
    email: user.email || existing?.email || "",
    name: user.name || existing?.name,
    picture: user.picture || existing?.picture,
    plan: existing?.plan || (["crusius00@gmail.com"].includes((user.email || "").toLowerCase()) ? "pro" : "pro"),
    trialStart: existing?.trialStart || nowMs,
    trialEnd: existing?.trialEnd || (nowMs + 7 * 24 * 60 * 60 * 1000),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await writeJsonFile(userPath(user.id), merged);
  return merged;
}

function getPlanTier(account: StoredUser | null | undefined): "free" | "pro" | "pro_plus" | "max" {
  if (!account) return "free";
  if (!["pro", "pro_plus", "max"].includes(account.plan || "")) return "free";
  if (account.subscriptionStatus && !["active", "trialing", "complete", "paid"].includes(account.subscriptionStatus)) {
    if (account.plan === "pro" && Date.now() < (account.trialEnd || 0)) return "pro";
    return "free";
  }
  if (account.plan === "pro") {
    if (Date.now() < (account.trialEnd || 0)) return "pro";
    if (!account.subscriptionStatus) return "free";
  }
  return account.plan as "pro" | "pro_plus" | "max";
}

function isActivePro(account: StoredUser | null | undefined): boolean {
  if (!account) return false;
  if (!["pro", "pro_plus", "max"].includes(account.plan)) return false;
  if (account.subscriptionStatus && !["active", "trialing", "complete", "paid"].includes(account.subscriptionStatus)) return false;
  return true;
}

function isPlatformAdmin(user: AuthUserRecord | null | undefined): boolean {
  return !!user?.email && platformAdminEmails.has(user.email.toLowerCase());
}

function getDailyLimit(tier: "free" | "pro" | "pro_plus" | "max"): number {
  if (tier === "max") return MAX_MAIA_DAILY_LIMIT;
  if (tier === "pro_plus") return PRO_PLUS_MAIA_DAILY_LIMIT;
  if (tier === "pro") return PRO_MAIA_DAILY_LIMIT;
  return FREE_MAIA_DAILY_LIMIT;
}

function getPathwayLimit(tier: "free" | "pro" | "pro_plus" | "max"): number {
  if (tier === "max") return MAX_PATHWAY_LIMIT;
  if (tier === "pro_plus") return PRO_PLUS_PATHWAY_LIMIT;
  if (tier === "pro") return PRO_PATHWAY_LIMIT;
  return FREE_PATHWAY_LIMIT;
}

function getToolLimit(tier: "free" | "pro" | "pro_plus" | "max"): number {
  if (tier === "max") return MAX_TOOL_LIMIT;
  if (tier === "pro_plus") return PRO_PLUS_TOOL_LIMIT;
  if (tier === "pro") return PRO_TOOL_LIMIT;
  return FREE_TOOL_LIMIT;
}

function usageKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function checkAndIncrementUsage(user: AuthUserRecord, kind: string, limit: number) {
  const day = usageKey();
  const filePath = path.join(usageDir, `${safeId(user.id)}-${day}.json`);
  const usage = await readJsonFile<Record<string, number>>(filePath, {});
  const used = Number(usage[kind] || 0);
  if (used >= limit) return { ok: false as const, used, limit };
  usage[kind] = used + 1;
  await writeJsonFile(filePath, usage);
  return { ok: true as const, used: usage[kind], limit };
}

async function getAccountForRequest(c: any) {
  const user = getCurrentUser(c);
  if (!user) return new Response(JSON.stringify({ error: "Please sign in." }), { status: 401, headers: { "Content-Type": "application/json" } });
  const account = await getStoredUser(user);
  return { user, account };
}

async function authorizeAi(c: any, requestedTier: string, kind = "messages") {
  const resolved = await getAccountForRequest(c);
  if (resolved instanceof Response) return resolved;
  const { user, account } = resolved;
  const planTier = getPlanTier(account);
  const wantsPro = requestedTier !== "free";
  if (wantsPro && planTier === "free") return new Response(JSON.stringify({ error: "An active subscription is required for this feature.", upgradeRequired: true }), { status: 402, headers: { "Content-Type": "application/json" } });
  const tier = wantsPro ? planTier : "free";
  const limit = getDailyLimit(tier);
  const usage = await checkAndIncrementUsage(user, kind, limit);
  if (!usage.ok) {
    return new Response(JSON.stringify({
      error: `Your ${tier.replace("_", " ")} plan includes ${usage.limit} messages per day. Try again tomorrow or upgrade your plan.`,
      upgradeRequired: tier === "free",
      used: usage.used,
      limit: usage.limit,
    }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  return { user, account, tier, model: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL };
}

export { getCurrentUser, requireCurrentUser, ensureGuestSession, getStoredUser, getPlanTier, getDailyLimit, getPathwayLimit, getToolLimit, isActivePro, isPlatformAdmin, usageKey, checkAndIncrementUsage, getAccountForRequest, authorizeAi };