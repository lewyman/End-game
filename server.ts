import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// AI agents: read README.md for navigation and contribution guidance.
type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";


const sessionCookie = "biosync_session";
const guestSessionCookie = "biosync_guest";
const oauthCookie = "biosync_oauth_state";
const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";

function getBaseUrl(c: any): string {
  const forwardedProto = c.req.header("x-forwarded-proto") || "";
  const proto = forwardedProto.includes("https") ? "https" : "https";
  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  return `${proto}://${host}`;
}

function getCookie(c: any, name: string): string | null {
  const raw = c.req.header("cookie") || "";
  const found = raw.split(";").map((v: string) => v.trim()).find((v: string) => v.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function authSecret(): string {
  return process.env.BIOSYNC_AUTH_SECRET || process.env.ZO_HOST_SERVICE_JWT || process.env.ZO_CLIENT_IDENTITY_TOKEN || "bio-sync-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function encodeSession(user: unknown): string {
  const payload = Buffer.from(JSON.stringify({ user, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string | null): any | null {
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

async function readEnv(name: string): Promise<string | undefined> {
  const direct = process.env[name];
  if (direct) return direct;

  return undefined;
}

async function googleClientConfig() {
  const clientId = await readEnv("GOOGLE_OAUTH_CLIENT_ID") || await readEnv("GOOGLE_CLIENT_ID");
  const clientSecret = await readEnv("GOOGLE_OAUTH_CLIENT_SECRET") || await readEnv("GOOGLE_CLIENT_SECRET");
  return { clientId, clientSecret };
}

app.get("/api/auth/me", async (c) => {
  const user = decodeSession(getCookie(c, sessionCookie));
  if (!user) return c.json({ user: null, account: null });
  const account = await getStoredUser(user);
  const todayUsage = await readJsonFile<Record<string, number>>(path.join(usageDir, `${safeId(user.id)}-${usageKey()}.json`), {});
  const tier = getPlanTier(account);
  const limit = getDailyLimit(tier);
  const inTrial = Date.now() < (account.trialEnd || 0) && !account.subscriptionStatus;
  return c.json({
    user,
    account: {
      plan: account.plan,
      subscriptionStatus: account.subscriptionStatus || (inTrial ? "trialing" : null),
      tier,
      trialEnd: account.trialEnd || null,
      trialStart: account.trialStart || null,
      currentPeriodEnd: account.currentPeriodEnd || null,
      isPro: isActivePro(account),
    },
    usage: { messages: todayUsage.messages || 0, limit },
  });
});

app.get("/api/dev/session", async (c) => {
  if (process.env.NODE_ENV === "production" || process.env.BIOSYNC_ENABLE_DEV_SESSION !== "true") return c.json({ error: "not found" }, 404);
  const user = { id: "dev-user", email: "dev@biosync.local", name: "Dev User" };
  await getStoredUser(user);
  const res = c.json({ ok: true, user });
  res.headers.append("Set-Cookie", cookieHeader(sessionCookie, encodeSession(user), 60 * 60 * 24 * 30));
  return res;
});

app.post("/api/auth/logout", (c) => {
  const res = c.json({ ok: true });
  res.headers.append("Set-Cookie", clearCookieHeader(sessionCookie));
  return res;
});

app.get("/api/auth/google", async (c) => {
  const { clientId } = await googleClientConfig();
  if (!clientId) return c.text("Google OAuth is missing GOOGLE_OAUTH_CLIENT_ID in Zo service secrets.", 500);

  const state = randomBytes(24).toString("base64url");
  const returnTo = c.req.query("returnTo") || "/";
  const statePayload = Buffer.from(JSON.stringify({ state, returnTo })).toString("base64url");
  const callbackUrl = `${getBaseUrl(c)}/api/auth/google/callback`;
  const url = new URL(googleAuthUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  const res = c.redirect(url.toString(), 302);
  res.headers.append("Set-Cookie", cookieHeader(oauthCookie, statePayload, 600));
  return res;
});

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const saved = getCookie(c, oauthCookie);
  const { clientId, clientSecret } = await googleClientConfig();

  if (!code || !state || !saved || !clientId || !clientSecret) return c.text("Invalid Google OAuth callback.", 400);

  let returnTo = "/";
  try {
    const parsed = JSON.parse(Buffer.from(saved, "base64url").toString("utf8"));
    if (parsed.state !== state) return c.text("Invalid OAuth state.", 400);
    if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) returnTo = parsed.returnTo;
  } catch {
    return c.text("Invalid OAuth state.", 400);
  }

  const callbackUrl = `${getBaseUrl(c)}/api/auth/google/callback`;
  const tokenRes = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return c.text("Google sign-in failed during token exchange.", 502);
  }

  const tokenData = await tokenRes.json() as { access_token?: string };
  if (!tokenData.access_token) return c.text("Google sign-in did not return an access token.", 502);

  const infoRes = await fetch(googleUserInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
  });
  if (!infoRes.ok) return c.text("Google sign-in failed while fetching your profile.", 502);
  const info = await infoRes.json() as { sub: string; email?: string; name?: string; picture?: string };

  const user = { id: info.sub, email: info.email || "", name: info.name || info.email || "Google user", picture: info.picture };
  await getStoredUser(user);
  const res = c.redirect(returnTo, 302);
  res.headers.append("Set-Cookie", cookieHeader(sessionCookie, encodeSession(user), 60 * 60 * 24 * 30));
  res.headers.append("Set-Cookie", clearCookieHeader(oauthCookie));
  return res;
});


type AuthUserRecord = { id: string; email: string; name?: string; picture?: string };
type StoredUser = AuthUserRecord & {
  plan: "free" | "pro" | "pro_plus" | "max";
  trialStart?: number;
  trialEnd?: number;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: number;
  stripePriceId?: string;
  createdAt: string;
  updatedAt: string;
};
type ConversationRecord = {
  id: string;
  title: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  created_at: string;
  updated_at: string;
};

const DATA_ROOT = path.join(process.cwd(), "data");
const usersDir = path.join(DATA_ROOT, "users");
const conversationsDir = path.join(DATA_ROOT, "conversations");
const usageDir = path.join(DATA_ROOT, "usage");
const billingDir = path.join(DATA_ROOT, "billing");
const reportsDir = path.join(DATA_ROOT, "reports");
const nclexDir = path.join(DATA_ROOT, "nclex");
const generatedToolHistoryDir = path.join(DATA_ROOT, "generated-tools-history");
const communityDir = path.join(DATA_ROOT, "community");
const FREE_MAIA_DAILY_LIMIT = 2;
const PRO_MAIA_DAILY_LIMIT = 20;
const PRO_PLUS_MAIA_DAILY_LIMIT = 50;
const MAX_MAIA_DAILY_LIMIT = 150;
const FREE_PATHWAY_LIMIT = 1;
const PRO_PATHWAY_LIMIT = 20;
const PRO_PLUS_PATHWAY_LIMIT = 50;
const MAX_PATHWAY_LIMIT = 150;
const FREE_TOOL_LIMIT = 1;
const PRO_TOOL_LIMIT = 5;
const PRO_PLUS_TOOL_LIMIT = 20;
const MAX_TOOL_LIMIT = 100;
const FREE_FILE_LIMIT = 5;
const PRO_FILE_LIMIT = 0;
const PRO_PLUS_FILE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;
const MAX_FILE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const GEMINI_MAIA_MODEL = "google/gemini-3.1-pro-preview";
const FREE_MAIA_MODEL = GEMINI_MAIA_MODEL;
const PRO_MAIA_MODEL = GEMINI_MAIA_MODEL;
const PRO_MONTHLY_AMOUNT = 1999;
const PRO_YEARLY_AMOUNT = 21499;
const PRO_PLUS_MONTHLY_AMOUNT = 5999;
const PRO_PLUS_YEARLY_AMOUNT = 59999;
const MAX_MONTHLY_AMOUNT = 9999;
const MAX_YEARLY_AMOUNT = 99999;

const PRICE_TO_PLAN: Record<string, StoredUser["plan"]> = {
  "price_1TalCCHue6jkR6Odd4bu7GOa": "pro",
  "price_1TalCIHue6jkR6OddID87NkU": "pro",
  "price_1Tb3poHue6jkR6OdO2PYcgyy": "pro_plus",
  "price_1Tb3poHue6jkR6OdJbYi75zl": "pro_plus",
  "price_1Tb3poHue6jkR6OdOzSi5Czi": "max",
  "price_1Tb3poHue6jkR6Od53q1YJ8l": "max",
};

const platformAdminEmails = new Set(["chad.l.lewis@endgameenhancements.com", "christian.c.lewis@endgameenhancements.com", "crusius00@gmail.com"]);

function safeId(value: string): string {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "unknown";
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function getCurrentUser(c: any): AuthUserRecord | null {
  return decodeSession(getCookie(c, sessionCookie));
}

function requireCurrentUser(c: any): AuthUserRecord | null {
  return getCurrentUser(c);
}

function encodeGuestSession(payload: { id: string; createdAt: number }): string {
  const raw = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

function decodeGuestSession(token: string | null): { id: string; createdAt: number } | null {
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

async function ensureGuestSession(c: any) {
  const existing = decodeGuestSession(getCookie(c, guestSessionCookie));
  if (existing) return existing;
  const payload = { id: `guest_${randomBytes(8).toString("hex")}`, createdAt: Date.now() };
  const res = encodeGuestSession(payload);
  return { payload, cookie: res };
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

function isActivePro(account: StoredUser | null | undefined): boolean {
  if (!account) return false;
  if (!["pro", "pro_plus", "max"].includes(account.plan)) return false;
  if (account.subscriptionStatus && !["active", "trialing", "complete", "paid"].includes(account.subscriptionStatus)) return false;
  return true;
}

function isPlatformAdmin(user: AuthUserRecord | null | undefined): boolean {
  return !!user?.email && platformAdminEmails.has(user.email.toLowerCase());
}

function usageKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function checkAndIncrementUsage(user: AuthUserRecord, kind: string, limit: number): Promise<{ ok: true; used: number; limit: number } | { ok: false; used: number; limit: number }> {
  const day = usageKey();
  const filePath = path.join(usageDir, `${safeId(user.id)}-${day}.json`);
  const usage = await readJsonFile<Record<string, number>>(filePath, {});
  const used = Number(usage[kind] || 0);
  if (used >= limit) return { ok: false, used, limit };
  usage[kind] = used + 1;
  await writeJsonFile(filePath, usage);
  return { ok: true, used: usage[kind], limit };
}

async function getAccountForRequest(c: any): Promise<{ user: AuthUserRecord; account: StoredUser } | Response> {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Please sign in to use MAIA." }, 401);
  const account = await getStoredUser(user);
  return { user, account };
}

async function authorizeAi(c: any, requestedTier: string, kind = "messages"): Promise<{ user: AuthUserRecord; account: StoredUser; tier: "free" | "pro" | "pro_plus" | "max"; model: string } | Response> {
  const resolved = await getAccountForRequest(c);
  if (resolved instanceof Response) return resolved;
  const { user, account } = resolved;
  const planTier = getPlanTier(account);
  const wantsPro = requestedTier !== "free";
  if (wantsPro && planTier === "free") return c.json({ error: "An active subscription is required for this feature.", upgradeRequired: true }, 402);
  const tier = wantsPro ? planTier : "free";
  const limit = getDailyLimit(tier);
  const usage = await checkAndIncrementUsage(user, kind, limit);
  if (!usage.ok) {
    return c.json({
      error: `Your ${tier.replace("_", " ")} plan includes ${usage.limit} messages per day. Try again tomorrow or upgrade your plan.`,
      upgradeRequired: tier === "free",
      used: usage.used,
      limit: usage.limit,
    }, 429);
  }
  return { user, account, tier, model: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL };
}

async function callZoAsk(input: string, model: string): Promise<string> {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable");
  const resp = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ input, model_name: model }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`MAIA unavailable (${resp.status}): ${detail.slice(0, 180)}`);
  }
  const data = await resp.json() as { output?: string };
  return data.output || "No response";
}

async function callZoAskStream(input: string, model: string): Promise<ReadableStream<Uint8Array>> {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable");
  const resp = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ input, model_name: model, stream: true }),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`MAIA unavailable (${resp.status}): ${detail.slice(0, 180)}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let currentEvent = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) { controller.close(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (currentEvent === "PartStartEvent" && parsed.part?.content) {
                  controller.enqueue(encoder.encode(parsed.part.content));
                } else if (currentEvent === "PartDeltaEvent" && parsed.delta?.content_delta) {
                  controller.enqueue(encoder.encode(parsed.delta.content_delta));
                }
              } catch {}
            } else if (line.trim() === "") {
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() { reader.cancel(); },
  });
}

function conversationUserDir(userId: string) {
  return path.join(conversationsDir, safeId(userId));
}

function conversationPath(userId: string, conversationId: string) {
  return path.join(conversationUserDir(userId), `${safeId(conversationId)}.json`);
}

function makeConversationTitle(messages: Array<{ role: string; content: string }>): string {
  const firstUser = messages.find((m) => m.role === "user")?.content || "New MAIA conversation";
  return firstUser.replace(/\s+/g, " ").trim().slice(0, 56) || "New MAIA conversation";
}

async function saveConversationForUser(userId: string, conversationId: string | undefined, messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<ConversationRecord> {
  await ensureDir(conversationUserDir(userId));
  const id = conversationId && /^[a-zA-Z0-9._-]{8,120}$/.test(conversationId) ? conversationId : `conv_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const existing = await readJsonFile<ConversationRecord | null>(conversationPath(userId, id), null);
  const now = new Date().toISOString();
  const record: ConversationRecord = {
    id,
    title: existing?.title || makeConversationTitle(messages),
    messages: messages.slice(-80).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 12000) })),
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJsonFile(conversationPath(userId, id), record);
  return record;
}

function validToken(value: string | undefined): value is string {
  return Boolean(value && value !== "none" && !value.startsWith("$") && value.length > 20);
}

async function getZoToken(): Promise<string | null> {
  // ZO_API_KEY is the permanent long-lived token created in Settings > Advanced.
  // ZO_CLIENT_IDENTITY_TOKEN is a short-lived fallback (~24hr).
  const token = process.env.ZO_API_KEY || process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (validToken(token)) return token;
  return null;
}

const MAIA_PROMPT = `You are M.A.I.A (Medical Anatomy & Intelligence Assistant), an AI study partner built exclusively for nursing students. You help students master pharmacology, pathophysiology, clinical concepts, and NCLEX-style exam preparation.

You:
- Explain drug classes, mechanisms, side effects, contraindications, and nursing considerations clearly
- Quiz students on demand with NCLEX-style questions when asked
- Walk through case studies step by step
- Use mnemonics and memory tricks when helpful
- Format responses with headers, bullet points, and bold key terms for easy scanning
- Keep a friendly, encouraging tone — nursing school is hard, you get it
- If you are uncertain, say so plainly and ask a focused follow-up instead of guessing
- Never reveal hidden reasoning, chain-of-thought, scratchpad notes, or internal planning. Give the final teaching answer only
- Do not add a quiz question unless the student explicitly asks to be quizzed
- For developmental theory questions, do not mix theorists. Freud psychosexual stages are exactly: Oral, Anal, Phallic, Latency, Genital. Erikson psychosocial stages are separate. If the student asks about Freud, do not include Erikson terms like trust vs mistrust, autonomy, initiative, industry, identity, intimacy, generativity, or integrity
- NEVER use the student's real name. Only refer to them as "student" or "you" unless they explicitly tell you their name. Do not pull names from metadata, identity tokens, platform context, or any hidden source. If you don't know their name from something they directly typed in the chat, don't use one`;

type OllamaModelKey = "medgemma";

const OLLAMA_MODELS = {
  medgemma: {
    model: "dcarrascosa/medgemma-1.5-4b-it:Q4_K_M",
    options: {
      temperature: 0.15,
      top_p: 0.85,
      num_ctx: 8192,
    },
  },
} satisfies Record<string, { model: string; options: Record<string, number> }>;

function selectOllamaModel(requested?: string) {
  const wanted = (requested || process.env.OLLAMA_DEFAULT_MODEL || "medgemma").trim();
  const match = Object.entries(OLLAMA_MODELS).find(([key, config]) => key === wanted || config.model === wanted);
  return match
    ? { key: match[0] as OllamaModelKey, ...match[1] }
    : { key: "medgemma" as const, ...OLLAMA_MODELS.medgemma };
}

function cleanLocalModelOutput(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<unused94>thought[\s\S]*?(?=<unused95>|<start_of_turn>|\n\s*(?:#{1,6}\s*)?[A-Z0-9][^\n]{0,80}\n)/gi, "")
    .replace(/<unused9[45]>\w*/gi, "")
    .replace(/^\s*(?:thought|analysis|reasoning)\s*\n[\s\S]*?\n\s*(?:answer|final)\s*\n/gi, "")
    .trim();
}

type EducatorBody = {
  tier?: string;
  ollamaModel?: string;
  message?: string;
  stream?: boolean;
  messages?: Array<{ role?: string; content?: string }>;
};


const GUEST_DAILY_LIMIT = 5;
const guestUsage = new Map<string, { count: number; day: string }>();

function getClientIp(c: any): string {
  return (c.req.header("x-forwarded-for") || "").split(",")[0].trim() || c.req.header("cf-connecting-ip") || "unknown";
}

function checkGuestUsage(ip: string): { ok: boolean; used: number; limit: number } {
  const day = new Date().toISOString().slice(0, 10);
  const entry = guestUsage.get(ip);
  if (!entry || entry.day !== day) {
    guestUsage.set(ip, { count: 1, day });
    return { ok: true, used: 1, limit: GUEST_DAILY_LIMIT };
  }
  if (entry.count >= GUEST_DAILY_LIMIT) return { ok: false, used: entry.count, limit: GUEST_DAILY_LIMIT };
  entry.count++;
  return { ok: true, used: entry.count, limit: GUEST_DAILY_LIMIT };
}

// AI educator — handles /api/educator directly through Zo Ask models
app.post("/api/educator/attach-file", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to attach files." }, 401);
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided." }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: "File too large. Max 5MB." }, 400);
    const filename = file.name || "upload";
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const buf = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (ext === "pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buf);
      text = parsed.text.slice(0, 40000);
    } else if (["txt", "md", "csv"].includes(ext)) {
      text = buf.toString("utf8").slice(0, 40000);
    } else if (["docx"].includes(ext)) {
      text = buf.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 40000);
    } else {
      return c.json({ error: "Unsupported file type. Use PDF, TXT, MD, or DOCX." }, 400);
    }
    return c.json({ text, filename, charCount: text.length });
  } catch (e: any) {
    return c.json({ error: "Failed to extract file text." }, 500);
  }
});

app.post("/api/educator", async (c) => {
  try {
    const body = await c.req.json<EducatorBody>().catch((): EducatorBody => ({}));
    const incomingMessages = Array.isArray(body.messages)
      ? body.messages
          .filter((m) => (m?.role === "user" || m?.role === "assistant") && m?.content?.trim())
          .slice(-16)
          .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).trim().slice(0, 6000) }))
      : [];
    const latestUserMessage = [...incomingMessages].reverse().find((m) => m.role === "user")?.content;
    const message = body.message?.trim() || latestUserMessage;
    if (!message) return c.json({ error: "message required" }, 400);

    const sessionUser = requireCurrentUser(c);
    let tier: "free" | "pro" = "free";
    let model = process.env.MAIA_PRO_MODEL || FREE_MAIA_MODEL;
    let isGuest = false;

    if (!sessionUser) {
      const ip = getClientIp(c);
      const usage = checkGuestUsage(ip);
      if (!usage.ok) {
        return c.json({ error: `Guest MAIA includes ${GUEST_DAILY_LIMIT} messages per day. Sign in for more.`, upgradeRequired: true }, 429);
      }
      isGuest = true;
    } else {
      const auth = await authorizeAi(c, body.tier === "pro" ? "pro" : "free", "messages");
      if (auth instanceof Response) return auth;
      tier = auth.tier;
      model = auth.model;
    }

    const conversationTranscript = incomingMessages.length
      ? incomingMessages.map((m) => `${m.role === "user" ? "Student" : "M.A.I.A"}: ${m.content}`).join("\n")
      : "";

    const fileContext = typeof body.fileContext === "string" ? body.fileContext.slice(0, 40000) : "";
    const fileSection = fileContext
      ? `\n\nThe student has uploaded a file for you to reference. Use the following content as your PRIMARY reference when answering their questions. Quote or paraphrase from it directly when relevant:\n\n---\n${fileContext}\n---`
      : "";

    const systemPrompt = `${MAIA_PROMPT}${fileSection}\n\nContinue the same tutoring conversation. Use context from prior messages. If the student answers a quiz question with a letter or short phrase, grade that answer against the most recent quiz question instead of starting over. Then give the rationale and, if appropriate, the next question. Do not explain your plan, reasoning, or what the user wants. Do not write phrases like "The user wants me" or "I need to". Give only the final teaching answer.`;
    const userPrompt = `Conversation transcript:\n${conversationTranscript}\n\nRespond as M.A.I.A to the student's latest message.`;

    if (body.stream) {
      const stream = await callZoAskStream(`${systemPrompt}\n\n${userPrompt}`, model);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          "Transfer-Encoding": "chunked",
          "X-MAIA-Tier": isGuest ? "guest" : tier,
          "X-MAIA-Model": model,
          "X-MAIA-Free-Used": "1",
          "X-MAIA-Guest": isGuest ? "1" : "0",
        },
      });
    }

    const output = await callZoAsk(`${systemPrompt}\n\n${userPrompt}`, model);
    return c.json({ response: output, audioUrl: null, tier: isGuest ? "guest" : tier, model, isGuest });
  } catch (e) {
    console.error("Educator error:", e);
    return c.json({ error: "AI unavailable" }, 502);
  }
});



