import { Hono } from "hono";
import { getCookie, cookieHeader, clearCookieHeader, encodeSession, getCurrentUser } from "../lib/auth-helpers";

const app = new Hono();

// Paste auth routes from server.ts below
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


export default app;