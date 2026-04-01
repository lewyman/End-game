import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Session-Key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).end();

  // Extract path from URL - Vercel passes it via query when using rewrites
  const url = new URL(req.url || "", `https://${req.headers.host || "localhost"}`);
  let path = url.pathname.replace(/^\/api\//, "") || "health";
  if (!path || path === "/api") path = "health";

  const method = req.method;

  try {
    if (path === "health") return json({ status: "ok" });

    if (path === "drugs" && method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      return json({ drugs: data || [] });
    }

    if (path === "login" && method === "POST") {
      const { email, password } = req.body || {};
      const { data: user } = await supabase.from("users").select("*").eq("email", email?.trim().toLowerCase()).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return json({ error: "Invalid credentials" }, 401);
      }
      return json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin } });
    }

    if (path === "signup" && method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password || password.length < 6) return json({ error: "Invalid input" }, 400);
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
      if (error) return json({ error: "Email registered" }, 400);
      return json({ success: true });
    }

    return json({ error: `Route not found: ${path}` }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: "Internal error" }, 500);
  }
}