async function stripeRequest(pathname: string, init: RequestInit = {}) {
  const secret = await readEnv("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("Stripe secret key is not configured");
  const body = init.body as any;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${secret}`,
    "Content-Type": "application/x-www-form-urlencoded",
    ...(init.headers as Record<string, string> || {}),
  };
  return fetch(`https://api.stripe.com/v1${pathname}`, { ...init, headers, body });
}

async function ensureStripeProductAndPrice(kind: "monthly" | "yearly") {
  const cachePath = path.join(billingDir, `stripe-${kind}.json`);
  const cached = await readJsonFile<any | null>(cachePath, null);
  const amount = kind === "monthly" ? PRO_MONTHLY_AMOUNT : PRO_YEARLY_AMOUNT;
  const interval = kind === "monthly" ? "month" : "year";
  if (cached?.priceId && cached.amount === amount && cached.interval === interval) return cached.priceId as string;
  await ensureDir(billingDir);
  const productRes = await stripeRequest("/products", {
    method: "POST",
    body: new URLSearchParams({
      name: "Bio-Sync Academy Pro MAIA",
      description: "Pro access to MAIA, NCLEX generation, clinical tools, and AI-generated study tools.",
    }),
  });
  if (!productRes.ok) throw new Error(`Stripe product failed: ${productRes.status}`);
  const product = await productRes.json() as any;
  const priceRes = await stripeRequest("/prices", {
    method: "POST",
    body: new URLSearchParams({
      product: product.id,
      currency: "usd",
      unit_amount: String(amount),
      "recurring[interval]": interval,
    }),
  });
  if (!priceRes.ok) throw new Error(`Stripe price failed: ${priceRes.status}`);
  const price = await priceRes.json() as any;
  await writeJsonFile(cachePath, { productId: product.id, priceId: price.id, amount, interval, createdAt: new Date().toISOString() });
  return price.id as string;
}

async function findUserByStripeCustomer(customerId: string): Promise<StoredUser | null> {
  await ensureDir(usersDir);
  const files = (await readdir(usersDir).catch(() => [])).filter((file) => file.endsWith(".json"));
  for (const file of files) {
    const user = await readJsonFile<StoredUser | null>(path.join(usersDir, file), null);
    if (user?.stripeCustomerId === customerId) return user;
  }
  return null;
}

async function updateUserSubscriptionByCustomer(customerId: string, patch: Partial<StoredUser>) {
  const user = await findUserByStripeCustomer(customerId);
  if (!user) return;
  const updated = { ...user, ...patch, updatedAt: new Date().toISOString() } as StoredUser;
  await writeJsonFile(userPath(user.id), updated);
}

app.post("/api/create-checkout-session", async (c) => {
  const current = await getAccountForRequest(c);
  if (current instanceof Response) return current;
  const { user, account } = current;
  const body = await c.req.json().catch(() => ({}));

  let priceId: string;
  if (body.priceId && body.priceId.startsWith("price_")) {
    priceId = body.priceId;
  } else {
    const priceKey = body.priceId === "price_yearly" || body.priceId === "yearly" ? "yearly" : "monthly";
    priceId = await ensureStripeProductAndPrice(priceKey);
  }

  try {
    const customerEmail = user.email || account.email;
    const successUrl = `${getBaseUrl(c)}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${getBaseUrl(c)}/pricing?canceled=1`;
    const params = new URLSearchParams({
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[userId]": user.id,
      "metadata[email]": customerEmail,
      "metadata[priceId]": priceId,
      "subscription_data[metadata][userId]": user.id,
      "subscription_data[metadata][priceId]": priceId,
      allow_promotion_codes: "true",
    });
    if (account.stripeCustomerId) params.set("customer", account.stripeCustomerId);
    else if (customerEmail) params.set("customer_email", customerEmail);
    const resp = await stripeRequest("/checkout/sessions", { method: "POST", body: params });
    const data = await resp.json() as any;
    if (!resp.ok) return c.json({ error: data?.error?.message || "Stripe checkout failed" }, 502);
    if (data.customer && !account.stripeCustomerId) {
      await writeJsonFile(userPath(user.id), { ...account, stripeCustomerId: data.customer, updatedAt: new Date().toISOString() });
    }
    return c.json({ url: data.url });
  } catch (error: any) {
    console.error("Checkout failed:", error);
    return c.json({ error: error.message || "Checkout failed" }, 502);
  }
});

app.post("/api/stripe-webhook", async (c) => {
  const webhookSecret = await readEnv("STRIPE_WEBHOOK_SECRET");
  const sig = c.req.header("stripe-signature") || "";
  const rawBody = await c.req.text();
  if (!webhookSecret || !sig) return c.json({ error: "Missing webhook secret/signature" }, 400);
  const stripeMod = await import("stripe");
  let event: any;
  try {
    const StripeCtor = (stripeMod.default || stripeMod) as any;
    const client = new StripeCtor(await readEnv("STRIPE_SECRET_KEY"));
    event = await client.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (error: any) {
    console.error("Stripe webhook verification failed:", error.message);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const paidPriceId = session.metadata?.priceId || "";
      const detectedPlan = PRICE_TO_PLAN[paidPriceId] || "pro";
      if (userId) {
        const existing = await readJsonFile<StoredUser | null>(userPath(userId), null);
        if (existing) {
          await writeJsonFile(userPath(userId), {
            ...existing,
            plan: detectedPlan,
            stripePriceId: paidPriceId,
            stripeCustomerId: String(session.customer || existing.stripeCustomerId || ""),
            subscriptionId: String(session.subscription || existing.subscriptionId || ""),
            subscriptionStatus: "active",
            trialStart: null as any,
            trialEnd: null as any,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = String(subscription.customer || "");
      const active = ["active", "trialing"].includes(subscription.status);
      const subPriceId = subscription.items?.data?.[0]?.price?.id || subscription.metadata?.priceId || "";
      const detectedPlan = PRICE_TO_PLAN[subPriceId] || "pro";
      await updateUserSubscriptionByCustomer(customerId, { trialStart: null as any, trialEnd: null as any,
        plan: active ? detectedPlan : "free",
        stripePriceId: subPriceId,
        subscriptionId: String(subscription.id || ""),
        subscriptionStatus: String(subscription.status || ""),
        currentPeriodEnd: Number(subscription.current_period_end || 0),
      });
    }
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return c.json({ error: "Webhook processing failed" }, 500);
  }
  return c.json({ received: true });
});

app.get("/api/billing/verify-session", async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) return c.json({ error: "Missing session_id" }, 400);
  const current = await getAccountForRequest(c);
  if (current instanceof Response) return current;
  const { user, account } = current;
  try {
    const resp = await stripeRequest(`/checkout/sessions/${sessionId}?expand[]=subscription`);
    if (!resp.ok) return c.json({ error: "Could not retrieve session" }, 502);
    const session = await resp.json() as any;
    if (session.payment_status !== "paid") return c.json({ upgraded: false, status: session.payment_status });
    const updated = {
      ...account,
      plan: (PRICE_TO_PLAN[session.subscription?.items?.data?.[0]?.price?.id || ""] || "pro") as StoredUser["plan"],
      stripePriceId: session.subscription?.items?.data?.[0]?.price?.id || "",
      stripeCustomerId: String(session.customer || account.stripeCustomerId || ""),
      subscriptionId: String(session.subscription?.id || session.subscription || account.subscriptionId || ""),
      subscriptionStatus: "active",
      currentPeriodEnd: session.subscription?.current_period_end || account.currentPeriodEnd || null,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(userPath(user.id), updated);
    return c.json({ upgraded: true, plan: updated.plan, subscriptionStatus: "active" });
  } catch (e: any) {
    console.error("Verify session error:", e);
    return c.json({ error: "Verification failed" }, 502);
  }
});

app.post("/api/cancel-subscription", async (c) => {
  const current = await getAccountForRequest(c);
  if (current instanceof Response) return current;
  const { user, account } = current;
  if (!account.subscriptionId) return c.json({ error: "No active subscription found" }, 400);
  try {
    const resp = await stripeRequest(`/subscriptions/${account.subscriptionId}`, {
      method: "POST",
      body: new URLSearchParams({ cancel_at_period_end: "true" }),
    });
    if (!resp.ok) {
      const err = await resp.json() as any;
      return c.json({ error: err?.error?.message || "Cancel failed" }, 502);
    }
    const sub = await resp.json() as any;
    const updated = {
      ...account,
      subscriptionStatus: "canceling",
      currentPeriodEnd: sub.current_period_end || account.currentPeriodEnd || null,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFile(userPath(user.id), updated);
    return c.json({ canceled: true, currentPeriodEnd: updated.currentPeriodEnd });
  } catch (e: any) {
    console.error("Cancel subscription error:", e);
    return c.json({ error: "Cancel failed" }, 502);
  }
});

app.post("/api/billing/sync-subscription", async (c) => {
  const current = await getAccountForRequest(c);
  if (current instanceof Response) return current;
  const { user, account } = current;

  let stripeCustomerId = account.stripeCustomerId;
  let subscriptionId = account.subscriptionId;

  // Step 1: if no customer ID, search Stripe by email
  if (!stripeCustomerId) {
    const searchResp = await stripeRequest(`/customers/search?query=email:'${encodeURIComponent(user.email)}'&limit=1`);
    if (searchResp.ok) {
      const searchData = await searchResp.json() as any;
      stripeCustomerId = searchData?.data?.[0]?.id;
    }
  }

  // Step 2: if still no customer, nothing to sync
  if (!stripeCustomerId) {
    return c.json({ synced: false, message: "No Stripe account found for this email. If you just paid, please wait a moment and try again." });
  }

  // Step 3: get active subscription for this customer
  if (!subscriptionId) {
    const subResp = await stripeRequest(`/subscriptions?customer=${stripeCustomerId}&limit=1&status=active`);
    if (subResp.ok) {
      const subData = await subResp.json() as any;
      subscriptionId = subData?.data?.[0]?.id;
    }
  }

  if (!subscriptionId) {
    // Check canceled/past_due too
    const subResp2 = await stripeRequest(`/subscriptions?customer=${stripeCustomerId}&limit=1`);
    if (subResp2.ok) {
      const subData2 = await subResp2.json() as any;
      subscriptionId = subData2?.data?.[0]?.id;
    }
  }

  if (!subscriptionId) {
    return c.json({ synced: false, message: "No subscription found for this account. If you just paid, please wait a moment and try again." });
  }

  // Step 4: fetch subscription details and update local account
  const subResp = await stripeRequest(`/subscriptions/${subscriptionId}`);
  if (!subResp.ok) return c.json({ error: "Could not retrieve subscription from Stripe" }, 502);
  const sub = await subResp.json() as any;

  const isActive = ["active", "trialing"].includes(sub.status);
  const updated: StoredUser = {
    ...account,
    stripeCustomerId,
    subscriptionId,
    plan: isActive ? "pro" : account.plan,
    subscriptionStatus: sub.status,
    currentPeriodEnd: sub.current_period_end ?? null,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(userPath(user.id), updated);

  return c.json({
    synced: true,
    plan: updated.plan,
    subscriptionStatus: sub.status,
    currentPeriodEnd: sub.current_period_end,
    message: isActive ? "Your Pro subscription is active!" : `Subscription status: ${sub.status}`,
  });
});

// Trial status endpoint
app.get("/api/auth/trial-status", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to view trial status." }, 401);
  const account = await getStoredUser(user);
  const inTrial = Date.now() < (account.trialEnd || 0) && !account.subscriptionStatus;
  const daysLeft = inTrial && account.trialEnd ? Math.ceil((account.trialEnd - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  return c.json({
    inTrial,
    daysLeft: Math.max(0, daysLeft),
    trialEnd: account.trialEnd || null,
    trialStart: account.trialStart || null,
    plan: account.plan,
    subscriptionStatus: account.subscriptionStatus || null,
  });
});

// ── Community Hub ─────────────────────────────────────────────────────────────
type CommunityThread = {
  id: string;
  title: string;
  content: string;
  userId: string;
  userName: string;
  userPicture?: string;
  category: string;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};
type CommunityComment = {
  id: string;
  userId: string;
  userName: string;
  userPicture?: string;
  body: string;
  createdAt: string;
};
function communityThreadsFile() { return path.join(communityDir, "threads.json"); }
function communityCommentsFile(threadId: string) { return path.join(communityDir, "comments", `${safeId(threadId)}.json`); }

async function getCommunityThreads(): Promise<CommunityThread[]> {
  return readJsonFile<CommunityThread[]>(communityThreadsFile(), []);
}

async function saveCommunityThread(thread: CommunityThread) {
  const threads = await getCommunityThreads();
  threads.unshift(thread);
  await writeJsonFile(communityThreadsFile(), threads);
  return thread;
}

async function getCommunityComments(threadId: string): Promise<CommunityComment[]> {
  return readJsonFile<CommunityComment[]>(communityCommentsFile(threadId), []);
}

async function saveCommunityComment(threadId: string, comment: CommunityComment) {
  const threads = await getCommunityThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx !== -1) {
    threads[idx].commentCount = (threads[idx].commentCount || 0) + 1;
    threads[idx].updatedAt = new Date().toISOString();
    await writeJsonFile(communityThreadsFile(), threads);
  }
  const threadComments = await getCommunityComments(threadId);
  threadComments.push(comment);
  await writeJsonFile(communityCommentsFile(threadId), threadComments);
  return comment;
}

app.get("/api/community/threads", async (c) => {
  const threads = await getCommunityThreads();
  return c.json({ threads: threads.slice(0, 20) });
});

app.get("/api/community/threads/:id", async (c) => {
  const id = c.req.param("id");
  const threads = await getCommunityThreads();
  const thread = threads.find(t => t.id === id);
  if (!thread) return c.json({ error: "Thread not found" }, 404);
  const comments = await getCommunityComments(id);
  return c.json({ thread, comments });
});

app.post("/api/community/threads", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to post." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || "").trim().slice(0, 200);
  const bodyText = String(body.body || "").trim().slice(0, 5000);
  const category = ["pharmacology","nclex","clinical","school","career","general"].includes(body.category) ? body.category : "general";
  if (!title || !bodyText) return c.json({ error: "Title and body required." }, 400);
  const now = new Date().toISOString();
  const thread: CommunityThread = {
    id: `thread_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    userId: user.id,
    userName: user.name || user.email,
    userPicture: (user as any).picture || undefined,
    title,
    body: bodyText,
    category,
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await saveCommunityThread(thread);
  return c.json({ thread });
});

app.post("/api/community/threads/:id/comments", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to comment." }, 401);
  const threadId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const bodyText = String(body.body || "").trim().slice(0, 2000);
  if (!bodyText) return c.json({ error: "Comment body required." }, 400);
  const comment: CommunityComment = {
    id: `cmt_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    userId: user.id,
    userName: user.name || user.email,
    userPicture: (user as any).picture || undefined,
    body: bodyText,
    createdAt: new Date().toISOString(),
  };
  await saveCommunityComment(threadId, comment);
  return c.json({ comment });
});

app.delete("/api/community/threads/:id", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to manage threads." }, 401);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin only." }, 403);
  const threadId = c.req.param("id");
  const threads = await getCommunityThreads();
  const filtered = threads.filter(t => t.id !== threadId);
  if (filtered.length === threads.length) return c.json({ error: "Thread not found." }, 404);
  await writeJsonFile(communityThreadsFile(), filtered);
  return c.json({ ok: true });
});


app.get("/api/account/status", async (c) => {
  const resolved = await getAccountForRequest(c);
  if (resolved instanceof Response) return resolved;
  const { user, account } = resolved;
  const day = usageKey();
  const usage = await readJsonFile<Record<string, number>>(path.join(usageDir, `${safeId(user.id)}-${day}.json`), {});
  return c.json({
    user,
    account: {
      plan: account.plan,
      subscriptionStatus: account.subscriptionStatus || null,
      currentPeriodEnd: account.currentPeriodEnd || null,
      isPro: isActivePro(account),
      trialStart: account.trialStart || null,
      trialEnd: account.trialEnd || null,
      tier: getPlanTier(account),
    },
    usage: {
      day,
      messages: Number(usage.messages || 0),
      freeLimit: FREE_MAIA_DAILY_LIMIT,
      proLimit: PRO_MAIA_DAILY_LIMIT,
    },
  });
});

// ── File Library ─────────────────────────────────────────────────────────────
function userFilesDir(userId: string) { return path.join(DATA_ROOT, "files", safeId(userId)); }
function userFilesIndex(userId: string) { return path.join(userFilesDir(userId), "index.json"); }
function fileDir(userId: string, fileId: string) { return path.join(userFilesDir(userId), fileId); }

async function extractTextFromBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === "text/plain" || filename.endsWith(".txt")) {
    return buffer.toString("utf8").slice(0, 200000);
  }
  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
    const maxLen = 200000;
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      const text = (result.text || "").trim();
      if (text.length > 50) return text.slice(0, maxLen);
    } catch { /* fall through to pdftotext */ }

    // pdftotext fallback
    try {
      const tmpDir = path.join(DATA_ROOT, "tmp");
      await ensureDir(tmpDir);
      const tmpFile = path.join(tmpDir, `extract_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
      await writeFile(tmpFile, buffer);
      const execFileP = promisify(execFile);
      const { stdout } = await execFileP("pdftotext", ["-layout", tmpFile, "-"], { timeout: 30000, maxBuffer: 5 * 1024 * 1024 });
      try { await unlink(tmpFile); } catch {}
      const text = (stdout || "").trim();
      if (text.length > 0) return text.slice(0, maxLen);
    } catch (e: any) {
      console.error(`pdftotext extraction failed for ${filename}:`, e.message || e);
    }
    return "";
  }
  return buffer.toString("utf8").slice(0, 200000);
}

app.post("/api/files/upload", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to upload files." }, 401);
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided." }, 400);
    if (file.size > 20 * 1024 * 1024) return c.json({ error: "File too large. Max 20MB." }, 413);
    const allowed = ["application/pdf", "text/plain", "text/csv", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|csv|docx?|md)$/i)) {
      return c.json({ error: "Unsupported file type. Allowed: PDF, TXT, CSV, DOCX, MD." }, 415);
    }
    const account = await getStoredUser(user);
    const tier = getPlanTier(account);
    const index = await readJsonFile<any[]>(userFilesIndex(user.id), []);
    if (tier === "free" && index.length >= FREE_FILE_LIMIT) {
      return c.json({ error: `Free plan includes ${FREE_FILE_LIMIT} files. Upgrade to Pro Plus for 1GB storage.`, upgradeRequired: true }, 402);
    }
    if (tier === "pro") {
      return c.json({ error: "File Library requires Pro Plus or Max plan.", upgradeRequired: true }, 402);
    }
    if (tier === "pro_plus") {
      const totalBytes = index.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
      if (totalBytes + file.size > PRO_PLUS_FILE_LIMIT_BYTES) {
        return c.json({ error: "Storage limit reached (1GB). Upgrade to Max for 5GB.", upgradeRequired: true }, 402);
      }
    }
    if (tier === "max") {
      const totalBytes = index.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
      if (totalBytes + file.size > MAX_FILE_LIMIT_BYTES) {
        return c.json({ error: "Storage limit reached (5GB). Please delete some files.", upgradeRequired: false }, 402);
      }
    }
    const fileId = `file_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
    const dir = fileDir(user.id, fileId);
    await ensureDir(dir);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, "original"), buffer);
    const extractedText = await extractTextFromBuffer(buffer, file.type, file.name);
    await writeFile(path.join(dir, "text.txt"), extractedText, "utf8");
    const meta = { id: fileId, name: file.name, size: file.size, type: file.type, uploadedAt: new Date().toISOString(), textLength: extractedText.length };
    await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
    index.push(meta);
    await writeJsonFile(userFilesIndex(user.id), index);
    return c.json({ file: meta });
  } catch (e: any) {
    console.error("File upload error:", e);
    return c.json({ error: e.message || "Upload failed." }, 500);
  }
});

app.get("/api/files", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to view files." }, 401);
  const index = await readJsonFile<any[]>(userFilesIndex(user.id), []);
  return c.json(index.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
});

app.delete("/api/files/:fileId", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized." }, 401);
  const fileId = c.req.param("fileId");
  if (!/^file_[a-zA-Z0-9_]+$/.test(fileId)) return c.json({ error: "Invalid file ID." }, 400);
  try {
    const { rm } = await import("node:fs/promises");
    await rm(fileDir(user.id, fileId), { recursive: true, force: true });
    const index = await readJsonFile<any[]>(userFilesIndex(user.id), []);
    await writeJsonFile(userFilesIndex(user.id), index.filter((f) => f.id !== fileId));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: "Delete failed." }, 500);
  }
});

app.get("/api/files/:fileId/text", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized." }, 401);
  const fileId = c.req.param("fileId");
  try {
    const text = await readFile(path.join(fileDir(user.id, fileId), "text.txt"), "utf8");
    return c.text(text);
  } catch {
    return c.json({ error: "File not found." }, 404);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Pathways ──────────────────────────────────────────────────────────────────
function userPathwaysDir(userId: string) { return path.join(DATA_ROOT, "pathways", safeId(userId)); }
function pathwayPath(userId: string, pathwayId: string) { return path.join(userPathwaysDir(userId), `${safeId(pathwayId)}.json`); }
function userProgressDir(userId: string) { return path.join(DATA_ROOT, "progress", safeId(userId)); }
function progressPath(userId: string, pathwayId: string) { return path.join(userProgressDir(userId), `${safeId(pathwayId)}.json`); }
function statsPath(userId: string) { return path.join(DATA_ROOT, "stats", `${safeId(userId)}.json`); }

interface ContentStep {
  id: string; type: "read" | "image" | "video" | "audio";
  title?: string; content: string; caption?: string; duration?: number;
}
interface QuizStep {
  id: string; type: "mcq" | "flashcard";
  question: string; options?: string[]; correctOption?: string;
  answer: string; explanation?: string; hint?: string;
}
type PathwayStep = ContentStep | QuizStep;
interface PathwayLesson { id: string; title: string; steps: PathwayStep[]; xpReward: number; estimatedMinutes?: number; }
interface PathwayBranch { id: string; title: string; condition: string; targetModuleId: string; }
interface PathwayModule { id: string; title: string; lessons: PathwayLesson[]; branches?: PathwayBranch[]; }
interface Pathway {
  id: string; userId: string; title: string; description: string;
  fileIds: string[]; modules: PathwayModule[];
  status: "generating" | "ready" | "error"; createdAt: string; updatedAt: string;
  errorMessage?: string;
}
interface StepProgress { completed: boolean; correct?: boolean; attempts: number; completedAt?: string; }
interface LessonProgress { completed: boolean; xpEarned: number; steps: Record<string, StepProgress>; completedAt?: string; startedAt?: string; }
interface PathwayProgressData { lessons: Record<string, LessonProgress>; totalXp: number; updatedAt: string; }
interface UserStats { totalXp: number; streak: number; longestStreak: number; lastStudiedDate: string; updatedAt: string; }

async function getUserStats(userId: string): Promise<UserStats> {
  return readJsonFile<UserStats>(statsPath(userId), { totalXp: 0, streak: 0, longestStreak: 0, lastStudiedDate: "", updatedAt: new Date().toISOString() });
}

async function updateUserStats(userId: string, xpDelta: number): Promise<UserStats> {
  await ensureDir(path.join(DATA_ROOT, "stats"));
  const stats = await getUserStats(userId);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let { streak, longestStreak } = stats;
  if (stats.lastStudiedDate === yesterday) streak += 1;
  else if (stats.lastStudiedDate !== today) streak = 1;
  if (streak > longestStreak) longestStreak = streak;
  const updated: UserStats = { totalXp: stats.totalXp + xpDelta, streak, longestStreak, lastStudiedDate: today, updatedAt: new Date().toISOString() };
  await writeJsonFile(statsPath(userId), updated);
  return updated;
}

app.post("/api/pathways/generate", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to generate pathways." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (!isPlatformAdmin(user)) {
    const pathwayLimit = getPathwayLimit(tier);
    const existingPathways = await readJsonFile<string[]>(path.join(userPathwaysDir(user.id), "index.json"), []).catch(() => [] as string[]);
    const pathwayFiles = await readdir(userPathwaysDir(user.id)).catch(() => [] as string[]);
    const pathwayCount = pathwayFiles.filter(f => f.endsWith(".json") && f !== "index.json").length;
    if (pathwayCount >= pathwayLimit) {
      return c.json({ error: `Your ${tier.replace("_", " ")} plan allows ${pathwayLimit} pathways. Delete one or upgrade to create more.`, upgradeRequired: tier !== "max" }, 402);
    }
  }
  const body = await c.req.json().catch(() => ({})) as { fileIds?: string[]; title?: string };
  if (!body.fileIds?.length) return c.json({ error: "Select at least one file." }, 400);
  const pathwayId = `pw_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const stub: Pathway = {
    id: pathwayId, userId: user.id, title: body.title || "My Pathway",
    description: "", fileIds: body.fileIds, modules: [], status: "generating",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await ensureDir(userPathwaysDir(user.id));
  await writeJsonFile(pathwayPath(user.id, pathwayId), stub);
  (async () => {
    try {
      const texts: string[] = [];
      for (const fid of body.fileIds!) {
        try { const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8"); texts.push(t.slice(0, 50000)); } catch {}
      }
      const combinedText = texts.join("\n\n---\n\n").slice(0, 120000);
      if (!combinedText.trim() || combinedText.trim().length < 50) {
        throw new Error("NO_TEXT: The uploaded file contains little or no extractable text. PPT-to-PDF slides and image-based PDFs cannot be used for pathway generation. Please upload a text-based PDF, DOCX, TXT, or MD file instead.");
      }
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");
      const prompt = `You are a nursing education course designer. Create a Duolingo-style learning pathway from this material — each lesson interleaves rich reading content blocks with quiz questions that test that specific content.

MATERIAL:
${combinedText}

Return ONLY valid JSON (no markdown, no commentary):
{
  "title": "Course title",
  "description": "2-sentence description",
  "modules": [
    {
      "id": "m1",
      "title": "Module title",
      "lessons": [
        {
          "id": "m1l1",
          "title": "Lesson title",
          "xpReward": 20,
          "estimatedMinutes": 5,
          "steps": [
            {
              "id": "m1l1s1",
              "type": "read",
              "title": "Section heading",
              "content": "## Section heading\\n\\nDetailed 2-4 paragraph nursing explanation with key concepts bolded using **markdown**. Include clinical relevance, nursing considerations, and memory aids.",
              "duration": 90
            },
            {
              "id": "m1l1s2",
              "type": "mcq",
              "question": "Question directly testing the content above?",
              "options": ["Correct answer", "Plausible distractor", "Plausible distractor", "Plausible distractor"],
              "correctOption": "Correct answer",
              "answer": "Correct answer",
              "explanation": "Explanation of why the correct answer is right and why the distractors are wrong."
            },
            {
              "id": "m1l1s3",
              "type": "read",
              "title": "Next concept",
              "content": "## Next concept\\n\\nMore content...",
              "duration": 60
            },
            {
              "id": "m1l1s4",
              "type": "mcq",
              "question": "Question testing the second concept?",
              "options": ["A","B","C","D"],
              "correctOption": "A",
              "answer": "A",
              "explanation": "Because..."
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- 3-5 modules, 2-4 lessons per module, 4-8 steps per lesson
- ALWAYS alternate: read → quiz → read → quiz (never two reads or two quizzes in a row unless finishing with an extra quiz)
- Reading content must be substantive nursing education (not a stub) — include clinical pearls, drug info, mechanisms, nursing considerations
- Each MCQ must have exactly 4 options; correctOption must exactly match one of the options
- xpReward: 15-30 per lesson
- All step IDs must be unique across the entire pathway`;
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);
      const updated: Pathway = { ...stub, title: generated.title || stub.title, description: generated.description || "", modules: generated.modules || [], status: "ready", updatedAt: new Date().toISOString() };
      await writeJsonFile(pathwayPath(user.id, pathwayId), updated);
    } catch (e) {
      console.error("Pathway generation error:", e);
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      const userMessage = errMsg.startsWith("NO_TEXT:") ? errMsg.slice(8) : (errMsg.includes("JSON") ? "AI generation failed — the material could not be processed into a pathway. Try a different file with more structured content." : "Pathway generation failed. Please try again or use a different file.");
      const failed = await readJsonFile<Pathway>(pathwayPath(user.id, pathwayId), stub);
      await writeJsonFile(pathwayPath(user.id, pathwayId), { ...failed, status: "error", errorMessage: userMessage, updatedAt: new Date().toISOString() });
    }
  })();
  return c.json({ pathwayId, status: "generating" });
});

app.get("/api/pathways", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const q = (c.req.query("q") || "").toLowerCase();
  const status = c.req.query("status") || "";
  const sort = c.req.query("sort") || "newest";
  await ensureDir(userPathwaysDir(user.id));
  const files = (await readdir(userPathwaysDir(user.id)).catch(() => [])).filter((f) => f.endsWith(".json"));
  let pathways = (await Promise.all(files.map((f) => readJsonFile<Pathway>(path.join(userPathwaysDir(user.id), f), null as any)))).filter(Boolean);
  if (q) pathways = pathways.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (status) pathways = pathways.filter(p => p.status === status);
  if (sort === "oldest") pathways.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else pathways.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json(pathways.map(({ id, title, description, status, createdAt, moduleCount, lessonCount, stepCount, fileIds, errorMessage }: any) => ({ id, title, description, status, createdAt, moduleCount: moduleCount || 0, lessonCount: lessonCount || 0, stepCount: stepCount || 0, fileIds: fileIds || [], errorMessage: errorMessage || null })));
});

app.get("/api/pathways/:id", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  return c.json(pw);
});

app.delete("/api/pathways/:id", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Unauthorized." }, 401);
  try { const { unlink } = await import("node:fs/promises"); await unlink(pathwayPath(user.id, c.req.param("id"))); return c.json({ ok: true }); }
  catch { return c.json({ error: "Not found." }, 404); }
});

app.post("/api/pathways/:id/retry", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const pwId = c.req.param("id");
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, pwId), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  if (pw.status !== "error") return c.json({ error: "Only failed pathways can be retried." }, 400);
  if (!pw.fileIds?.length) return c.json({ error: "No files attached to this pathway." }, 400);

  await writeJsonFile(pathwayPath(user.id, pwId), { ...pw, status: "generating", errorMessage: undefined, updatedAt: new Date().toISOString() });

  (async () => {
    try {
      const texts: string[] = [];
      for (const fid of pw.fileIds!) {
        try { const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8"); texts.push(t.slice(0, 50000)); } catch {}
      }
      const combinedText = texts.join("\n\n---\n\n").slice(0, 120000);
      const trimmed = combinedText.replace(/\s+/g, " ").trim();
      if (!trimmed || trimmed.length < 100) {
        const errMsg = trimmed ? `File text too short (${trimmed.length} characters). The PDF may be image-only — try uploading a text-based PDF or TXT file instead.` : "No text could be extracted from this file. The PDF may be image-only (scanned slides) — try uploading a text-based PDF or TXT file instead.";
        await writeJsonFile(pathwayPath(user.id, pwId), { ...pw, status: "error", errorMessage: errMsg, updatedAt: new Date().toISOString() });
        return;
      }
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");
      const prompt = `You are a nursing education course designer. Create a Duolingo-style learning pathway from this material — each lesson interleaves rich reading content blocks with quiz questions that test that specific content.

MATERIAL:
${combinedText}

Return ONLY valid JSON (no markdown, no commentary):
{
  "title": "Course title",
  "description": "2-sentence description",
  "modules": [
    {
      "id": "m1",
      "title": "Module title",
      "lessons": [
        {
          "id": "m1l1",
          "title": "Lesson title",
          "xpReward": 20,
          "estimatedMinutes": 5,
          "steps": [
            {
              "id": "m1l1s1",
              "type": "read",
              "title": "Section heading",
              "content": "## Section heading\\n\\nDetailed 2-4 paragraph nursing explanation with key concepts bolded using **markdown**. Include clinical relevance, nursing considerations, and memory aids.",
              "duration": 90
            },
            {
              "id": "m1l1s2",
              "type": "mcq",
              "question": "Question directly testing the content above?",
              "options": ["Correct answer", "Plausible distractor", "Plausible distractor", "Plausible distractor"],
              "correctOption": "Correct answer",
              "answer": "Correct answer",
              "explanation": "Explanation of why the correct answer is right and why the distractors are wrong."
            },
            {
              "id": "m1l1s3",
              "type": "read",
              "title": "Next concept",
              "content": "## Next concept\\n\\nMore content...",
              "duration": 60
            },
            {
              "id": "m1l1s4",
              "type": "mcq",
              "question": "Question testing the second concept?",
              "options": ["A","B","C","D"],
              "correctOption": "A",
              "answer": "A",
              "explanation": "Because..."
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- 3-5 modules, 2-4 lessons per module, 4-8 steps per lesson
- ALWAYS alternate: read → quiz → read → quiz (never two reads or two quizzes in a row unless finishing with an extra quiz)
- Reading content must be substantive nursing education (not a stub) — include clinical pearls, drug info, mechanisms, nursing considerations
- Each MCQ must have exactly 4 options; correctOption must exactly match one of the options
- xpReward: 15-30 per lesson
- All step IDs must be unique across the entire pathway`;
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);
      const updated: Pathway = { ...pw, title: generated.title || pw.title, description: generated.description || "", modules: generated.modules || [], status: "ready", errorMessage: undefined, updatedAt: new Date().toISOString() };
      await writeJsonFile(pathwayPath(user.id, pwId), updated);
    } catch (e) {
      console.error("Pathway retry error:", e);
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      const userMessage = errMsg.startsWith("NO_TEXT:") ? errMsg.slice(8) : (errMsg.includes("JSON") ? "AI response couldn't be parsed. The file content may be too short or unstructured for pathway generation." : "Generation failed. The file may be image-only or have insufficient text. Try a different file format.");
      await writeJsonFile(pathwayPath(user.id, pwId), { ...pw, status: "error", errorMessage: userMessage, updatedAt: new Date().toISOString() });
    }
  })();

  return c.json({ pathwayId: pwId, status: "generating" });
});

app.get("/api/user/stats", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  return c.json(await getUserStats(user.id));
});

app.get("/api/pathways/:id/progress", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  await ensureDir(userProgressDir(user.id));
  const progress = await readJsonFile<PathwayProgressData>(progressPath(user.id, pw.id), { lessons: {}, totalXp: 0, updatedAt: new Date().toISOString() });
  return c.json(progress);
});

app.post("/api/pathways/:id/progress/step", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const { lessonId, stepId, result, attempts } = await c.req.json().catch(() => ({})) as { lessonId?: string; stepId?: string; result?: "viewed" | "correct" | "incorrect"; attempts?: number };
  if (!lessonId || !stepId || !result) return c.json({ error: "Missing fields." }, 400);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  await ensureDir(userProgressDir(user.id));
  const progress = await readJsonFile<PathwayProgressData>(progressPath(user.id, pw.id), { lessons: {}, totalXp: 0, updatedAt: new Date().toISOString() });
  if (!progress.lessons[lessonId]) progress.lessons[lessonId] = { completed: false, xpEarned: 0, steps: {}, startedAt: new Date().toISOString() };
  const existing = progress.lessons[lessonId].steps[stepId];
  if (!existing?.completed) {
    progress.lessons[lessonId].steps[stepId] = {
      completed: result === "viewed" || result === "correct",
      correct: result === "correct" ? true : result === "incorrect" ? false : undefined,
      attempts: (attempts ?? 1),
      completedAt: result !== "incorrect" ? new Date().toISOString() : undefined,
    };
  }
  progress.updatedAt = new Date().toISOString();
  await writeJsonFile(progressPath(user.id, pw.id), progress);
  return c.json({ ok: true, lessonProgress: progress.lessons[lessonId] });
});

app.post("/api/pathways/:id/progress/lesson", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const { lessonId } = await c.req.json().catch(() => ({})) as { lessonId?: string };
  if (!lessonId) return c.json({ error: "Missing lessonId." }, 400);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  const lesson = pw.modules.flatMap(m => m.lessons).find(l => l.id === lessonId);
  if (!lesson) return c.json({ error: "Lesson not found." }, 404);
  await ensureDir(userProgressDir(user.id));
  const progress = await readJsonFile<PathwayProgressData>(progressPath(user.id, pw.id), { lessons: {}, totalXp: 0, updatedAt: new Date().toISOString() });
  if (!progress.lessons[lessonId]) progress.lessons[lessonId] = { completed: false, xpEarned: 0, steps: {}, startedAt: new Date().toISOString() };
  if (!progress.lessons[lessonId].completed) {
    const xp = lesson.xpReward ?? 20;
    progress.lessons[lessonId].completed = true;
    progress.lessons[lessonId].xpEarned = xp;
    progress.lessons[lessonId].completedAt = new Date().toISOString();
    progress.totalXp = (progress.totalXp || 0) + xp;
    progress.updatedAt = new Date().toISOString();
    await writeJsonFile(progressPath(user.id, pw.id), progress);
    const stats = await updateUserStats(user.id, xp);
    return c.json({ ok: true, xpEarned: xp, stats });
  }
  progress.updatedAt = new Date().toISOString();
  await writeJsonFile(progressPath(user.id, pw.id), progress);
  const stats = await getUserStats(user.id);
  return c.json({ ok: true, xpEarned: 0, stats });
});

app.post("/api/pathways/:id/fork", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (tier === "free") return c.json({ error: "Forking pathways requires a Pro plan or higher.", upgradeRequired: true }, 402);
  const src = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!src || src.userId !== user.id) return c.json({ error: "Not found." }, 404);
  const newId = `pw_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const forked: Pathway = {
    ...src,
    id: newId,
    title: `${src.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await ensureDir(userPathwaysDir(user.id));
  await writeJsonFile(pathwayPath(user.id, newId), forked);
  return c.json({ id: newId, title: forked.title });
});

app.post("/api/pathways/manual", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (!["pro_plus", "max"].includes(tier) && !isPlatformAdmin(user)) return c.json({ error: "Pro Plus plan required to create manual pathways.", upgradeRequired: true }, 402);
  const pathways = await readJsonFile<string[]>(path.join(userPathwaysDir(user.id), "index.json"), []).catch(() => []);
  const limit = getPathwayLimit(tier);
  if (pathways.length >= limit) return c.json({ error: `Your plan allows ${limit} pathways. Delete one or upgrade.`, upgradeRequired: tier !== "max" }, 402);
  const body = await c.req.json().catch(() => ({})) as { title?: string; description?: string; modules?: any[] };
  if (!body.title?.trim()) return c.json({ error: "Title is required." }, 400);
  const now = new Date().toISOString();
  const id = `pw_manual_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const pathway = {
    id, userId: user.id,
    title: body.title.trim(),
    description: body.description || "",
    fileIds: [],
    modules: body.modules || [],
    status: "ready",
    createdAt: now, updatedAt: now,
  };
  await ensureDir(userPathwaysDir(user.id));
  await writeJsonFile(pathwayPath(user.id, id), pathway);
  const index = [...pathways, id];
  await writeJsonFile(path.join(userPathwaysDir(user.id), "index.json"), index);
  return c.json({ id, pathway }, 201);
});

app.post("/api/pathways/:id/share", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  if (!["pro_plus", "max"].includes(getPlanTier(account)) && !isPlatformAdmin(user)) return c.json({ error: "Pro Plus plan required to share pathways.", upgradeRequired: true }, 402);
  const pw = await readJsonFile<any>(pathwayPath(user.id, c.req.param("id")), null);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Pathway not found." }, 404);
  const token = randomBytes(16).toString("hex");
  const shareDir = path.join(DATA_ROOT, "shared-pathways");
  await ensureDir(shareDir);
  await writeJsonFile(path.join(shareDir, `${token}.json`), { pathwayId: pw.id, userId: user.id, createdAt: new Date().toISOString() });
  pw.shareToken = token;
  await writeJsonFile(pathwayPath(user.id, pw.id), pw);
  return c.json({ token, url: `/pathways/shared/${token}` });
});

app.get("/api/pathways/shared/:token", async (c) => {
  const rawToken = c.req.param("token");
  const token = /^[a-f0-9]{32}$/.test(rawToken) ? rawToken : null;
  if (!token) return c.json({ error: "Invalid share token." }, 400);
  const shareDir = path.join(DATA_ROOT, "shared-pathways");
  const meta = await readJsonFile<{ pathwayId: string; userId: string } | null>(path.join(shareDir, `${token}.json`), null);
  if (!meta) return c.json({ error: "Shared pathway not found or link expired." }, 404);
  const pw = await readJsonFile<any>(pathwayPath(meta.userId, meta.pathwayId), null);
  if (!pw) return c.json({ error: "Pathway not found." }, 404);
  const { userId: _u, ...publicPathway } = pw;
  return c.json({ pathway: publicPathway });
});

app.post("/api/pathways/:id/content", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (tier === "free") return c.json({ error: "Adding content requires a Pro plan or higher.", upgradeRequired: true }, 402);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  if (pw.status !== "ready") return c.json({ error: "Pathway must be ready before adding content." }, 400);
  const body = await c.req.json().catch(() => ({})) as { fileIds?: string[]; topic?: string };
  if (!body.fileIds?.length && !body.topic) return c.json({ error: "Provide fileIds or a topic to extend." }, 400);
  const updatedPw = { ...pw, status: "generating" as const, updatedAt: new Date().toISOString() };
  await writeJsonFile(pathwayPath(user.id, pw.id), updatedPw);
  (async () => {
    try {
      const texts: string[] = [];
      if (body.fileIds?.length) {
        for (const fid of body.fileIds) {
          try { const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8"); texts.push(t.slice(0, 40000)); } catch {}
        }
      }
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");
      const existingSummary = pw.modules.map(m => `Module: ${m.title}`).join("\n");
      const prompt = `You are extending an existing nursing education pathway. The pathway already covers:\n${existingSummary}\n\nAdd ${body.topic ? `new content about: ${body.topic}` : "content from this material"} as 1-2 new modules with lessons. ${texts.length ? `\n\nSOURCE MATERIAL:\n${texts.join("\n\n---\n\n").slice(0, 80000)}` : ""}\n\nReturn ONLY valid JSON for the new modules array to append (same structure as existing modules with id, title, lessons array containing steps of type read/mcq/flashcard). Use unique IDs prefixed with "ext_". No markdown, no commentary.`;
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const newModules = JSON.parse(raw) as PathwayModule[];
      const final = await readJsonFile<Pathway>(pathwayPath(user.id, pw.id), pw);
      await writeJsonFile(pathwayPath(user.id, pw.id), {
        ...final,
        modules: [...final.modules, ...newModules],
        fileIds: [...(final.fileIds || []), ...(body.fileIds || [])],
        status: "ready",
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Content extension failed:", e);
      const failed = await readJsonFile<Pathway>(pathwayPath(user.id, pw.id), pw);
      await writeJsonFile(pathwayPath(user.id, pw.id), { ...failed, status: "ready", updatedAt: new Date().toISOString() });
    }
  })();
  return c.json({ ok: true, message: "Extending pathway in background…" });
});

app.post("/api/pathways/:id/sm2", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const { lessonId, quality } = await c.req.json().catch(() => ({})) as { lessonId?: string; quality?: number };
  if (!lessonId || quality === undefined) return c.json({ error: "Missing lessonId or quality (0-5)." }, 400);
  const pw = await readJsonFile<Pathway>(pathwayPath(user.id, c.req.param("id")), null as any);
  if (!pw || pw.userId !== user.id) return c.json({ error: "Not found." }, 404);
  await ensureDir(userProgressDir(user.id));
  const progress = await readJsonFile<PathwayProgressData>(progressPath(user.id, pw.id), { lessons: {}, totalXp: 0, updatedAt: new Date().toISOString() });
  const lp = progress.lessons[lessonId] || { completed: false, xpEarned: 0, steps: {} };
  const sm2 = (lp as any).sm2 || { ease: 2.5, interval: 1, repetitions: 0 };
  const q = Math.max(0, Math.min(5, quality));
  if (q < 3) {
    sm2.interval = 1;
    sm2.repetitions = 0;
  } else {
    sm2.interval = sm2.repetitions === 0 ? 1 : sm2.repetitions === 1 ? 6 : Math.round(sm2.interval * sm2.ease);
    sm2.repetitions += 1;
    sm2.ease = Math.max(1.3, sm2.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  }
  const nextReview = new Date(Date.now() + sm2.interval * 24 * 60 * 60 * 1000).toISOString();
  sm2.nextReview = nextReview;
  (lp as any).sm2 = sm2;
  progress.lessons[lessonId] = lp;
  progress.updatedAt = new Date().toISOString();
  await writeJsonFile(progressPath(user.id, pw.id), progress);
  return c.json({ ok: true, nextReview, interval: sm2.interval, ease: sm2.ease });
});

app.get("/api/pathways/due", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  await ensureDir(userPathwaysDir(user.id));
  const files = (await readdir(userPathwaysDir(user.id)).catch(() => [])).filter((f) => f.endsWith(".json"));
  const pathways = (await Promise.all(files.map((f) => readJsonFile<Pathway>(path.join(userPathwaysDir(user.id), f), null as any)))).filter(Boolean);
  const now = new Date().toISOString();
  const due: Array<{ pathwayId: string; pathwayTitle: string; lessonId: string; lessonTitle: string; nextReview: string }> = [];
  for (const pw of pathways) {
    if (pw.status !== "ready") continue;
    const progress = await readJsonFile<PathwayProgressData>(progressPath(user.id, pw.id), { lessons: {}, totalXp: 0, updatedAt: now });
    for (const mod of pw.modules) {
      for (const lesson of mod.lessons) {
        const lp = progress.lessons[lesson.id] as any;
        if (lp?.completed && lp.sm2?.nextReview && lp.sm2.nextReview <= now) {
          due.push({ pathwayId: pw.id, pathwayTitle: pw.title, lessonId: lesson.id, lessonTitle: lesson.title, nextReview: lp.sm2.nextReview });
        }
      }
    }
  }
  return c.json({ due, count: due.length });
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Knowledge Web ─────────────────────────────────────────────────────────────
function userWebDir(userId: string) { return path.join(DATA_ROOT, "webs"); }
function webPath(userId: string) { return path.join(userWebDir(userId), `${safeId(userId)}.json`); }
function webProgressPath(userId: string) { return path.join(userWebDir(userId), `${safeId(userId)}-progress.json`); }

// Admin bypass — allows Zo (the AI itself) to read web data without user auth
function isAdminBypass(c: any): boolean {
  const key = c.req.header("x-zo-admin-key");
  return !!key && !!process.env.ZO_API_KEY && key === process.env.ZO_API_KEY;
}

async function resolveFirstWebUserId(): Promise<string | null> {
  try {
    const websDir = path.join(DATA_ROOT, "webs");
    const entries = await readdir(websDir).catch(() => [] as string[]);
    const webFiles = entries.filter(f => f.endsWith(".json") && !f.includes("-progress"));
    if (!webFiles.length) return null;
    const graph = await readJsonFile<WebGraph>(path.join(websDir, webFiles[0]), null as any);
    return graph?.userId || null;
  } catch { return null; }
}

interface WebQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: string;
  explanation: string;
}

interface WebNode {
  id: string;
  title: string;
  content: string;
  category: string;
  prerequisites: string[];
  related: string[];
  quiz: WebQuizQuestion[];
  xpValue: number;
  source: "from-note" | "ai-generated" | "ai-expanded";
  position?: { x: number; y: number };
  depth: number;
  createdAt: string;
}

interface WebGraph {
  userId: string;
  nodes: Record<string, WebNode>;
  rootNodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface WebNodeProgress {
  status: "locked" | "available" | "in-progress" | "mastered";
  sm2: { ease: number; interval: number; repetitions: number; nextReview: string };
  answeredCorrect: number;
  totalAnswered: number;
  completedAt?: string;
  xpEarned: number;
}

interface WebProgressData {
  userId: string;
  nodes: Record<string, WebNodeProgress>;
  totalXp: number;
  updatedAt: string;
}

const WEB_NODE_CATEGORIES = ["pharmacology", "pathophysiology", "nursing-intervention", "anatomy", "assessment", "clinical-reasoning", "procedures", "fundamentals"] as const;
const WEB_GEN_TEMPERATURE = 0.3;

function assignNodePosition(node: WebNode, index: number, totalAtDepth: number, angleOffset: number): void {
  const baseRadius = 180;
  const radiusIncrement = 160;
  const radius = baseRadius + node.depth * radiusIncrement;
  if (node.depth === 0) {
    node.position = { x: 0, y: 0 };
    return;
  }
  const angle = (2 * Math.PI * index / totalAtDepth) + angleOffset;
  node.position = {
    x: Math.round(radius * Math.cos(angle)),
    y: Math.round(radius * Math.sin(angle)),
  };
}

function layoutWebGraph(graph: WebGraph): void {
  const nodesByDepth: Record<number, WebNode[]> = {};
  for (const node of Object.values(graph.nodes)) {
    if (!nodesByDepth[node.depth]) nodesByDepth[node.depth] = [];
    nodesByDepth[node.depth].push(node);
  }
  const angleOffsets: Record<number, number> = {};
  for (const [depth, nodes] of Object.entries(nodesByDepth)) {
    const d = parseInt(depth);
    angleOffsets[d] = d === 0 ? 0 : (Math.random() * Math.PI / nodes.length);
    nodes.forEach((node, i) => assignNodePosition(node, i, nodes.length, angleOffsets[d]));
  }
}

async function getOrCreateWebProgress(userId: string): Promise<WebProgressData> {
  await ensureDir(userWebDir(userId));
  return readJsonFile<WebProgressData>(webProgressPath(userId), {
    userId,
    nodes: {},
    totalXp: 0,
    updatedAt: new Date().toISOString(),
  });
}

function computePrerequisitesMet(
  node: WebNode,
  progress: WebProgressData
): boolean {
  if (!node.prerequisites || node.prerequisites.length === 0) return true;
  return node.prerequisites.every((preReqId) => {
    const np = progress.nodes[preReqId];
    return np && np.status === "mastered";
  });
}

function computeNodeStatus(
  nodeId: string,
  node: WebNode,
  allNodes: Record<string, WebNode>,
  progress: WebProgressData
): "locked" | "available" | "in-progress" | "mastered" {
  const np = progress.nodes[nodeId];
  if (np?.status === "mastered") return "mastered";
  if (np?.status === "in-progress") return "in-progress";
  if (!computePrerequisitesMet(node, progress)) return "locked";
  return "available";
}

function buildWebGeneratePrompt(combinedText: string, existingGraph?: WebGraph): string {
  const existingContext = existingGraph
    ? `\nEXISTING WEB NODES (build on these, do NOT duplicate — enrich existing nodes instead of recreating them):\n${Object.values(existingGraph.nodes).map(n => `- "${n.id}": "${n.title}" (category: ${n.category}, depth: ${n.depth})`).join("\n")}`
    : "";

  return `You are a nursing education knowledge graph designer. Build a knowledge web from this material — each concept becomes a node with deep markdown content, 2-3 quiz questions, and connections to other nodes.

MATERIAL:
${combinedText}${existingContext}

Return ONLY valid JSON (no markdown, no commentary):
{
  "nodes": {
    "n_1": {
      "id": "n_1",
      "title": "Concept name (short, 2-6 words)",
      "content": "## Concept Name\\n\\nDetailed 3-6 paragraph nursing explanation with **bolded** key terms. Include: mechanism, clinical significance, nursing considerations, common drugs/conditions/diseases linked to this concept, memory aids.",
      "category": "One of: pharmacology|pathophysiology|nursing-intervention|anatomy|assessment|clinical-reasoning|procedures|fundamentals",
      "prerequisites": [],
      "related": ["n_3"],
      "quiz": [
        {
          "id": "n_1_q1",
          "question": "MCQ testing the concept?",
          "options": ["Correct", "Distractor", "Distractor", "Distractor"],
          "correctOption": "Correct",
          "explanation": "Why correct is right, why others are wrong."
        }
      ],
      "xpValue": 25,
      "depth": 0
    }
  },
  "rootNodeIds": ["n_1", "n_2"]
}

Rules:
- Extract EVERY distinct nursing/medical concept from the material as its own node
- Content must be DEEP — not a stub. 3-6 substantial paragraphs per node.
- 2-3 quiz questions per node, each with 4 options and explanations.
- Build a prerequisite chain: foundational concepts (depth 0) before advanced ones (depth 1+).
- depth 0 = foundational/entry concepts, depth 1 = builds on 0, depth 2 = builds on 1, etc.
- Each node must have a unique id like "n_1", "n_2", etc.
- rootNodeIds lists the depth-0 nodes (starting points with no prerequisites).
- "prerequisites" lists node IDs that MUST be mastered before this node is available.
- "related" lists node IDs for soft/non-gated connections.
- XP values: 20 for simple concepts, 30 for complex ones, 40 for very deep ones.`;
}

function buildWebExpandPrompt(node: WebNode, existingGraph: WebGraph): string {
  const siblingTitles = Object.values(existingGraph.nodes)
    .filter(n => n.id !== node.id)
    .map(n => `- "${n.id}": "${n.title}" (depth: ${n.depth}, category: ${n.category})`)
    .join("\n");

  return `You are expanding a nursing knowledge web. From the concept "${node.title}" (category: ${node.category}, depth: ${node.depth}), generate 3-6 child nodes that represent the NEXT layer of knowledge building on this concept.

EXISTING NODE CONTENT:
${node.content.slice(0, 3000)}

ALL EXISTING NODES IN WEB (do NOT duplicate):
${siblingTitles}

Return ONLY valid JSON:
{
  "nodes": {
    "n_exp1": {
      "id": "n_exp1",
      "title": "Child concept title",
      "content": "## Title\\n\\nDetailed content...",
      "category": "One of: pharmacology|pathophysiology|nursing-intervention|anatomy|assessment|clinical-reasoning|procedures|fundamentals",
      "prerequisites": ["${node.id}"],
      "related": [],
      "quiz": [ { "id": "n_exp1_q1", "question": "...", "options": ["A","B","C","D"], "correctOption": "A", "explanation": "..." } ],
      "xpValue": 25,
      "depth": ${node.depth + 1}
    }
  }
}

Rules:
- Generate 3-6 child nodes that branch FROM "${node.title}"
- Each child at depth ${node.depth + 1}
- Content must be DEEP (3-6 paragraphs)
- 2-3 quiz questions each with 4 options + explanations
- These nodes logically follow from "${node.title}" — think "what would a nursing student need to learn next?"
- Set "prerequisites" to include "${node.id}" for all generated nodes
- Fill in "related" connections to other existing nodes when sensible`;
}

function buildEnrichPrompt(node: WebNode, newContent: string): string {
  return `You are enriching an existing nursing knowledge web node with additional material.

EXISTING NODE:
Title: ${node.title}
Content: ${node.content.slice(0, 3000)}
Quiz questions: ${JSON.stringify(node.quiz.map(q => q.question))}

NEW MATERIAL TO INCORPORATE:
${newContent.slice(0, 8000)}

Return ONLY valid JSON:
{
  "content": "## ${node.title}\\n\\nMerged and enriched content combining the existing material and new material. Keep the best of both, remove redundancy, maintain depth (4-8 paragraphs).",
  "addedQuiz": [
    {
      "id": "${node.id}_q_new1",
      "question": "New question based on the added material?",
      "options": ["A","B","C","D"],
      "correctOption": "A",
      "explanation": "Explanation"
    }
  ],
  "addedPrerequisites": [],
  "addedRelated": []
}

Rules:
- Merge content intelligently — enrich, don't just append
- addedQuiz: 1-2 new questions covering the NEW material only
- addedPrerequisites: node IDs from new material that should be prerequisites
- addedRelated: node IDs from new material for soft connections`;
}

function buildWebFromTopicPrompt(topic: string): string {
  return `You are a nursing education knowledge graph designer. Generate a comprehensive knowledge web from scratch on this topic: "${topic}".

Return ONLY valid JSON (no markdown, no commentary):
{
  "nodes": {
    "n_1": {
      "id": "n_1",
      "title": "Concept name (short, 2-6 words)",
      "content": "## Concept Name\\n\\nDetailed 4-6 paragraph nursing explanation with **bolded** key terms. Include: mechanism, clinical significance, nursing considerations, common drugs/conditions/diseases, memory aids.",
      "category": "One of: pharmacology|pathophysiology|nursing-intervention|anatomy|assessment|clinical-reasoning|procedures|fundamentals",
      "prerequisites": [],
      "related": ["n_3"],
      "quiz": [
        {
          "id": "n_1_q1",
          "question": "MCQ testing the concept?",
          "options": ["Correct", "Distractor", "Distractor", "Distractor"],
          "correctOption": "Correct",
          "explanation": "Why correct is right, why others are wrong."
        }
      ],
      "xpValue": 25,
      "depth": 0
    }
  },
  "rootNodeIds": ["n_1", "n_2"]
}

Rules:
- Generate 15-25 nodes covering the full topic thoroughly
- Content must be DEEP — 3-6 substantial paragraphs per node
- 2-3 quiz questions per node, each with 4 options and explanations
- Build a prerequisite chain: foundational concepts (depth 0), then intermediate (depth 1), then advanced (depth 2+)
- Each node must have a unique id like "n_1", "n_2", etc.
- rootNodeIds lists the depth-0 entry points
- Fill in "related" connections between conceptually linked nodes
- Cover ALL relevant subtopics: anatomy, physiology, pharmacology, nursing interventions, assessment, and clinical reasoning where applicable
- XP values: 20 for simple concepts, 30 for complex ones, 40 for very deep ones.`;
}

// ── Knowledge Web Endpoints ───────────────────────────────────────────────────

app.post("/api/web/generate", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to generate a knowledge web." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (tier === "free") return c.json({ error: "Knowledge webs require a Pro plan or higher.", upgradeRequired: true }, 402);

  const body = await c.req.json().catch(() => ({})) as { fileIds?: string[]; title?: string };
  if (!body.fileIds?.length) return c.json({ error: "Select at least one file." }, 400);

  await ensureDir(userWebDir(user.id));

  const stub: WebGraph = {
    userId: user.id,
    nodes: {},
    rootNodeIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(webPath(user.id), stub);

  (async () => {
    try {
      const texts: string[] = [];
      for (const fid of body.fileIds!) {
        try {
          const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8");
          texts.push(t.slice(0, 50000));
        } catch {}
      }
      const combinedText = texts.join("\n\n---\n\n").slice(0, 120000);
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");

      const prompt = buildWebGeneratePrompt(combinedText);
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);

      const nodes: Record<string, WebNode> = {};
      const now = new Date().toISOString();
      for (const [id, node] of Object.entries(generated.nodes || {})) {
        const n = node as any;
        nodes[id] = {
          id,
          title: n.title || id,
          content: n.content || "",
          category: WEB_NODE_CATEGORIES.includes(n.category) ? n.category : "fundamentals",
          prerequisites: n.prerequisites || [],
          related: n.related || [],
          quiz: (n.quiz || []).map((q: any) => ({
            id: q.id || `${id}_q${Math.random().toString(36).slice(2, 6)}`,
            question: q.question || "",
            options: q.options || [],
            correctOption: q.correctOption || "",
            explanation: q.explanation || "",
          })),
          xpValue: n.xpValue || 25,
          source: "from-note",
          depth: n.depth ?? 0,
          createdAt: now,
        };
      }

      const updated: WebGraph = {
        ...stub,
        nodes,
        rootNodeIds: generated.rootNodeIds || Object.entries(nodes).filter(([_, n]) => n.depth === 0).map(([id]) => id),
        updatedAt: now,
      };
      layoutWebGraph(updated);
      await writeJsonFile(webPath(user.id), updated);

      // Initialize progress
      const progress = await getOrCreateWebProgress(user.id);
      for (const nodeId of Object.keys(nodes)) {
        if (!progress.nodes[nodeId]) {
          progress.nodes[nodeId] = {
            status: "available",
            sm2: { ease: 2.5, interval: 1, repetitions: 0, nextReview: now },
            answeredCorrect: 0,
            totalAnswered: 0,
            xpEarned: 0,
          };
        }
      }
      progress.updatedAt = now;
      await writeJsonFile(webProgressPath(user.id), progress);
    } catch (e) {
      console.error("Web generation error:", e);
      await writeJsonFile(webPath(user.id), { ...stub, updatedAt: new Date().toISOString() });
    }
  })();

  return c.json({ ok: true, message: "Generating knowledge web…" });
});

app.post("/api/web/generate-from-topic", async (c) => {
  const adminBypass = isAdminBypass(c);
  if (!adminBypass) {
    const realUser = requireCurrentUser(c);
    if (!realUser) return c.json({ error: "Sign in to generate a knowledge web." }, 401);
    const account = await getStoredUser(realUser);
    const tier = getPlanTier(account);
    if (tier === "free") return c.json({ error: "Knowledge webs require a Pro plan or higher.", upgradeRequired: true }, 402);
  }
  const effectiveUserId = adminBypass ? "demo_admin" : requireCurrentUser(c)!.id;

  const body = await c.req.json().catch(() => ({})) as { topic?: string };
  if (!body.topic?.trim()) return c.json({ error: "Provide a topic." }, 400);

  await ensureDir(userWebDir(effectiveUserId));

  const stub: WebGraph = {
    userId: effectiveUserId, nodes: {}, rootNodeIds: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(webPath(effectiveUserId), stub);

  (async () => {
    try {
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");

      const prompt = buildWebFromTopicPrompt(body.topic!);
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);

      const nodes: Record<string, WebNode> = {};
      const now = new Date().toISOString();
      for (const [id, node] of Object.entries(generated.nodes || {})) {
        const n = node as any;
        nodes[id] = {
          id, title: n.title || id, content: n.content || "",
          category: WEB_NODE_CATEGORIES.includes(n.category) ? n.category : "fundamentals",
          prerequisites: n.prerequisites || [], related: n.related || [],
          quiz: (n.quiz || []).map((q: any) => ({
            id: q.id || `${id}_q${Math.random().toString(36).slice(2, 6)}`,
            question: q.question || "", options: q.options || [],
            correctOption: q.correctOption || "", explanation: q.explanation || "",
          })),
          xpValue: n.xpValue || 25, source: "ai-generated", depth: n.depth ?? 0, createdAt: now,
        };
      }

      const updated: WebGraph = {
        ...stub, nodes,
        rootNodeIds: generated.rootNodeIds || Object.entries(nodes).filter(([_, n]) => n.depth === 0).map(([id]) => id),
        updatedAt: now,
      };
      layoutWebGraph(updated);
      await writeJsonFile(webPath(effectiveUserId), updated);

      const progress = await getOrCreateWebProgress(effectiveUserId);
      for (const nodeId of Object.keys(nodes)) {
        if (!progress.nodes[nodeId]) {
          progress.nodes[nodeId] = {
            status: "available",
            sm2: { ease: 2.5, interval: 1, repetitions: 0, nextReview: now },
            answeredCorrect: 0, totalAnswered: 0, xpEarned: 0,
          };
        }
      }
      progress.updatedAt = now;
      await writeJsonFile(webProgressPath(effectiveUserId), progress);
    } catch (e) {
      console.error("Web topic generation error:", e);
      await writeJsonFile(webPath(effectiveUserId), { ...stub, updatedAt: new Date().toISOString() });
    }
  })();

  return c.json({ ok: true, message: "Generating knowledge web from topic…" });
});

app.post("/api/web/add-files", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  const tier = getPlanTier(account);
  if (tier === "free") return c.json({ error: "Knowledge webs require a Pro plan or higher.", upgradeRequired: true }, 402);

  const body = await c.req.json().catch(() => ({})) as { fileIds?: string[] };
  if (!body.fileIds?.length) return c.json({ error: "Select at least one file." }, 400);

  const existing = await readJsonFile<WebGraph>(webPath(user.id), null as any);
  if (!existing || !Object.keys(existing.nodes).length) {
    return c.json({ error: "No existing knowledge web found. Generate one first.", upgradeRequired: false }, 400);
  }

  await writeJsonFile(webPath(user.id), { ...existing, updatedAt: new Date().toISOString() });

  (async () => {
    try {
      const texts: string[] = [];
      for (const fid of body.fileIds!) {
        try {
          const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8");
          texts.push(t.slice(0, 50000));
        } catch {}
      }
      const combinedText = texts.join("\n\n---\n\n").slice(0, 120000);
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");

      const prompt = buildWebGeneratePrompt(combinedText, existing);
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);

      const now = new Date().toISOString();
      const progress = await getOrCreateWebProgress(user.id);
      let newNodeCount = 0;

      for (const [id, node] of Object.entries(generated.nodes || {})) {
        const n = node as any;
        if (existing.nodes[id]) {
          // Enrich existing node
          const existingNode = existing.nodes[id];
          if (n.content && n.content !== existingNode.content) {
            existingNode.content = existingNode.content + "\n\n---\n\n### Additional Material\n\n" + n.content;
          }
          if (n.quiz?.length) {
            existingNode.quiz.push(...n.quiz.filter((q: any) =>
              !existingNode.quiz.some(eq => eq.question === q.question)
            ).map((q: any) => ({
              id: q.id || `${id}_q${Math.random().toString(36).slice(2, 6)}`,
              question: q.question || "",
              options: q.options || [],
              correctOption: q.correctOption || "",
              explanation: q.explanation || "",
            })));
          }
          if (n.related?.length) {
            existingNode.related = [...new Set([...existingNode.related, ...n.related])];
          }
        } else {
          existing.nodes[id] = {
            id,
            title: n.title || id,
            content: n.content || "",
            category: WEB_NODE_CATEGORIES.includes(n.category) ? n.category : "fundamentals",
            prerequisites: n.prerequisites || [],
            related: n.related || [],
            quiz: (n.quiz || []).map((q: any) => ({
              id: q.id || `${id}_q${Math.random().toString(36).slice(2, 6)}`,
              question: q.question || "",
              options: q.options || [],
              correctOption: q.correctOption || "",
              explanation: q.explanation || "",
            })),
            xpValue: n.xpValue || 25,
            source: "from-note",
            depth: n.depth ?? 0,
            createdAt: now,
            position: undefined,
          };
          progress.nodes[id] = {
            status: "available",
            sm2: { ease: 2.5, interval: 1, repetitions: 0, nextReview: now },
            answeredCorrect: 0,
            totalAnswered: 0,
            xpEarned: 0,
          };
          newNodeCount++;
        }
      }

      if (generated.rootNodeIds?.length) {
        existing.rootNodeIds = [...new Set([...existing.rootNodeIds, ...generated.rootNodeIds])];
      }

      existing.updatedAt = now;
      layoutWebGraph(existing);
      await writeJsonFile(webPath(user.id), existing);
      progress.updatedAt = now;
      await writeJsonFile(webProgressPath(user.id), progress);
    } catch (e) {
      console.error("Web add-files error:", e);
    }
  })();

  return c.json({ ok: true, message: "Adding new content to knowledge web…" });
});

app.get("/api/web", async (c) => {
  const adminBypass = isAdminBypass(c);
  const user = adminBypass ? null : requireCurrentUser(c);
  if (!user && !adminBypass) return c.json({ error: "Sign in." }, 401);
  
  let userId: string;
  if (adminBypass) {
    // Admin mode: scan webs dir for any user's web
    const websDir = userWebDir("");
    try {
      const entries = await readdir(path.join(DATA_ROOT, "webs"));
      const webFiles = entries.filter(f => f.endsWith(".json") && !f.includes("-progress"));
      if (!webFiles.length) return c.json({ exists: false, nodes: {}, rootNodeIds: [] });
      // Look up the graph to get the userId from it
      const graph = await readJsonFile<WebGraph>(path.join(websDir, webFiles[0]), null as any);
      if (!graph) return c.json({ exists: false, nodes: {}, rootNodeIds: [] });
      userId = graph.userId;
    } catch {
      return c.json({ exists: false, nodes: {}, rootNodeIds: [] });
    }
  } else {
    userId = user!.id;
  }
  
  const graph = await readJsonFile<WebGraph>(webPath(userId), null as any);
  if (!graph || !Object.keys(graph.nodes).length) {
    return c.json({ exists: false, nodes: {}, rootNodeIds: [] });
  }
  const progress = await getOrCreateWebProgress(userId);

  // Compute live status for each node
  const nodesWithStatus: Record<string, any> = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    const status = computeNodeStatus(id, node, graph.nodes, progress);
    const np = progress.nodes[id];
    nodesWithStatus[id] = {
      ...node,
      status,
      progress: np ? {
        answeredCorrect: np.answeredCorrect,
        totalAnswered: np.totalAnswered,
        sm2: np.sm2,
      } : null,
    };
  }

  return c.json({
    exists: true,
    nodes: nodesWithStatus,
    rootNodeIds: graph.rootNodeIds,
    updatedAt: graph.updatedAt,
  });
});

app.get("/api/web/nodes/:nodeId", async (c) => {
  const adminBypass = isAdminBypass(c);
  const user = adminBypass ? null : requireCurrentUser(c);
  if (!user && !adminBypass) return c.json({ error: "Sign in." }, 401);
  const userId = adminBypass ? await resolveFirstWebUserId() : user!.id;
  if (!userId) return c.json({ error: "No knowledge web found." }, 404);
  const graph = await readJsonFile<WebGraph>(webPath(userId), null as any);
  if (!graph) return c.json({ error: "No knowledge web found." }, 404);
  const nodeId = c.req.param("nodeId");
  const node = graph.nodes[nodeId];
  if (!node) return c.json({ error: "Node not found." }, 404);
  const progress = await getOrCreateWebProgress(userId);
  const status = computeNodeStatus(nodeId, node, graph.nodes, progress);
  const np = progress.nodes[nodeId];
  return c.json({
    ...node,
    status,
    progress: np ? {
      answeredCorrect: np.answeredCorrect,
      totalAnswered: np.totalAnswered,
      sm2: np.sm2,
    } : null,
    canAccess: status !== "locked",
  });
});

app.post("/api/web/nodes/:nodeId/expand", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  if (getPlanTier(account) === "free") return c.json({ error: "Requires a Pro plan or higher.", upgradeRequired: true }, 402);

  const nodeId = c.req.param("nodeId");
  const graph = await readJsonFile<WebGraph>(webPath(user.id), null as any);
  if (!graph) return c.json({ error: "No knowledge web found." }, 404);
  const node = graph.nodes[nodeId];
  if (!node) return c.json({ error: "Node not found." }, 404);

  await writeJsonFile(webPath(user.id), { ...graph, updatedAt: new Date().toISOString() });

  (async () => {
    try {
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");

      const prompt = buildWebExpandPrompt(node, graph);
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const generated = JSON.parse(raw);

      const now = new Date().toISOString();
      const progress = await getOrCreateWebProgress(user.id);
      const newIds: string[] = [];

      for (const [id, newNode] of Object.entries(generated.nodes || {})) {
        const n = newNode as any;
        if (graph.nodes[id]) continue; // skip duplicates
        const prefix = `n_${nodeId.slice(2)}`;
        const freshId = `${prefix}_exp${newIds.length + 1}_${now.slice(11, 19).replace(/:/g, "")}`;
        graph.nodes[freshId] = {
          id: freshId,
          title: n.title || `Expansion on ${node.title}`,
          content: n.content || "",
          category: WEB_NODE_CATEGORIES.includes(n.category) ? n.category : node.category,
          prerequisites: [nodeId, ...(n.prerequisites || [])],
          related: n.related || [nodeId],
          quiz: (n.quiz || []).map((q: any) => ({
            id: q.id || `${freshId}_q${Math.random().toString(36).slice(2, 6)}`,
            question: q.question || "",
            options: q.options || [],
            correctOption: q.correctOption || "",
            explanation: q.explanation || "",
          })),
          xpValue: n.xpValue || 30,
          source: "ai-expanded",
          depth: node.depth + 1,
          createdAt: now,
        };
        progress.nodes[freshId] = {
          status: "locked",
          sm2: { ease: 2.5, interval: 1, repetitions: 0, nextReview: now },
          answeredCorrect: 0,
          totalAnswered: 0,
          xpEarned: 0,
        };
        newIds.push(freshId);
      }

      graph.updatedAt = now;
      layoutWebGraph(graph);
      await writeJsonFile(webPath(user.id), graph);
      progress.updatedAt = now;
      await writeJsonFile(webProgressPath(user.id), progress);
    } catch (e) {
      console.error("Web expand error:", e);
    }
  })();

  return c.json({ ok: true, message: `Expanding from "${node.title}"…` });
});

app.post("/api/web/nodes/:nodeId/enrich", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);
  const account = await getStoredUser(user);
  if (getPlanTier(account) === "free") return c.json({ error: "Requires a Pro plan or higher.", upgradeRequired: true }, 402);

  const nodeId = c.req.param("nodeId");
  const body = await c.req.json().catch(() => ({})) as { fileIds?: string[]; customContent?: string };
  if (!body.fileIds?.length && !body.customContent) return c.json({ error: "Provide fileIds or custom content." }, 400);

  const graph = await readJsonFile<WebGraph>(webPath(user.id), null as any);
  if (!graph) return c.json({ error: "No knowledge web found." }, 404);
  const node = graph.nodes[nodeId];
  if (!node) return c.json({ error: "Node not found." }, 404);

  let newContent = body.customContent || "";
  if (body.fileIds?.length) {
    const texts: string[] = [];
    for (const fid of body.fileIds!) {
      try {
        const t = await readFile(path.join(fileDir(user.id, fid), "text.txt"), "utf8");
        texts.push(t.slice(0, 50000));
      } catch {}
    }
    newContent = texts.join("\n\n---\n\n").slice(0, 120000);
  }

  (async () => {
    try {
      const token = await getZoToken();
      if (!token) throw new Error("No AI token");

      const prompt = buildEnrichPrompt(node, newContent);
      const resp = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ input: prompt, model_name: process.env.MAIA_PRO_MODEL || PRO_MAIA_MODEL }),
      });
      const data = await resp.json() as { output?: string };
      const raw = (data.output || "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const enriched = JSON.parse(raw);

      if (enriched.content) node.content = enriched.content;
      if (enriched.addedQuiz?.length) {
        node.quiz.push(...enriched.addedQuiz.map((q: any) => ({
          id: q.id || `${nodeId}_q${Math.random().toString(36).slice(2, 6)}`,
          question: q.question || "",
          options: q.options || [],
          correctOption: q.correctOption || "",
          explanation: q.explanation || "",
        })));
      }
      if (enriched.addedPrerequisites?.length) {
        node.prerequisites = [...new Set([...node.prerequisites, ...enriched.addedPrerequisites])];
      }
      if (enriched.addedRelated?.length) {
        node.related = [...new Set([...node.related, ...enriched.addedRelated])];
      }

      graph.updatedAt = new Date().toISOString();
      await writeJsonFile(webPath(user.id), graph);
    } catch (e) {
      console.error("Web enrich error:", e);
    }
  })();

  return c.json({ ok: true, message: `Enriching "${node.title}"…` });
});

app.post("/api/web/nodes/:nodeId/quiz", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in." }, 401);

  const nodeId = c.req.param("nodeId");
  const body = await c.req.json().catch(() => ({})) as { answers: Record<string, string> };
  if (!body.answers || !Object.keys(body.answers).length) {
    return c.json({ error: "Provide answers to quiz questions." }, 400);
  }

  const graph = await readJsonFile<WebGraph>(webPath(user.id), null as any);
  if (!graph) return c.json({ error: "No knowledge web found." }, 404);
  const node = graph.nodes[nodeId];
  if (!node) return c.json({ error: "Node not found." }, 404);

  const progress = await getOrCreateWebProgress(user.id);
  let np = progress.nodes[nodeId];
  if (!np) {
    np = {
      status: "locked",
      sm2: { ease: 2.5, interval: 1, repetitions: 0, nextReview: new Date().toISOString() },
      answeredCorrect: 0,
      totalAnswered: 0,
      xpEarned: 0,
    };
  }

  // Grade answers
  let correct = 0;
  let total = 0;
  const results: Record<string, { correct: boolean; expected: string }> = {};

  for (const [qId, answer] of Object.entries(body.answers)) {
    const question = node.quiz.find(q => q.id === qId);
    if (!question) continue;
    total++;
    const isCorrect = answer.trim().toLowerCase() === question.correctOption.trim().toLowerCase();
    if (isCorrect) correct++;
    results[qId] = { correct: isCorrect, expected: question.correctOption };
  }

  np.totalAnswered = (np.totalAnswered || 0) + total;
  np.answeredCorrect = (np.answeredCorrect || 0) + correct;

  const pct = total > 0 ? correct / total : 0;

  // SM-2 update
  const quality = pct >= 0.9 ? 5 : pct >= 0.75 ? 4 : pct >= 0.5 ? 3 : pct >= 0.3 ? 2 : 1;
  const sm2 = np.sm2 || { ease: 2.5, interval: 1, repetitions: 0, nextReview: new Date().toISOString() };
  if (quality < 3) {
    sm2.interval = 1;
    sm2.repetitions = 0;
  } else {
    sm2.interval = sm2.repetitions === 0 ? 1 : sm2.repetitions === 1 ? 6 : Math.round(sm2.interval * sm2.ease);
    sm2.repetitions += 1;
    sm2.ease = Math.max(1.3, sm2.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  }
  sm2.nextReview = new Date(Date.now() + sm2.interval * 24 * 60 * 60 * 1000).toISOString();
  np.sm2 = sm2;

  // Mastery
  const newlyMastered = pct >= 0.8 && total >= node.quiz.length && np.status !== "mastered";
  if (newlyMastered) {
    np.status = "mastered";
    np.completedAt = new Date().toISOString();
    np.xpEarned = node.xpValue;
    progress.totalXp += node.xpValue;
    await updateUserStats(user.id, node.xpValue);
  } else if (np.status === "locked" || np.status === "available") {
    np.status = "in-progress";
  }

  progress.nodes[nodeId] = np;
  progress.updatedAt = new Date().toISOString();
  await writeJsonFile(webProgressPath(user.id), progress);

  const stats = await getUserStats(user.id);

  return c.json({
    results,
    correct,
    total,
    pct: Math.round(pct * 100),
    mastered: newlyMastered,
    xpEarned: newlyMastered ? node.xpValue : 0,
    sm2: { nextReview: sm2.nextReview, interval: sm2.interval, ease: sm2.ease },
    stats,
    newlyUnlocked: newlyMastered ? Object.values(graph.nodes)
      .filter(n => n.prerequisites.includes(nodeId) && computePrerequisitesMet(n, progress))
      .map(n => ({ id: n.id, title: n.title })) : [],
  });
});

app.get("/api/web/progress", async (c) => {
  const adminBypass = isAdminBypass(c);
  const user = adminBypass ? null : requireCurrentUser(c);
  if (!user && !adminBypass) return c.json({ error: "Sign in." }, 401);
  const userId = adminBypass ? (await resolveFirstWebUserId() || "") : user!.id;
  if (!userId) return c.json({ nodes: {}, totalXp: 0, userId: '' });
  const progress = await getOrCreateWebProgress(userId);
  return c.json(progress);
});

app.get("/api/web/due", async (c) => {
  const adminBypass = isAdminBypass(c);
  const user = adminBypass ? null : requireCurrentUser(c);
  if (!user && !adminBypass) return c.json({ error: "Sign in." }, 401);
  const userId = adminBypass ? (await resolveFirstWebUserId() || "") : user!.id;
  const graph = await readJsonFile<WebGraph>(webPath(userId), null as any);
  if (!graph) return c.json({ due: [], count: 0 });
  const progress = await getOrCreateWebProgress(userId);
  const now = new Date().toISOString();
  const due: Array<{ nodeId: string; title: string; category: string; nextReview: string }> = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    const np = progress.nodes[id];
    if (np?.status === "mastered" && np.sm2?.nextReview && np.sm2.nextReview <= now) {
      due.push({ nodeId: id, title: node.title, category: node.category, nextReview: np.sm2.nextReview });
    }
  }
  return c.json({ due, count: due.length });
});

// ─────────────────────────────────────────────────────────────────────────────

// Procedures — loaded from per-category JSON files in data/procedures/
const proceduresDir = path.join(DATA_ROOT, "procedures");

async function loadAllProcedures(): Promise<any[]> {
  try {
    const files = (await readdir(proceduresDir)).filter(
      (f) => f.endsWith(".json") && f !== "index.json"
    );
    const all: any[] = [];
    for (const file of files) {
      const data = await readJsonFile<any[]>(path.join(proceduresDir, file), []);
      all.push(...data);
    }
    return all;
  } catch {
    return [];
  }
}

app.get("/api/procedures", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to access procedures." }, 401);
  const procedures = await loadAllProcedures();
  return c.json(procedures.map(({ id, title, category, icon, summary }) => ({ id, title, category, icon, summary })));
});

app.get("/api/procedures/:id", async (c) => {
  const user = requireCurrentUser(c);
  if (!user) return c.json({ error: "Sign in to access procedures." }, 401);
  const procedures = await loadAllProcedures();
  const proc = procedures.find((p) => p.id === c.req.param("id"));
  if (!proc) return c.json({ error: "Procedure not found." }, 404);
  return c.json(proc);
});

app.post("/api/reports/wrong-answer", async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json().catch(() => ({}));
  const report = {
    id: `report_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    userId: user?.id || null,
    email: user?.email || null,
    context: String(body.context || "chat").slice(0, 80),
    prompt: String(body.prompt || "").slice(0, 4000),
    answer: String(body.answer || "").slice(0, 12000),
    note: String(body.note || "").slice(0, 1000),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  await writeJsonFile(path.join(reportsDir, `${report.id}.json`), report);
  return c.json({ ok: true, reportId: report.id });
});

app.post("/api/nclex/attempts", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ error: "Please sign in to track NCLEX progress." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const filePath = path.join(nclexDir, `${safeId(user.id)}.json`);
  const attempts = await readJsonFile<any[]>(filePath, []);
  const attempt = {
    id: `attempt_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
    topic: String(body.topic || "NCLEX practice").slice(0, 120),
    type: body.type === "sata" ? "sata" : "mcq",
    correct: !!body.correct,
    selected: Array.isArray(body.selected) ? body.selected.map(String).slice(0, 8) : [],
    correctAnswers: Array.isArray(body.correctAnswers) ? body.correctAnswers.map(String).slice(0, 8) : [],
    createdAt: new Date().toISOString(),
  };
  attempts.push(attempt);
  await writeJsonFile(filePath, attempts.slice(-500));
  const total = attempts.length;
  const right = attempts.filter((a) => a.correct).length;
  const byTopic: Record<string, { total: number; right: number }> = {};
  for (const item of attempts) {
    const key = String(item.topic || "Other");
    byTopic[key] ||= { total: 0, right: 0 };
    byTopic[key].total++;
    if (item.correct) byTopic[key].right++;
  }
  return c.json({ ok: true, attempt, stats: { total, right, wrong: total - right, percent: total ? Math.round((right / total) * 100) : 0, byTopic } });
});

app.get("/api/nclex/attempts", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ attempts: [], stats: { total: 0, right: 0, wrong: 0, percent: 0, byTopic: {} } });
  const attempts = await readJsonFile<any[]>(path.join(nclexDir, `${safeId(user.id)}.json`), []);
  const total = attempts.length;
  const right = attempts.filter((a) => a.correct).length;
  const byTopic: Record<string, { total: number; right: number }> = {};
  for (const item of attempts) {
    const key = String(item.topic || "Other");
    byTopic[key] ||= { total: 0, right: 0 };
    byTopic[key].total++;
    if (item.correct) byTopic[key].right++;
  }
  return c.json({ attempts: attempts.slice(-50).reverse(), stats: { total, right, wrong: total - right, percent: total ? Math.round((right / total) * 100) : 0, byTopic } });
});


async function listJsonFiles<T>(dir: string): Promise<T[]> {
  await ensureDir(dir);
  const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const items = await Promise.all(files.map((file) => readJsonFile<T | null>(path.join(dir, file), null)));
  return items.filter(Boolean) as T[];
}

function estimateGeminiCostFromActions(actions: number) {
  const estimatedCostPerAction = 0.015;
  return Math.round(actions * estimatedCostPerAction * 100) / 100;
}

app.get("/api/admin/dashboard", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  const [users, reports, tools] = await Promise.all([
    listJsonFiles<StoredUser>(usersDir),
    listJsonFiles<any>(reportsDir),
    listJsonFiles<any>(generatedToolsDir),
  ]);
  await ensureDir(usageDir);
  await ensureDir(nclexDir);
  const usageFiles = (await readdir(usageDir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const usageRows = await Promise.all(usageFiles.map(async (file) => {
    const raw = await readJsonFile<Record<string, number>>(path.join(usageDir, file), {});
    const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.json$/);
    const userId = match?.[1] || file.replace(/\.json$/, "");
    const date = match?.[2] || "unknown";
    const account = users.find((u) => safeId(u.id) === userId || u.id === userId);
    const messages = Number(raw.messages || 0);
    return { file, userId, date, email: account?.email || null, messages, estimatedCost: estimateGeminiCostFromActions(messages) };
  }));
  const nclexFiles = (await readdir(nclexDir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const nclexRows = await Promise.all(nclexFiles.map(async (file) => {
    const attempts = await readJsonFile<any[]>(path.join(nclexDir, file), []);
    const userId = file.replace(/\.json$/, "");
    const account = users.find((u) => safeId(u.id) === userId || u.id === userId);
    const total = attempts.length;
    const right = attempts.filter((a) => a.correct).length;
    return { userId, email: account?.email || null, total, right, percent: total ? Math.round((right / total) * 100) : 0 };
  }));
  const today = usageKey();
  const totalActions = usageRows.reduce((sum, row) => sum + row.messages, 0);
  const todayActions = usageRows.filter((row) => row.date === today).reduce((sum, row) => sum + row.messages, 0);
  const proUsers = users.filter((u) => u.plan === "pro").length;
  const proPlusUsers = users.filter((u) => u.plan === "pro_plus").length;
  const maxUsers = users.filter((u) => u.plan === "max").length;
  return c.json({
    summary: {
      users: users.length,
      proUsers,
      proPlusUsers,
      maxUsers,
      freeUsers: users.length - proUsers - proPlusUsers - maxUsers,
      generatedTools: tools.length,
      pendingTools: tools.filter((t: any) => t.status === "pending").length,
      openReports: reports.filter((r: any) => (r.status || "open") === "open").length,
      totalAiActions: totalActions,
      todayAiActions: todayActions,
      estimatedTotalCost: estimateGeminiCostFromActions(totalActions),
      estimatedTodayCost: estimateGeminiCostFromActions(todayActions),
    },
    users: users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    usage: usageRows.sort((a, b) => `${b.date}${b.messages}`.localeCompare(`${a.date}${a.messages}`)),
    generatedTools: tools.sort((a: any, b: any) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))),
    reports: reports.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    nclex: nclexRows.sort((a, b) => b.total - a.total),
    costAssumptions: { estimatedCostPerAiAction: 0.015, note: "Conservative planning estimate until provider billing exports are connected." },
  });
});

app.post("/api/admin/users/:id", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const account = await readJsonFile<StoredUser | null>(userPath(id), null);
  if (!account) return c.json({ error: "User not found" }, 404);
  const updated: StoredUser = {
    ...account,
    plan: ["pro", "pro_plus", "max"].includes(body.plan) ? body.plan : "free",
    subscriptionStatus: body.subscriptionStatus === "active" ? "active" : ["pro", "pro_plus", "max"].includes(body.plan) ? "active" : null,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(userPath(id), updated);
  return c.json({ user: updated });
});

app.delete("/api/admin/generated-tools/:id", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  const id = slugifyTool(c.req.param("id"));
  const filePath = path.join(generatedToolsDir, `${id}.json`);
  const tool = await readJsonFile<any | null>(filePath, null);
  if (!tool) return c.json({ error: "Tool not found" }, 404);
  const trashDir = path.join(DATA_ROOT, "deleted-generated-tools");
  await ensureDir(trashDir);
  await writeJsonFile(path.join(trashDir, `${id}-${Date.now()}.json`), { ...tool, deletedBy: user.email, deletedAt: new Date().toISOString() });
  await Bun.file(filePath).delete().catch(() => {});
  return c.json({ ok: true });
});

app.post("/api/admin/reports/:id", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  const id = String(c.req.param("id") || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const body = await c.req.json().catch(() => ({}));
  const filePath = path.join(reportsDir, `${id}.json`);
  const report = await readJsonFile<any | null>(filePath, null);
  if (!report) return c.json({ error: "Report not found" }, 404);
  const updated = { ...report, status: body.status === "closed" ? "closed" : "open", reviewedBy: user.email, reviewedAt: new Date().toISOString() };
  await writeJsonFile(filePath, updated);
  return c.json({ report: updated });
});

app.get("/api/admin/review", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  await ensureGeneratedToolsDir();
  await ensureDir(reportsDir);
  const toolFiles = (await readdir(generatedToolsDir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const tools = (await Promise.all(toolFiles.map(async (file) => readJsonFile<any | null>(path.join(generatedToolsDir, file), null)))).filter(Boolean);
  const reportFiles = (await readdir(reportsDir).catch(() => [])).filter((file) => file.endsWith(".json"));
  const reports = (await Promise.all(reportFiles.map(async (file) => readJsonFile<any | null>(path.join(reportsDir, file), null)))).filter(Boolean);
  return c.json({
    tools: tools.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    reports: reports.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
  });
});

app.post("/api/admin/generated-tools/:id/review", async (c) => {
  const user = getCurrentUser(c);
  if (!isPlatformAdmin(user)) return c.json({ error: "Admin access required" }, 403);
  const id = slugifyTool(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const filePath = path.join(generatedToolsDir, `${id}.json`);
  const tool = await readJsonFile<any | null>(filePath, null);
  if (!tool) return c.json({ error: "Tool not found" }, 404);
  const status = body.status === "rejected" ? "rejected" : "approved";
  const updated = { ...tool, status, reviewedBy: user.email, reviewedAt: new Date().toISOString() };
  await writeJsonFile(filePath, updated);
  return c.json({ tool: updated });
});


app.get("/api/conversations", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ conversations: [] });
  await ensureDir(conversationUserDir(user.id));
  const files = (await readdir(conversationUserDir(user.id)).catch(() => [])).filter((file) => file.endsWith(".json"));
  const records = await Promise.all(files.map(async (file) => readJsonFile<ConversationRecord | null>(path.join(conversationUserDir(user.id), file), null)));
  const conversations = records.filter(Boolean).map((record: any) => ({
    id: record.id,
    title: record.title,
    created_at: record.created_at,
    updated_at: record.updated_at,
  })).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return c.json({ conversations });
});

app.get("/api/conversations/:id", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ error: "Please sign in to load conversations." }, 401);
  const id = c.req.param("id");
  const record = await readJsonFile<ConversationRecord | null>(conversationPath(user.id, id), null);
  if (!record) return c.json({ error: "Conversation not found" }, 404);
  return c.json({ conversation: { id: record.id, title: record.title, created_at: record.created_at, updated_at: record.updated_at }, messages: record.messages });
});

app.post("/api/conversations", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ error: "Please sign in to save conversations." }, 401);
  const body = await c.req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && String(m?.content || "").trim()).map((m: any) => ({ role: m.role, content: String(m.content).trim() })) : [];
  if (!messages.length) return c.json({ error: "messages required" }, 400);
  const record = await saveConversationForUser(user.id, String(body.conversationId || ""), messages);
  return c.json({ conversation: { id: record.id, title: record.title, created_at: record.created_at, updated_at: record.updated_at }, messages: record.messages });
});

app.delete("/api/conversations/:id", async (c) => {
  const user = getCurrentUser(c);
  if (!user) return c.json({ error: "Please sign in to delete conversations." }, 401);
  const filePath = conversationPath(user.id, c.req.param("id"));
  try { await Bun.file(filePath).delete(); } catch {}
  return c.json({ ok: true });
});



let cachedDrugIndex: any | null = null;

async function loadDrugIndex() {
  if (cachedDrugIndex) return cachedDrugIndex;
  try {
    cachedDrugIndex = await Bun.file("./data/drug-index.json").json();
    return cachedDrugIndex;
  } catch (err) {
    console.error("Failed to load drug index:", err);
    return null;
  }
}

function publicDrugSummary(drug: any) {
  if (drug.entryName || drug.productNdc) {
    return {
      id: drug.id,
      entryName: drug.entryName,
      genericName: drug.genericName,
      canonicalGeneric: drug.canonicalGeneric,
      brandName: drug.brandName,
      brandNames: drug.brandName ? [drug.brandName] : [],
      routes: drug.routes || [],
      dosageForm: drug.dosageForm,
      dosageForms: drug.dosageForm ? [drug.dosageForm] : [],
      manufacturer: drug.manufacturer,
      productNdc: drug.productNdc,
      productType: drug.productType,
      marketingCategory: drug.marketingCategory,
      substances: drug.substances?.slice(0, 8) || [],
      pharmClasses: drug.pharmClasses?.slice(0, 8) || [],
      productCount: 1,
    };
  }
  return {
    id: drug.id,
    genericName: drug.genericName,
    brandNames: drug.brandNames?.slice(0, 8) || [],
    routes: drug.routes || [],
    dosageForms: drug.dosageForms || [],
    substances: drug.substances?.slice(0, 8) || [],
    productCount: drug.productCount || 0,
    pharmClasses: drug.pharmClasses?.slice(0, 8) || [],
  };
}

app.get("/api/drugs", async (c) => {
  const index = await loadDrugIndex();
  if (!index) return c.json({ error: "Drug index not built" }, 503);

  const q = (c.req.query("q") || "").trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "80", 10) || 80, 1), 5000);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const view = c.req.query("view") || "entries";
  let results = (view === "drugs" ? index.drugs : (index.entries || index.drugs)) as any[];
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    results = results
      .filter((drug) => tokens.every((token) => drug.searchText?.includes(token) || drug.genericName?.toLowerCase().includes(token) || drug.entryName?.toLowerCase().includes(token) || drug.productNdc?.toLowerCase().includes(token)))
      .sort((a, b) => {
        const an = String(a.entryName || a.genericName || "").toLowerCase();
        const bn = String(b.entryName || b.genericName || "").toLowerCase();
        const aStarts = an.startsWith(q) ? 0 : 1;
        const bStarts = bn.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return an.localeCompare(bn);
      });
  }

  const page = results.slice(offset, offset + limit).map(publicDrugSummary);
  return c.json({
    source: index.source,
    exportDate: index.exportDate,
    totalProducts: index.totalProducts,
    totalIndexedEntries: index.totalEntries || index.totalProducts,
    totalIndexedDrugs: index.totalDrugs,
    view,
    totalMatches: results.length,
    limit,
    offset,
    drugs: page,
  });
});


const interactionKnowledge = [
  {
    drugs: ["warfarin", "aspirin"],
    severity: "major",
    mechanism: "Additive anticoagulant/antiplatelet effect increases bleeding risk.",
    nursing: ["Assess for bruising, melena, hematemesis, hematuria, and neuro changes.", "Verify INR/bleeding plan and avoid OTC NSAID stacking."],
  },
  {
    drugs: ["warfarin", "metronidazole"],
    severity: "major",
    mechanism: "Metronidazole can inhibit warfarin metabolism and increase INR/bleeding risk.",
    nursing: ["Monitor INR closely.", "Teach patient to report bleeding immediately."],
  },
  {
    drugs: ["simvastatin", "clarithromycin"],
    severity: "critical",
    mechanism: "Clarithromycin inhibits CYP3A4 and can greatly increase simvastatin exposure, increasing rhabdomyolysis risk.",
    nursing: ["Hold/avoid simvastatin during clarithromycin unless prescriber directs otherwise.", "Monitor muscle pain, weakness, dark urine, and CK if ordered."],
  },
  {
    drugs: ["simvastatin", "erythromycin"],
    severity: "critical",
    mechanism: "Macrolide CYP3A4 inhibition can increase simvastatin concentrations and rhabdomyolysis risk.",
    nursing: ["Avoid combination when possible.", "Assess muscle symptoms and renal injury signs."],
  },
  {
    drugs: ["clopidogrel", "omeprazole"],
    severity: "moderate",
    mechanism: "Omeprazole inhibits CYP2C19, which can reduce clopidogrel activation and antiplatelet effect.",
    nursing: ["Ask prescriber/pharmacist about pantoprazole alternative.", "Monitor for thrombotic symptoms in high-risk patients."],
  },
  {
    drugs: ["lisinopril", "spironolactone"],
    severity: "major",
    mechanism: "ACE inhibitor plus potassium-sparing diuretic increases hyperkalemia risk.",
    nursing: ["Monitor potassium and renal function.", "Teach patient to avoid potassium salt substitutes unless approved."],
  },
  {
    drugs: ["digoxin", "furosemide"],
    severity: "moderate",
    mechanism: "Loop-diuretic hypokalemia increases digoxin toxicity risk.",
    nursing: ["Monitor potassium and digoxin toxicity symptoms: nausea, visual halos, bradycardia.", "Check apical pulse per protocol."],
  },
  {
    drugs: ["fluoxetine", "tramadol"],
    severity: "major",
    mechanism: "SSRI plus serotonergic opioid raises serotonin syndrome risk; fluoxetine also inhibits CYP2D6, affecting tramadol activation.",
    nursing: ["Monitor agitation, tremor, clonus, hyperreflexia, fever, diarrhea.", "Escalate suspected serotonin syndrome urgently."],
  },
  {
    drugs: ["sertraline", "tramadol"],
    severity: "major",
    mechanism: "Combined serotonergic activity increases serotonin syndrome and seizure risk.",
    nursing: ["Assess neuro/autonomic findings.", "Teach patient not to add serotonergic OTC/supplements without approval."],
  },
];

const cypKnowledge: Record<string, { enzymes: string[]; effects: string[]; notes: string }> = {
  warfarin: { enzymes: ["CYP2C9", "CYP1A2", "CYP3A4"], effects: ["narrow therapeutic index", "bleeding risk"], notes: "Small metabolic changes can meaningfully change INR." },
  simvastatin: { enzymes: ["CYP3A4"], effects: ["myopathy", "rhabdomyolysis"], notes: "Strong CYP3A4 inhibitors can markedly increase exposure." },
  atorvastatin: { enzymes: ["CYP3A4"], effects: ["myopathy"], notes: "Less sensitive than simvastatin but still CYP3A4-relevant." },
  clarithromycin: { enzymes: ["CYP3A4"], effects: ["CYP3A4 inhibition", "QT risk"], notes: "Macrolide inhibitor that can raise CYP3A4 substrate levels." },
  erythromycin: { enzymes: ["CYP3A4"], effects: ["CYP3A4 inhibition", "QT risk"], notes: "Macrolide inhibitor with interaction potential." },
  omeprazole: { enzymes: ["CYP2C19"], effects: ["CYP2C19 inhibition"], notes: "Can reduce activation of CYP2C19 prodrugs like clopidogrel." },
  clopidogrel: { enzymes: ["CYP2C19"], effects: ["prodrug activation"], notes: "Needs CYP2C19 activation for antiplatelet effect." },
  fluoxetine: { enzymes: ["CYP2D6"], effects: ["CYP2D6 inhibition", "serotonergic"], notes: "Long half-life SSRI with interaction persistence." },
  sertraline: { enzymes: ["CYP2D6"], effects: ["serotonergic", "moderate CYP2D6 inhibition"], notes: "Serotonergic interaction concerns with opioids/triptans/MAOIs." },
  tramadol: { enzymes: ["CYP2D6", "CYP3A4"], effects: ["prodrug activation", "serotonergic", "seizure risk"], notes: "CYP2D6 inhibition can reduce analgesia while serotonergic risk remains." },
  codeine: { enzymes: ["CYP2D6"], effects: ["prodrug activation"], notes: "CYP2D6 poor metabolism/inhibition can reduce analgesia." },
  lisinopril: { enzymes: [], effects: ["hyperkalemia", "renal function"], notes: "Not CYP-mediated; interactions often renal/electrolyte based." },
  spironolactone: { enzymes: ["CYP3A4"], effects: ["hyperkalemia", "potassium sparing"], notes: "Major nursing concern is potassium elevation with ACE/ARB/potassium." },
  digoxin: { enzymes: ["P-glycoprotein"], effects: ["narrow therapeutic index", "toxicity"], notes: "Electrolytes and P-gp interactions affect toxicity risk." },
  furosemide: { enzymes: [], effects: ["hypokalemia", "volume depletion"], notes: "Can indirectly increase digoxin toxicity via potassium loss." },
};

function normalizeDrugName(drug: string): string {
  return drug.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function splitDrugList(input: string): string[] {
  return input.split(/[,;+\n]+/).map((s) => normalizeDrugName(s)).filter(Boolean);
}

function firstLabelValue(label: Record<string, unknown>, key: string): string | string[] | undefined {
  const value = label[key];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value;
  return undefined;
}

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n\n");
  if (value == null) return "";
  return String(value);
}

function textIncludesDrug(value: unknown, drug: string): boolean {
  return asText(value).toLowerCase().includes(drug.toLowerCase());
}

async function fetchLabel(drug: string): Promise<Record<string, unknown>> {
  try {
    const drugParam = drug.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const url = new URL("https://api.fda.gov/drug/label.json");
    url.searchParams.set("search", `openfda.generic_name:${drugParam} OR openfda.brand_name:${drugParam} OR openfda.substance_name:${drugParam}`);
    url.searchParams.set("limit", "1");
    const json = await fetch(url.toString()).then((r) => r.ok ? r.json() : null);
    return json?.results?.[0] || {};
  } catch {
    return {};
  }
}

async function getRxnormConcepts(drugs: string[]): Promise<Map<string, string>> {
  const rxcuiByName = new Map<string, string>();
  try {
    const resolved = await Promise.all(drugs.map(async (drug) => {
      const name = drug.replace(/[^a-z0-9]/gi, " ").trim();
      const resp = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=2`);
      if (!resp.ok) return { drug, rxcui: null };
      const json = await resp.json();
      const rxcui = json?.idGroup?.rxnormId?.[0] || null;
      return { drug, rxcui };
    }));
    for (const { drug, rxcui } of resolved) {
      if (rxcui) rxcuiByName.set(drug, rxcui);
    }
  } catch {}
  return rxcuiByName;
}

async function fetchRxNormInteractions(drugs: string[]): Promise<any[]> {
  const rxcuiByName = await getRxnormConcepts(drugs);
  if (!rxcuiByName.size) return [];

  const interactions: any[] = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const rxa = rxcuiByName.get(drugs[i]);
      const rxb = rxcuiByName.get(drugs[j]);
      if (!rxa || !rxb) continue;

      try {
        const resp = await fetch(
          `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxa}+${rxb}`
        );
        if (!resp.ok) continue;
        const json = await resp.json();
        const fullInteractionTypeGroup = json?.fullInteractionTypeGroup || [];
        const groups = Array.isArray(fullInteractionTypeGroup) ? fullInteractionTypeGroup : [fullInteractionTypeGroup];

        for (const group of groups) {
          const interactionTypes = group?.fullInteractionType || [];
          const typeArr = Array.isArray(interactionTypes) ? interactionTypes : [interactionTypes];

          for (const it of typeArr) {
            const pairArr = it?.interactionPair || [];
            const pairs = Array.isArray(pairArr) ? pairArr : [pairArr];

            for (const pair of pairs) {
              if (!pair?.interactionConcept) continue;
              const concepts = Array.isArray(pair.interactionConcept)
                ? pair.interactionConcept
                : [pair.interactionConcept];
              const conceptNames = (concepts as any[])
                .map((c) => c?.minConceptItem?.name || "")
                .filter(Boolean)
                .join(", ");

              interactions.push({
                drugs: [drugs[i], drugs[j]],
                severity: (pair.severity || "unknown").toLowerCase(),
                description: pair.description || "RxNorm interaction record.",
                interactionConcept: conceptNames || undefined,
              });
            }
          }
        }
      } catch {}
    }
  }

  return interactions;
}

async function fetchOpenFdaLabelWarnings(drugs: string[]): Promise<any[]> {
  const results = await Promise.all(drugs.map(async (drug) => {
    const label = await fetchLabel(drug);
    const bw = firstLabelValue(label, "boxed_warning");
    const di = firstLabelValue(label, "drug_interactions") || firstLabelValue(label, "drug_interactions_table");
    const warn = firstLabelValue(label, "warnings") || firstLabelValue(label, "warnings_and_cautions");
    const ci = firstLabelValue(label, "contraindications");

    const hasWarning = Array.isArray(bw) ? bw.length : !!bw;
    if (!hasWarning && !di && !Array.isArray(warn) && !warn && !Array.isArray(ci) && !ci) return null;

    return {
      drug,
      boxedWarning: bw,
      drugInteractions: di,
      warnings: warn,
      contraindications: ci,
    };
  }));
  return results.filter(Boolean);
}

// ── Drug data cache (loaded once) ──────────────────

// ── Routes ───────────────────────────────────────────────────────────────────

app.post("/api/clinical/interactions", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const raw = Array.isArray(body.drugs) ? body.drugs : splitDrugList(body.drugs || body.input || "");
  const drugs = [...new Set(raw.map(normalizeDrugName).filter(Boolean))].slice(0, 10);
  if (drugs.length < 2) return c.json({ error: "Enter at least two drugs" }, 400);

  const [rxInteractions, labelWarnings] = await Promise.all([
    fetchRxNormInteractions(drugs),
    fetchOpenFdaLabelWarnings(drugs),
  ]);

  const severities = rxInteractions.map((i) => i.severity);
  const highest = severities.includes("high") ? "critical"
    : severities.includes("moderate") ? "major"
    : severities.includes("low") ? "moderate"
    : "none found";

  return c.json({
    drugs,
    interactionCount: rxInteractions.length,
    highestSeverity: rxInteractions.length ? highest : "none found",
    interactions: rxInteractions,
    labelResults: labelWarnings,
    disclaimer: "Educational screening only. Not a substitute for pharmacist/prescriber review or clinical judgment.",
  });
});

app.post("/api/clinical/dosing", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const drug = normalizeDrugName(String(body.drug || ""));
  if (!drug) return c.json({ error: "Drug name required" }, 400);
  const weightKg = Number(body.weightKg || 0);

  const [label, ndcProducts] = await Promise.all([
    fetchLabel(drug),
    (async () => {
      try {
        const ndcResp = await fetch(
          `https://api.fda.gov/drug/ndc.json?search=openfda.generic_name:${drug}&limit=50`
        );
        return ndcResp.ok ? (await ndcResp.json()).results || [] : [];
      } catch {
        return [];
      }
    })(),
  ]);

  const dosageText = asText(firstLabelValue(label, "dosage_and_administration"));
  const mgKgMatches: any[] = [];
  for (const m of [...dosageText.matchAll(/(\d+(?:\.\d+)?)\s*(?:to|-|–)?\s*(\d+(?:\.\d+)?)?\s*mg\s*\/\s*kg/gi)].slice(0, 10)) {
    const row: any = { lowMgPerKg: Number(m[1]), highMgPerKg: m[2] ? Number(m[2]) : null };
    if (weightKg > 0) {
      row.exampleForWeightKg = { lowMg: +(Number(m[1]) * weightKg).toFixed(2) };
      if (m[2]) row.exampleForWeightKg.highMg = +(Number(m[2]) * weightKg).toFixed(2);
    }
    mgKgMatches.push(row);
  }

  const sentences = dosageText.split(/(?<=[.!?])\s+/).filter(
    (s) => /\bmg\b|\b dose\b|\bdaily\b|\btablet\b|\binjection\b|\bevery\b|\bhours\b/i.test(s)
  ).slice(0, 16);

  const routes = [...new Set(ndcProducts.map((p: any) => p.route).filter(Boolean))];
  const routeSpecificForms = routes.length
    ? routes.map((r: string) => `${r}: ${ndcProducts.filter((p: any) => p.route === r).map((p: any) => p.brand_name || p.generic_name || "NDC product").slice(0, 3).join(", ")}`)
    : [];

  return c.json({
    drug,
    weightKg: weightKg || null,
    mgPerKgFindings: mgKgMatches,
    dosingLabelAvailable: Boolean(dosageText),
    dosageAndAdministration: dosageText || "No dosage_and_administration field found in FDA label.",
    adultDoseSnippets: sentences,
    routeSpecificForms,
    warning: "Dosing helper extracts FDA label text only. Does not prescribe, adjust for renal/hepatic function, or replace institutional protocols.",
  });
});

app.post("/api/clinical/cascade", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const drugs = [...new Set(splitDrugList(body.drugs || body.input))].slice(0, 10);
  if (drugs.length < 2) return c.json({ error: "Enter at least two drugs" }, 400);
  const nodes = drugs.map((drug) => ({ drug, ...(cypKnowledge[drug] || { enzymes: [], effects: [], notes: "No local CYP/P-gp profile yet." }) }));
  const cascades: any[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const shared = a.enzymes.filter((e) => b.enzymes.includes(e));
      const known = interactionKnowledge.find((item) => item.drugs.every((d) => d === a.drug || d === b.drug));
      if (shared.length || known) cascades.push({ drugs: [a.drug, b.drug], sharedPathways: shared, severity: known?.severity || (shared.length ? "possible" : "none"), explanation: known?.mechanism || `Both drugs share ${shared.join(", ")}; assess for inhibition/induction/substrate competition depending on full medication context.` });
    }
  }
  return c.json({
    drugs,
    nodes,
    cascades,
    cascadeCount: cascades.length,
    source: "Zo local MEDGRAPH-style cascade fallback using CYP/P-gp knowledge plus known interaction rules. External MEDGRAPH repo was inspected but not embedded as a service yet.",
    disclaimer: "Educational cascade screening only. Requires pharmacist/prescriber verification.",
  });
});

const generatedToolsDir = path.join(process.cwd(), "data", "generated-tools");
const DEFAULT_PRO_MODEL = "google/gemini-3.1-pro-preview";

type GeneratedToolPayload = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "calculator" | "reference";
  fields?: Array<{ id: string; label: string; type: "number" | "text" | "select"; unit?: string; placeholder?: string; options?: string[]; min?: number; max?: number }>;
  formulas?: Array<{ id: string; label: string; expression: string; unit?: string; precision?: number; normalRange?: string; explanation?: string }>;
  sections?: Array<{ title: string; content?: string; bullets?: string[] }>;
  disclaimer?: string;
};

function slugifyTool(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || `tool-${Date.now()}`;
}

async function ensureGeneratedToolsDir() {
  await mkdir(generatedToolsDir, { recursive: true });
}

function extractJsonObject(text: string): any {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) return JSON.parse(match[1]);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("AI did not return JSON");
}

function sanitizeGeneratedTool(raw: any, request: string, tier: "free" | "pro", model: string): GeneratedToolPayload & { createdAt: string; sourceTier: "free" | "pro"; model: string } {
  const name = String(raw?.name || request || "Generated Clinical Tool").trim().slice(0, 80);
  const id = slugifyTool(raw?.id || name);
  const kind = raw?.kind === "reference" ? "reference" : "calculator";
  const fields = Array.isArray(raw?.fields) ? raw.fields.slice(0, 12).map((field: any) => ({
    id: slugifyTool(String(field.id || field.label || "field")).replace(/-/g, "_"),
    label: String(field.label || field.id || "Input").slice(0, 80),
    type: ["number", "text", "select"].includes(field.type) ? field.type : "number",
    unit: field.unit ? String(field.unit).slice(0, 24) : undefined,
    placeholder: field.placeholder ? String(field.placeholder).slice(0, 100) : undefined,
    options: Array.isArray(field.options) ? field.options.map(String).slice(0, 12) : undefined,
    min: typeof field.min === "number" ? field.min : undefined,
    max: typeof field.max === "number" ? field.max : undefined,
  })) : [];
  const fieldIds = new Set(fields.map((f: any) => f.id));
  const formulas = Array.isArray(raw?.formulas) ? raw.formulas.slice(0, 8).map((formula: any) => ({
    id: slugifyTool(String(formula.id || formula.label || "result")).replace(/-/g, "_"),
    label: String(formula.label || formula.id || "Result").slice(0, 80),
    expression: String(formula.expression || "0").replace(/[^A-Za-z0-9_()+\-*/.\s]/g, "").slice(0, 240),
    unit: formula.unit ? String(formula.unit).slice(0, 24) : undefined,
    precision: Number.isFinite(Number(formula.precision)) ? Math.max(0, Math.min(6, Number(formula.precision))) : 2,
    normalRange: formula.normalRange ? String(formula.normalRange).slice(0, 120) : undefined,
    explanation: formula.explanation ? String(formula.explanation).slice(0, 360) : undefined,
  })).filter((formula: any) => {
    const identifiers = formula.expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    return identifiers.every((id: string) => fieldIds.has(id));
  }) : [];
  const sections = Array.isArray(raw?.sections) ? raw.sections.slice(0, 8).map((section: any) => ({
    title: String(section.title || "Notes").slice(0, 80),
    content: section.content ? String(section.content).slice(0, 1200) : undefined,
    bullets: Array.isArray(section.bullets) ? section.bullets.map((b: any) => String(b).slice(0, 260)).slice(0, 12) : undefined,
  })) : [];
  return {
    id,
    name,
    description: String(raw?.description || `AI-generated clinical tool for: ${request}`).slice(0, 240),
    category: String(raw?.category || "Nursing").slice(0, 60),
    kind,
    fields: kind === "calculator" ? fields : [],
    formulas: kind === "calculator" ? formulas : [],
    sections,
    disclaimer: String(raw?.disclaimer || "Educational screening only. Verify calculations, ranges, and clinical decisions with program policy, facility policy, and clinical judgment.").slice(0, 360),
    createdAt: new Date().toISOString(),
    sourceTier: tier,
    model,
  };
}

function buildToolPrompt(request: string) {
  return `Create one safe nursing education clinical tool as STRICT JSON only. Do not include markdown fences or commentary.

User request: ${request}

Return this JSON schema:
{
  "name": "short tool name",
  "description": "what it does",
  "category": "Pharmacology | Skills | Safety | Dosage | Pediatrics | Med-Surg | Psych | Other",
  "kind": "calculator" or "reference",
  "fields": [{"id":"snake_case", "label":"Input label", "type":"number|text|select", "unit":"optional", "placeholder":"optional", "options":["only for select"]}],
  "formulas": [{"id":"snake_case", "label":"Result label", "expression":"math expression using field ids only, operators + - * / parentheses", "unit":"optional", "precision":2, "normalRange":"optional", "explanation":"brief rationale"}],
  "sections": [{"title":"section title", "content":"short paragraph", "bullets":["safe nursing note"]}],
  "disclaimer":"educational safety disclaimer"
}

Rules:
- For calculators, include numeric fields and formulas when clinically appropriate.
- Use only arithmetic expressions with field ids. No JavaScript, no functions, no comparisons.
- Do not invent medication orders that look like prescriptions.
- Include nursing safety notes and when to verify with instructor/pharmacy/provider.
- If the requested tool is unsafe for automation, make a reference/checklist tool instead.`;
}

async function generateToolWithOllama(request: string) {
  const selected = selectOllamaModel();
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selected.model,
      stream: false,
      messages: [
        { role: "system", content: "You generate strict JSON for safe nursing education tools. Output JSON only." },
        { role: "user", content: buildToolPrompt(request) },
      ],
      options: { ...selected.options, temperature: 0.1 },
    }),
  });
  if (!response.ok) throw new Error("Local Ollama tool generation failed");
  const data = await response.json() as { message?: { content?: string }; response?: string };
  return { text: cleanLocalModelOutput(data.message?.content || data.response || ""), model: `ollama:${selected.model}` };
}

async function generateToolWithZoAsk(request: string, forcedModel?: string) {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable for Pro model");
  const model = forcedModel || process.env.MAIA_PRO_MODEL || DEFAULT_PRO_MODEL;
  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { "Authorization": token, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ input: buildToolPrompt(request), model_name: model }),
  });
  if (!response.ok) throw new Error(`Zo Ask tool generation failed: ${response.status}`);
  const data = await response.json() as { output?: string };
  return { text: data.output || "", model };
}

app.get("/api/clinical/generated-tools", async (c) => {
  await ensureGeneratedToolsDir();
  const files = (await readdir(generatedToolsDir)).filter((file) => file.endsWith(".json"));
  const currentUser = getCurrentUser(c);
  const admin = isPlatformAdmin(currentUser);
  const tools = await Promise.all(files.map(async (file) => {
    try { return JSON.parse(await readFile(path.join(generatedToolsDir, file), "utf8")); } catch { return null; }
  }));
  const visibleTools = tools.filter(Boolean).filter((tool: any) => {
    const status = tool.status || "approved";
    return status === "approved" || admin || (currentUser && tool.ownerId === currentUser.id);
  });
  return c.json({ tools: visibleTools.sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))) });
});

app.post("/api/clinical/generate-tool", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const request = String(body.request || "").trim().slice(0, 1000);
  const tier = body.tier === "pro" ? "pro" : "free";
  if (!request) return c.json({ error: "Describe the clinical tool you want to generate." }, 400);

  const auth = await authorizeAi(c, tier, "toolBuilder");
  if (auth instanceof Response) return auth;

  const toolTier = getPlanTier(auth.account);
  const toolLimit = getToolLimit(toolTier);
  await ensureGeneratedToolsDir();
  const existingTools = await readdir(generatedToolsDir).catch(() => [] as string[]);
  const userTools = existingTools.filter(f => f.endsWith(".json"));
  let userToolCount = 0;
  for (const f of userTools) {
    try {
      const t = JSON.parse(await readFile(path.join(generatedToolsDir, f), "utf8"));
      if (t.ownerId === auth.user.id) userToolCount++;
    } catch {}
  }
  if (userToolCount >= toolLimit && !isPlatformAdmin(auth.user)) {
    return c.json({ error: `Your plan allows up to ${toolLimit} generated tools. Delete an existing tool to create a new one.`, upgradeRequired: true }, 402);
  }

  try {
    const generated = await generateToolWithZoAsk(request, auth.model);
    const raw = extractJsonObject(generated.text);
    const tool = { ...sanitizeGeneratedTool(raw, request, tier, generated.model), ownerId: auth.user.id, ownerEmail: auth.user.email, status: "pending", reviewedAt: null };
    await ensureGeneratedToolsDir();
    await writeFile(path.join(generatedToolsDir, `${tool.id}.json`), JSON.stringify(tool, null, 2));
    return c.json({ tool, pendingReview: true });
  } catch (error: any) {
    console.error("Generated clinical tool failed:", error);
    return c.json({ error: error.message || "Tool generation failed" }, 502);
  }
});

app.post("/api/clinical/generated-tools/:id/modify", async (c) => {
  const id = slugifyTool(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const instruction = String(body.instruction || "").trim().slice(0, 1000);
  const tier = body.tier === "pro" ? "pro" : "free";
  if (!instruction) return c.json({ error: "Describe how to modify this tool." }, 400);

  try {
    await ensureGeneratedToolsDir();
    const filePath = path.join(generatedToolsDir, `${id}.json`);
    const existingTool = JSON.parse(await readFile(filePath, "utf8"));
    const auth = await authorizeAi(c, tier, "toolBuilder");
    if (auth instanceof Response) return auth;
    const generated = await generateModifiedToolWithZoAsk(existingTool, instruction, auth.model);
    const raw = extractJsonObject(generated.text);
    await ensureDir(generatedToolHistoryDir);
    const historyPath = path.join(generatedToolHistoryDir, `${existingTool.id}.json`);
    const history = await readJsonFile<any[]>(historyPath, []);
    history.push({ ...existingTool, archivedAt: new Date().toISOString() });
    await writeJsonFile(historyPath, history.slice(-25));
    const tool = { ...sanitizeGeneratedTool({ ...raw, id: existingTool.id }, instruction, tier, generated.model), ownerId: existingTool.ownerId || auth.user.id, ownerEmail: existingTool.ownerEmail || auth.user.email, status: "pending", reviewedAt: null };
    tool.createdAt = existingTool.createdAt || tool.createdAt;
    (tool as any).updatedAt = new Date().toISOString();
    await writeFile(filePath, JSON.stringify(tool, null, 2));
    return c.json({ tool, pendingReview: true });
  } catch (error: any) {
    console.error("Modify generated clinical tool failed:", error);
    return c.json({ error: error.message || "Tool modification failed" }, 502);
  }
});

type NclexQuestionPayload = {
  type: "mcq" | "sata";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  stem: string;
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  rationale: string;
  optionRationales: Record<string, string>;
};

function buildNclexQuestionPrompt(topic: string, options?: { tutorMode?: boolean; focusCategory?: string; focusSystem?: string }) {
  const focusLines: string[] = [];
  if (options?.focusSystem) focusLines.push(`- Body system focus: ${options.focusSystem}`);
  if (options?.focusCategory) focusLines.push(`- NCLEX category focus: ${options.focusCategory}`);
  const focusBlock = focusLines.length ? `\nFocus constraints:\n${focusLines.join("\n")}\n` : "";
  const tutorNote = options?.tutorMode
    ? `- Always populate optionRationales with detailed per-option reasoning (2-3 sentences each) explaining why each option is correct or incorrect — this is critical for tutor mode.\n`
    : `- Include brief optionRationales for each option.\n`;

  return `Create one NCLEX-style nursing practice question as STRICT JSON only. Do not include markdown fences or commentary.

Requested topic: ${topic}${focusBlock}

Return this exact JSON shape:
{
  "type": "mcq" or "sata",
  "topic": "short topic label",
  "difficulty": "easy" | "medium" | "hard",
  "stem": "question stem with nursing scenario when appropriate",
  "options": [{"id":"A","text":"answer choice"},{"id":"B","text":"answer choice"},{"id":"C","text":"answer choice"},{"id":"D","text":"answer choice"}],
  "correctAnswers": ["A"],
  "rationale": "why the correct answer set is best",
  "optionRationales": {"A":"why A is correct/incorrect","B":"why B is correct/incorrect","C":"why C is correct/incorrect","D":"why D is correct/incorrect"}
}

Rules:
${tutorNote}- Make either a standard multiple-choice question (mcq, exactly one correct answer) or select-all-that-apply (sata, two or more correct answers).
- Keep options plausible and nursing-specific.
- Include pharmacology, prioritization, safety, psych, med-surg, fundamentals, maternal-child, pediatrics, or mental health as appropriate to the requested topic.
- Do not include all/none of the above.
- Do not make the answer ambiguous.
- Use current nursing education framing and NCLEX-style safety/prioritization logic.
- Educational use only; avoid patient-specific medical advice.`;
}

function sanitizeNclexQuestion(raw: any, requestedTopic: string): NclexQuestionPayload {
  const type = raw?.type === "sata" ? "sata" : "mcq";
  const optionSource = Array.isArray(raw?.options) ? raw.options : [];
  const options = optionSource.slice(0, 6).map((option: any, index: number) => ({
    id: String(option?.id || String.fromCharCode(65 + index)).trim().toUpperCase().slice(0, 1),
    text: String(option?.text || option || "").trim().slice(0, 260),
  })).filter((option: any) => /^[A-F]$/.test(option.id) && option.text);
  while (options.length < 4) {
    const id = String.fromCharCode(65 + options.length);
    options.push({ id, text: `Option ${id}` });
  }
  const optionIds = new Set(options.map((option: any) => option.id));
  let correctAnswers = Array.isArray(raw?.correctAnswers) ? raw.correctAnswers.map((v: any) => String(v).trim().toUpperCase().slice(0, 1)).filter((id: string) => optionIds.has(id)) : [];
  correctAnswers = Array.from(new Set(correctAnswers));
  if (type === "mcq" && correctAnswers.length !== 1) correctAnswers = [options[0].id];
  if (type === "sata" && correctAnswers.length < 2) correctAnswers = options.slice(0, 2).map((option: any) => option.id);
  const rawRationales = raw?.optionRationales && typeof raw.optionRationales === "object" ? raw.optionRationales : {};
  const optionRationales: Record<string, string> = {};
  for (const option of options) {
    optionRationales[option.id] = String(rawRationales[option.id] || `${option.id} is ${correctAnswers.includes(option.id) ? "part of" : "not part of"} the best answer set.`).slice(0, 420);
  }
  return {
    type,
    topic: String(raw?.topic || requestedTopic || "NCLEX practice").slice(0, 80),
    difficulty: ["easy", "medium", "hard"].includes(raw?.difficulty) ? raw.difficulty : "medium",
    stem: String(raw?.stem || `Which answer is best for ${requestedTopic || "this nursing topic"}?`).trim().slice(0, 900),
    options,
    correctAnswers,
    rationale: String(raw?.rationale || "Review the option rationales for why the answer set is best.").slice(0, 1200),
    optionRationales,
  };
}

async function generateNclexQuestionWithOllama(topic: string) {
  const selected = selectOllamaModel();
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selected.model,
      stream: false,
      messages: [
        { role: "system", content: "You generate strict JSON for NCLEX-style nursing education questions. Output JSON only." },
        { role: "user", content: buildNclexQuestionPrompt(topic) },
      ],
      options: { ...selected.options, temperature: 0.2 },
    }),
  });
  if (!response.ok) throw new Error("Free MAIA question generation failed");
  const data = await response.json() as { message?: { content?: string }; response?: string };
  return cleanLocalModelOutput(data.message?.content || data.response || "");
}

async function generateNclexQuestionWithZoAsk(topic: string, forcedModel?: string, options?: { tutorMode?: boolean; focusCategory?: string; focusSystem?: string }) {
  const token = await getZoToken();
  if (!token) throw new Error("Pro MAIA token unavailable");
  const model = forcedModel || process.env.MAIA_PRO_MODEL || DEFAULT_PRO_MODEL;
  const prompt = buildNclexQuestionPrompt(topic, options);
  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { "Authorization": token, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ input: prompt, model_name: model }),
  });
  if (!response.ok) throw new Error(`Pro MAIA question generation failed: ${response.status}`);
  const data = await response.json() as { output?: string };
  return data.output || "";
}

// ---- NCLEX Question Bank (free, instant, no AI cost) ----
import { getQuestion as getBankQuestion, getBankStats, rateQuestion, recordServe } from "./server/lib/nclex-bank";

app.get("/api/nclex/bank-stats", async (c) => {
  try {
    const stats = await getBankStats();
    return c.json(stats);
  } catch (e: any) {
    return c.json({ totalQuestions: 0, categories: [], lastGenerated: "" });
  }
});

app.post("/api/nclex/bank-question", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const topic = String(body.topic || "").trim();
  const difficulty = String(body.difficulty || "any").trim();
  const excludeIds: string[] = Array.isArray(body.excludeIds) ? body.excludeIds.map(String) : [];
  try {
    const question = await getBankQuestion({ topic: topic || undefined, difficulty: difficulty || undefined, excludeIds });
    if (!question) {
      return c.json({ error: "No matching question in bank", empty: true }, 404);
    }
    await recordServe(question.id);
    return c.json({ question, source: "bank" });
  } catch (e: any) {
    return c.json({ error: e.message || "Bank query failed" }, 500);
  }
});

app.post("/api/nclex/rate-question", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const questionId = String(body.questionId || "").trim();
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  if (!questionId || !rating) return c.json({ error: "questionId and rating (up/down) required" }, 400);
  try {
    await rateQuestion(questionId, rating);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/clinical/nclex-question", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const topic = String(body.topic || "comprehensive nursing practice").trim().slice(0, 300) || "comprehensive nursing practice";
  const tier = body.tier === "pro" ? "pro" : "free";

  const resolved = await getAccountForRequest(c);
  const accountTier = resolved instanceof Response ? "free" : getPlanTier((resolved as any).account);
  const tutorMode = accountTier === "pro_plus" || accountTier === "max" ? Boolean(body.tutorMode) : false;
  const focusCategory = (accountTier === "max") ? String(body.focusCategory || "").trim().slice(0, 100) : "";
  const focusSystem = (accountTier === "max") ? String(body.focusSystem || "").trim().slice(0, 100) : "";
  try {
    if (tier === "free") { const bankQ = await getBankQuestion({ topic: topic || undefined, excludeIds: [] }); if (bankQ) { await recordServe(bankQ.id); return c.json({ question: bankQ, source: "bank", tier: "free" }); } }
    const auth = await authorizeAi(c, tier, "messages");
    if (auth instanceof Response) return auth;
    const text = await generateNclexQuestionWithZoAsk(topic, auth.model, { tutorMode, focusCategory, focusSystem });
    const raw = extractJsonObject(text);
    return c.json({ question: sanitizeNclexQuestion(raw, topic), tier });
  } catch (error: any) {
    console.error("NCLEX question generation failed:", error);
    return c.json({ error: error.message || "Question generation failed" }, 502);
  }
});

app.post("/api/clinical/decision", async (c) => {
  const resolved = await getAccountForRequest(c);
  if (resolved instanceof Response) return resolved;
  const { user, account } = resolved;
  if (getPlanTier(account) !== "max" && !isPlatformAdmin(user)) {
    return c.json({ error: "Clinical Decision Tools require the Max plan.", upgradeRequired: true }, 402);
  }
  const body = await c.req.json().catch(() => ({}));
  const scenario = String(body.scenario || "").trim().slice(0, 2000);
  if (!scenario) return c.json({ error: "Scenario is required." }, 400);
  const auth = await authorizeAi(c, "pro", "messages");
  if (auth instanceof Response) return auth;
  try {
    const prompt = `You are a clinical nurse educator. Analyze this patient scenario and provide structured clinical decision support.

Patient Scenario: ${scenario}

Respond with STRICT JSON only:
{
  "primaryAssessment": "1-2 sentence priority assessment finding",
  "nursingDiagnoses": ["priority nursing diagnosis 1", "priority nursing diagnosis 2", "priority nursing diagnosis 3"],
  "immediateInterventions": [{"action": "intervention", "rationale": "why"}],
  "monitoringParameters": ["what to monitor 1", "what to monitor 2"],
  "safetyAlerts": ["any red flags or critical safety concerns"],
  "educationPoints": ["patient/family teaching point 1", "patient/family teaching point 2"],
  "disclaimer": "Educational use only. Clinical judgment and facility policy always supersede AI guidance."
}`;
    const token = await getZoToken();
    if (!token) throw new Error("MAIA unavailable");
    const resp = await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ input: prompt, model_name: auth.model }),
    });
    if (!resp.ok) throw new Error(`MAIA unavailable (${resp.status})`);
    const data = await resp.json() as { output?: string };
    const raw = extractJsonObject(data.output || "");
    return c.json({
      primaryAssessment: String(raw?.primaryAssessment || "").slice(0, 400),
      nursingDiagnoses: Array.isArray(raw?.nursingDiagnoses) ? raw.nursingDiagnoses.slice(0, 5).map((d: any) => String(d).slice(0, 200)) : [],
      immediateInterventions: Array.isArray(raw?.immediateInterventions) ? raw.immediateInterventions.slice(0, 8).map((i: any) => ({ action: String(i?.action || "").slice(0, 200), rationale: String(i?.rationale || "").slice(0, 200) })) : [],
      monitoringParameters: Array.isArray(raw?.monitoringParameters) ? raw.monitoringParameters.slice(0, 6).map((m: any) => String(m).slice(0, 150)) : [],
      safetyAlerts: Array.isArray(raw?.safetyAlerts) ? raw.safetyAlerts.slice(0, 4).map((s: any) => String(s).slice(0, 200)) : [],
      educationPoints: Array.isArray(raw?.educationPoints) ? raw.educationPoints.slice(0, 4).map((e: any) => String(e).slice(0, 200)) : [],
      disclaimer: "Educational use only. Clinical judgment and facility policy always supersede AI guidance.",
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Clinical decision tool failed." }, 502);
  }
});

app.post("/api/drugs/reload-index", async (c) => {
  cachedDrugIndex = null;
  const index = await loadDrugIndex();
  if (!index) return c.json({ error: "Drug index not available" }, 503);
  return c.json({ ok: true, totalIndexedEntries: index.totalEntries || index.totalProducts, totalIndexedDrugs: index.totalDrugs, totalProducts: index.totalProducts, exportDate: index.exportDate });
});

function addValues(set: Set<string>, value: unknown) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  for (const item of values) {
    const text = String(item || "").trim();
    if (text) set.add(text);
  }
}

function productMatches(product: any, route?: string, form?: string): boolean {
  const routes = Array.isArray(product?.route) ? product.route.map((v: unknown) => String(v).toUpperCase()) : [];
  const dosageForm = String(product?.dosage_form || "").toUpperCase();
  return (!route || routes.includes(route)) && (!form || dosageForm === form);
}

function labelMatches(label: any, route?: string): boolean {
  if (!route) return true;
  const routes = Array.isArray(label?.openfda?.route) ? label.openfda.route.map((v: unknown) => String(v).toUpperCase()) : [];
  return routes.includes(route);
}

function normalizeDrugCardPayload(drug: string, labelJson: any, ndcJson: any, route?: string, form?: string) {
  const rawLabelResults = Array.isArray(labelJson?.results) ? labelJson.results : [];
  const rawNdcResults = Array.isArray(ndcJson?.results) ? ndcJson.results : [];
  const ndcResults = rawNdcResults.filter((p: any) => productMatches(p, route, form));
  const labelResults = rawLabelResults.filter((item: any) => labelMatches(item, route));
  const result = (labelResults[0] || rawLabelResults[0]) as Record<string, unknown> | undefined;

  if (!result) return null;

  const routes = new Set<string>();
  const dosageForms = new Set<string>();
  const genericNames = new Set<string>();
  const brandNames = new Set<string>();
  const manufacturers = new Set<string>();

  for (const item of labelResults.length ? labelResults : rawLabelResults) {
    const openfda = (item.openfda || {}) as Record<string, unknown>;
    addValues(routes, openfda.route);
    addValues(dosageForms, openfda.dosage_form);
    addValues(genericNames, openfda.generic_name);
    addValues(brandNames, openfda.brand_name);
    addValues(manufacturers, openfda.manufacturer_name);
  }

  const ndcProducts = ndcResults.slice(0, 24).map((product: any) => {
    addValues(routes, product.route);
    addValues(dosageForms, product.dosage_form);
    addValues(genericNames, product.generic_name);
    addValues(brandNames, product.brand_name);
    addValues(manufacturers, product.labeler_name);
    return {
      brandName: product.brand_name,
      genericName: product.generic_name,
      dosageForm: product.dosage_form,
      route: product.route,
      productNdc: product.product_ndc,
      labelerName: product.labeler_name,
      activeIngredients: product.active_ingredients,
      marketingCategory: product.marketing_category,
    };
  });

  const label: Record<string, unknown> = {
    openfda_generic_name: Array.from(genericNames),
    openfda_brand_name: Array.from(brandNames),
    openfda_route: Array.from(routes),
    openfda_manufacturer_name: Array.from(manufacturers).slice(0, 20),
  };

  const explicitLabelKeys = [
    "active_ingredient",
    "purpose",
    "uses",
    "warnings",
    "do_not_use",
    "ask_doctor",
    "ask_doctor_or_pharmacist",
    "stop_use",
    "directions",
    "overdosage",
    "inactive_ingredient",
    "questions",
    "indications_and_usage",
    "boxed_warning",
    "contraindications",
    "adverse_reactions",
    "drug_interactions",
    "mechanism_of_action",
    "pregnancy",
    "nursing_mothers",
    "drug_abuse_and_dependence",
    "dosage_and_administration"
  ];

  for (const key of explicitLabelKeys) {
    label[key] = firstLabelValue(result, key);
  }

  const excludedOtherKeys = new Set([
    ...explicitLabelKeys,
    "openfda",
    "id",
    "set_id",
    "version",
    "spl_id",
    "effective_time",
    "package_label_principal_display_panel",
  ]);
  const otherFdaLabelData: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(result)) {
    if (excludedOtherKeys.has(key)) continue;
    const labelValue = firstLabelValue(result, key);
    if (!labelValue) continue;
    if (Array.isArray(labelValue)) {
      otherFdaLabelData[key] = labelValue.map((item) => item.length > 3000 ? `${item.slice(0, 3000).trim()}…` : item);
    } else {
      otherFdaLabelData[key] = labelValue.length > 3000 ? `${labelValue.slice(0, 3000).trim()}…` : labelValue;
    }
  }
  label.other_fda_label_data = otherFdaLabelData;

  return {
    query: drug,
    source: "openFDA",
    filter: { route: route || null, form: form || null },
    totalLabelResults: labelJson?.meta?.results?.total || rawLabelResults.length,
    filteredLabelResults: labelResults.length,
    label,
    summary: {
      routes: Array.from(routes).sort(),
      dosageForms: Array.from(dosageForms).sort(),
      genericNames: Array.from(genericNames).sort(),
      brandNames: Array.from(brandNames).sort(),
      manufacturers: Array.from(manufacturers).sort().slice(0, 20),
      ndcTotal: ndcJson?.meta?.results?.total ?? rawNdcResults.length,
      filteredNdcTotal: ndcResults.length,
    },
    ndcProducts,
  };
}

async function readOpenFdaTotal(res: Response): Promise<number | null> {
  if (!res.ok) return null;
  const json = await res.json().catch(() => null) as any;
  return typeof json?.meta?.results?.total === "number" ? json.meta.results.total : null;
}

function buildBaseDrugUrls(drug: string) {
  const safeDrug = drug.replace(/["\\]/g, "");
  const labelSearch = `openfda.generic_name:${safeDrug} OR openfda.brand_name:${safeDrug} OR openfda.substance_name:${safeDrug} OR active_ingredient:${safeDrug}`;
  const labelUrl = new URL("https://api.fda.gov/drug/label.json");
  labelUrl.searchParams.set("search", labelSearch);
  labelUrl.searchParams.set("limit", "50");

  const ndcUrl = new URL("https://api.fda.gov/drug/ndc.json");
  ndcUrl.searchParams.set("search", `generic_name:${drug} OR brand_name:${drug}`);
  ndcUrl.searchParams.set("limit", "100");

  return { labelUrl, ndcUrl };
}

app.get("/api/drug-cards/:drug", async (c) => {
  const drug = c.req.param("drug").trim().toLowerCase();
  if (!drug) return c.json({ error: "Drug name required" }, 400);

  const { labelUrl, ndcUrl } = buildBaseDrugUrls(drug);
  const [labelRes, eventRes, recallRes, ndcRes] = await Promise.all([
    fetch(labelUrl.toString(), { headers: { Accept: "application/json" } }),
    fetch(`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:${encodeURIComponent(drug)}&limit=1`, { headers: { Accept: "application/json" } }),
    fetch(`https://api.fda.gov/drug/enforcement.json?search=product_description:${encodeURIComponent(drug)}&limit=1`, { headers: { Accept: "application/json" } }),
    fetch(ndcUrl.toString(), { headers: { Accept: "application/json" } }),
  ]);

  if (!labelRes.ok) return c.json({ error: `No FDA label found for ${drug}` }, 404);

  const labelJson = await labelRes.json() as any;
  const ndcJson = ndcRes.ok ? await ndcRes.json().catch(() => null) as any : null;
  const payload = normalizeDrugCardPayload(drug, labelJson, ndcJson);
  if (!payload) return c.json({ error: `No FDA label found for ${drug}` }, 404);

  return c.json({
    ...payload,
    adverseEventCount: await readOpenFdaTotal(eventRes),
    recallCount: await readOpenFdaTotal(recallRes),
  });
});

app.get("/api/drug-cards/:drug/filter", async (c) => {
  const drug = c.req.param("drug").trim().toLowerCase();
  const route = c.req.query("route")?.trim().toUpperCase();
  const form = c.req.query("form")?.trim().toUpperCase();
  if (!drug) return c.json({ error: "Drug name required" }, 400);
  if (!route && !form) return c.json({ error: "Route or form filter required" }, 400);

  const { labelUrl, ndcUrl } = buildBaseDrugUrls(drug);
  const [labelRes, ndcRes] = await Promise.all([
    fetch(labelUrl.toString(), { headers: { Accept: "application/json" } }),
    fetch(ndcUrl.toString(), { headers: { Accept: "application/json" } }),
  ]);

  if (!labelRes.ok) return c.json({ error: `No FDA label found for ${drug}` }, 404);

  const labelJson = await labelRes.json() as any;
  const ndcJson = ndcRes.ok ? await ndcRes.json().catch(() => null) as any : null;
  const payload = normalizeDrugCardPayload(drug, labelJson, ndcJson, route, form);
  if (!payload) return c.json({ error: `No FDA data found for that filter` }, 404);

  return c.json(payload);
});

// ─── Non-proxied API routes (must be before the /api/* proxy catch-all) ───
app.get("/api/blog", async (c) => {
  const posts = await listBlogPosts();
  return c.json(posts.map(p => ({ title: p.title, slug: p.slug, date: p.date, keywords: p.keywords, excerpt: p.excerpt })));
});

app.get("/api/blog/:slug", async (c) => {
  const slug = c.req.param("slug");
  const post = await getBlogPost(slug);
  if (!post) return c.json({ error: "Post not found" }, 404);
  return c.json({ title: post.title, slug: post.slug, date: post.date, keywords: post.keywords, excerpt: post.excerpt, content: post.content });
});

app.get("/api/hello-zo", (c) => c.json({ msg: "Hello from Zo" }));

/**
 * Proxy /api/* to bio-api backend on port 3131
 */
app.all("/api/:path*", async (c) => {
  const path = c.req.path.replace("/api/", "");
  const apiHost = process.env.BIO_API_URL || "http://127.0.0.1:3131";
  try {
    const url = `${apiHost}/${path}${c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : ""}`;
    const method = c.req.method;
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });
    const body = method !== "GET" && method !== "HEAD" ? await c.req.blob() : undefined;
    const resp = await fetch(url, { method, headers, body, redirect: "manual" });
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    const contentType = resp.headers.get("content-type") || "";
    const data = contentType.includes("json") ? await resp.json() : await resp.text();
    return c.json(data, resp.status);
  } catch (e) {
    console.error("API proxy error:", e);
    return c.json({ error: "API unavailable" }, 502);
  }
});

// ─── Dynamic Sitemap ──────────────────────────────────────────
app.get("/sitemap.xml", async (c) => {
  const posts = await listBlogPosts();
  const baseUrl = "https://academy.endgameenhancements.com";
  const today = new Date().toISOString().split("T")[0];

  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/pricing", priority: "0.9", changefreq: "weekly" },
    { loc: "/drug-cards", priority: "0.9", changefreq: "weekly" },
    { loc: "/clinical-tools", priority: "0.8", changefreq: "weekly" },
    { loc: "/pathways", priority: "0.8", changefreq: "weekly" },
    { loc: "/procedures", priority: "0.7", changefreq: "weekly" },
    { loc: "/blog", priority: "0.9", changefreq: "daily" },
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of staticPages) {
    xml += `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
  }

  for (const post of posts) {
    xml += `  <url>\n    <loc>${baseUrl}/blog/${post.slug}</loc>\n    <lastmod>${post.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }

  xml += '</urlset>';
  return c.text(xml, { headers: { "Content-Type": "application/xml" } });
});

// ─── Blog Engine ───────────────────────────────────────────────
import { readFile as blogReadFile, readdir as blogReaddir } from "node:fs/promises";

interface BlogPost {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
  content: string;
}

interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
}

async function listBlogPosts(): Promise<BlogMeta[]> {
  const blogDir = path.join(import.meta.dir, "data", "blog");
  await mkdir(blogDir, { recursive: true });
  const files = await blogReaddir(blogDir);
  const posts: BlogMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/, "");
    const raw = await blogReadFile(path.join(blogDir, file), "utf-8");
    const meta = parseFrontmatter(raw);
    posts.push({ ...meta, slug });
  }

  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const blogDir = path.join(import.meta.dir, "data", "blog");
  const filePath = path.join(blogDir, `${slug}.md`);
  try {
    const raw = await blogReadFile(filePath, "utf-8");
    const meta = parseFrontmatter(raw);
    return { ...meta, slug, content: meta.content };
  } catch {
    return null;
  }
}

function parseFrontmatter(raw: string): BlogPost {
  const lines = raw.split("\n");
  let inFrontmatter = false;
  let frontmatterEnded = false;
  const meta: Record<string, string> = {};
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.trim() === "---") {
      inFrontmatter = false;
      frontmatterEnded = true;
      continue;
    }
    if (inFrontmatter) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        meta[key] = value;
      }
    } else if (frontmatterEnded) {
      contentLines.push(line);
    }
  }

  return {
    title: meta.title || "Untitled",
    slug: "",
    date: meta.date || new Date().toISOString().split("T")[0],
    keywords: meta.keywords || "",
    excerpt: meta.excerpt || "",
    content: contentLines.join("\n").trim(),
  };
}

function renderMarkdown(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      html += '<pre><code>';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        html += escapeHtml(lines[i]) + "\n";
        i++;
      }
      html += '</code></pre>';
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // H3
    if (line.trim().startsWith("### ")) {
      const text = line.trim().slice(4);
      html += `<h3>${renderInline(text)}</h3>`;
      i++;
      continue;
    }
    // H2
    if (line.trim().startsWith("## ")) {
      const text = line.trim().slice(3);
      html += `<h2>${renderInline(text)}</h2>`;
      i++;
      continue;
    }
    // H1
    if (line.trim().startsWith("# ")) {
      const text = line.trim().slice(2);
      html += `<h1>${renderInline(text)}</h1>`;
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      html += '<hr>';
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      html += '<blockquote>';
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        const text = lines[i].trim().slice(2);
        html += `<p>${renderInline(text)}</p>`;
        i++;
      }
      html += '</blockquote>';
      continue;
    }

    // Unordered list
    if (line.trim().match(/^[-*]\s/)) {
      html += '<ul>';
      while (i < lines.length && lines[i].trim().match(/^[-*]\s/)) {
        const text = lines[i].trim().replace(/^[-*]\s+/, "");
        html += `<li>${renderInline(text)}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    // Ordered list
    if (line.trim().match(/^\d+\.\s/)) {
      html += '<ol>';
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        const text = lines[i].trim().replace(/^\d+\.\s+/, "");
        html += `<li>${renderInline(text)}</li>`;
        i++;
      }
      html += '</ol>';
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const rawRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rawRows.push(lines[i].trim());
        i++;
      }
      if (rawRows.length >= 2) {
        const sepIdx = rawRows.findIndex(r => /^\|[-:\s|]+\|$/.test(r));
        const headerIdx = sepIdx >= 0 ? 0 : 0;
        const dataStart = sepIdx >= 0 ? sepIdx + 1 : 1;
        const headerCells = rawRows[headerIdx].split("|").map(c => c.trim()).filter(Boolean);
        html += '<table><thead><tr>';
        for (const c of headerCells) html += '<th>' + renderInline(c) + '</th>';
        html += '</tr></thead><tbody>';
        for (let ri = dataStart; ri < rawRows.length; ri++) {
          const dCells = rawRows[ri].split("|").map(c => c.trim()).filter(Boolean);
          html += '<tr>';
          for (const c of dCells) html += '<td>' + renderInline(c) + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        continue;
      }
    }

    // Regular paragraph
    let paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("```") && !lines[i].trim().match(/^[-*>]\s/) && !lines[i].trim().match(/^\d+\.\s/) && !lines[i].trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      html += `<p>${renderInline(paraLines.join(" "))}</p>`;
    }
  }

  return html;
}

function renderInline(text: string): string {
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderBlogPost(post: BlogPost): string {
  const contentHtml = renderMarkdown(post.content);
  const keywordsMeta = post.keywords ? `<meta name="keywords" content="${escapeHtml(post.keywords)}">` : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "datePublished": post.date,
    "description": post.excerpt,
    "author": { "@type": "Organization", "name": "Bio-Sync Academy" },
    "publisher": { "@type": "Organization", "name": "Bio-Sync Academy" },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)} — Bio-Sync Academy</title>
<meta name="description" content="${escapeHtml(post.excerpt)}">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.excerpt)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://academy.endgameenhancements.com/blog/${escapeHtml(post.slug)}">
<meta property="og:image" content="https://academy.endgameenhancements.com/images/logo.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://academy.endgameenhancements.com/blog/${escapeHtml(post.slug)}">
<link rel="icon" type="image/png" href="/favicon.png">
${keywordsMeta}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; background: #060b1a; color: #e8e0d0; }
  h1 { font-size: 2rem; color: #fff; margin-bottom: 0.25rem; }
  h2 { font-size: 1.5rem; color: #c9a84c; margin-top: 2rem; }
  h3 { font-size: 1.2rem; color: #d0d0d0; margin-top: 1.5rem; }
  p { margin: 1rem 0; }
  a { color: #4da6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #0c1230; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #0c1230; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
  th, td { border: 1px solid #1a2540; padding: 0.5rem 0.75rem; }
  blockquote { border-left: 3px solid #c9a84c; margin: 1rem 0; padding: 0.5rem 1rem; background: rgba(201,168,76,0.05); font-style: italic; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: 0.5rem 0; }
  hr { border: none; border-top: 1px solid #1a2540; margin: 2rem 0; }
  .post-meta { color: #7a8ba0; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .back-link { display: inline-block; margin-bottom: 2rem; color: #7a8ba0; font-size: 0.9rem; }
  .back-link:hover { color: #c9a84c; }
  .references { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #1a2540; }
  .references h2 { color: #c9a84c; font-size: 1.2rem; }
  .references p { font-size: 0.9rem; color: #7a8ba0; }
  .bio-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #1a2540; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem; }
  .bio-header .brand { display: flex; align-items: center; gap: 0.5rem; }
  .bio-header img { width: 32px; height: 32px; border-radius: 6px; }
  .bio-header .name { font-size: 1rem; font-weight: 600; color: #c9a84c; }
  .bio-header nav { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .bio-header nav a { color: #7a8ba0; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: color 0.2s; }
  .bio-header nav a:hover { color: #c9a84c; text-decoration: none; }
</style>
</head>
<body>
<div class="bio-header">
  <a href="/" style="text-decoration: none;"><div class="brand">
    <img src="/images/logo.jpg" alt="Bio-Sync Academy" width="32" height="32">
    <span class="name">Bio-Sync Academy</span>
  </div></a>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/drug-cards">Drug Cards</a>
    <a href="/clinical-tools">Clinical Tools</a>
    <a href="/pricing">Pricing</a>
  </nav>
</div>
<a href="/blog" class="back-link">← All posts</a>
<h1>${escapeHtml(post.title)}</h1>
<div class="post-meta">Published ${formatDate(post.date)}</div>
${contentHtml}
<div class="references">
  <h2>References</h2>
  <p>Sources available in APA 7th edition format. Access the full reference list and interactive content on <a href="/">Bio-Sync Academy</a>.</p>
</div>
</body>
</html>`;
}

function renderBlogIndex(posts: BlogMeta[]): string {
  const postItems = posts.map(p => `
    <article style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #1a2540;">
      <h2 style="margin-bottom: 0.25rem;"><a href="/blog/${escapeHtml(p.slug)}" style="color: #ffffff;">${escapeHtml(p.title)}</a></h2>
      <div style="color: #7a8ba0; font-size: 0.85rem;">${formatDate(p.date)}</div>
      <p style="color: #aaa0b0; margin-top: 0.5rem;">${escapeHtml(p.excerpt)}</p>
      <a href="/blog/${escapeHtml(p.slug)}" style="color: #4da6ff; font-size: 0.9rem;">Read more →</a>
    </article>
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog — Bio-Sync Academy | Nursing Pharmacology</title>
<meta name="description" content="Nursing pharmacology articles, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.">
<meta property="og:title" content="Bio-Sync Academy Blog">
<meta property="og:description" content="Nursing pharmacology articles, NCLEX study guides, and drug deep-dives.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://academy.endgameenhancements.com/blog">
<meta property="og:image" content="https://academy.endgameenhancements.com/images/logo.jpg">
<link rel="canonical" href="https://academy.endgameenhancements.com/blog">
<link rel="icon" type="image/png" href="/favicon.png">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; background: #060b1a; color: #e8e0d0; }
  a { color: #4da6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .bio-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #1a2540; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem; }
  .bio-header .brand { display: flex; align-items: center; gap: 0.5rem; }
  .bio-header img { width: 32px; height: 32px; border-radius: 6px; }
  .bio-header .name { font-size: 1rem; font-weight: 600; color: #c9a84c; }
  .bio-header nav { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .bio-header nav a { color: #7a8ba0; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: color 0.2s; }
  .bio-header nav a:hover { color: #c9a84c; text-decoration: none; }
</style>
</head>
<body>
<div class="bio-header">
  <a href="/" style="text-decoration: none;"><div class="brand">
    <img src="/images/logo.jpg" alt="Bio-Sync Academy" width="32" height="32">
    <span class="name">Bio-Sync Academy</span>
  </div></a>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/drug-cards">Drug Cards</a>
    <a href="/clinical-tools">Clinical Tools</a>
    <a href="/pricing">Pricing</a>
  </nav>
</div>
<h1 style="color: #ffffff; font-size: 1.8rem;">Blog</h1>
<p style="color: #7a8ba0; margin-bottom: 2rem;">Nursing pharmacology deep-dives, NCLEX study guides, and clinical reasoning articles.</p>
${postItems || '<p style="color: #7a8ba0;">No posts yet. Check back soon.</p>'}
</body>
</html>`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

async function getPageMeta(path: string): Promise<{ title: string; description: string; ogTitle: string; ogDescription: string }> {
  const base = "Bio-Sync Academy";
  if (path === "/" || path === "") {
    return { title: "Bio-Sync Academy", description: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.", ogTitle: "Bio-Sync Academy", ogDescription: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA." };
  }
  if (path.startsWith("/blog/")) {
    const slug = path.slice(6);
    const post = await getBlogPost(slug);
    if (post) {
      return { title: post.title, description: post.excerpt, ogTitle: post.title, ogDescription: post.excerpt };
    }
  }
  if (path === "/drug-cards") {
    return { title: "Drug Cards", description: "Browse FDA drug labels, NDC products, and adverse events for nursing pharmacology.", ogTitle: "Drug Cards", ogDescription: "Browse FDA drug labels, NDC products, and adverse events for nursing pharmacology." };
  }
  if (path === "/clinical-tools") {
    return { title: "Clinical Tools", description: "Interactive clinical tools for nursing education, including drug interactions, dosing, and NCLEX practice.", ogTitle: "Clinical Tools", ogDescription: "Interactive clinical tools for nursing education, including drug interactions, dosing, and NCLEX practice." };
  }
  if (path === "/pricing") {
    return { title: "Pricing", description: "View Bio-Sync Academy Pro MAIA subscription plans and features.", ogTitle: "Pricing", ogDescription: "View Bio-Sync Academy Pro MAIA subscription plans and features." };
  }
  if (path === "/terms") {
    return { title: "Terms", description: "Terms of service for Bio-Sync Academy.", ogTitle: "Terms", ogDescription: "Terms of service for Bio-Sync Academy." };
  }
  if (path === "/privacy") {
    return { title: "Privacy", description: "Privacy policy for Bio-Sync Academy.", ogTitle: "Privacy", ogDescription: "Privacy policy for Bio-Sync Academy." };
  }
  if (path === "/refund-policy") {
    return { title: "Refund Policy", description: "Refund policy for Bio-Sync Academy.", ogTitle: "Refund Policy", ogDescription: "Refund policy for Bio-Sync Academy." };
  }
  if (path === "/procedures") {
    return { title: "Procedures", description: "Clinical procedures for nursing education.", ogTitle: "Procedures", ogDescription: "Clinical procedures for nursing education." };
  }
  return { title: "Bio-Sync Academy", description: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.", ogTitle: "Bio-Sync Academy", ogDescription: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA." };
}

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

/**
 * Determine port based on mode. In production, use the published_port if available.
 * In development, always use the local_port.
 * Ports are managed by the system and injected via the PORT environment variable.
 */
const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

/**
 * Configure routing for production builds.
 *
 * - Streams prebuilt assets from `dist`.
 * - Static files from `public/` are copied to `dist/` by Vite and served at root paths.
 * - Falls back to `index.html` for any other GET so the SPA router can resolve the request.
 */
function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.png", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();

    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();

    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    // Serve SPA template with page-specific meta tags
    const meta = await getPageMeta(path);
    let html = await Bun.file("./dist/index.html").text();
    
    // Replace title and description
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${meta.description}"`);
    html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${meta.ogTitle}"`);
    html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${meta.ogDescription}"`);
    html = html.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${meta.ogTitle}"`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${meta.ogDescription}"`);
    html = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="https://academy.endgameenhancements.com${path}"`);
    html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="https://academy.endgameenhancements.com${path}"`);

    // Inject JSON-LD structured data for blog posts
    if (path.startsWith("/blog/") && path !== "/blog") {
      const slug = path.split("/blog/")[1];
      const post = await getBlogPost(slug);
      if (post) {
        const ld = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "datePublished": post.date,
          "author": {
            "@type": "Person",
            "name": "Bio-Sync Academy",
            "url": "https://academy.endgameenhancements.com"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Bio-Sync Academy",
            "logo": {
              "@type": "ImageObject",
              "url": "https://academy.endgameenhancements.com/images/logo.jpg"
            }
          },
          "description": post.excerpt,
          "keywords": post.keywords,
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `https://academy.endgameenhancements.com/blog/${slug}`
          }
        });
        html = html.replace("</head>", `<script type="application/ld+json">${ld}</script></head>`);
      }
    }

    return c.html(html);
  });
}

/**
 * Configure routing for development builds.
 *
 * - Boots Vite in middleware mode for transforms.
 * - Static files from `public/` are served at root paths (matching Vite convention).
 * - Mirrors production routing semantics so SPA routes behave consistently.
 */
async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path.startsWith("/blog")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}

function buildModifyToolPrompt(existingTool: GeneratedToolPayload, instruction: string) {
  return `Modify this existing nursing education clinical tool as STRICT JSON only. Do not include markdown fences or commentary.

Modification request: ${instruction}

Existing tool JSON:
${JSON.stringify(existingTool, null, 2)}

Return the complete updated tool using the same schema as before. Preserve the existing id exactly unless the user explicitly asks to rename/rebuild it. Keep all safe/valuable existing sections unless the modification says to remove them.`;
}

async function generateModifiedToolWithOllama(existingTool: GeneratedToolPayload, instruction: string) {
  const selected = selectOllamaModel();
  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: selected.model,
      stream: false,
      messages: [
        { role: "system", content: "You modify strict JSON nursing education tools. Output JSON only." },
        { role: "user", content: buildModifyToolPrompt(existingTool, instruction) },
      ],
      options: { ...selected.options, temperature: 0.1 },
    }),
  });
  if (!response.ok) throw new Error("Local MAIA tool modification failed");
  const data = await response.json() as { message?: { content?: string }; response?: string };
  return { text: cleanLocalModelOutput(data.message?.content || data.response || ""), model: `ollama:${selected.model}` };
}

async function generateModifiedToolWithZoAsk(existingTool: GeneratedToolPayload, instruction: string, forcedModel?: string) {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable for Pro MAIA");
  const model = forcedModel || process.env.MAIA_PRO_MODEL || DEFAULT_PRO_MODEL;
  const response = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { "Authorization": token, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ input: buildModifyToolPrompt(existingTool, instruction), model_name: model }),
  });
  if (!response.ok) throw new Error(`Pro MAIA tool modification failed: ${response.status}`);
  const data = await response.json() as { output?: string };
  return { text: data.output || "", model };
}
app.get("/api/guest-start", async (c) => {
  const existing = decodeGuestSession(getCookie(c, guestSessionCookie));
  const payload = existing || { id: `guest_${randomBytes(8).toString("hex")}`, createdAt: Date.now() };
  const res = c.json({ ok: true, guest: payload });
  res.headers.append("Set-Cookie", cookieHeader(guestSessionCookie, encodeGuestSession(payload), 60 * 60 * 24 * 7));
  return res;
});