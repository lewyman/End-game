import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Key");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const url = new URL(req.url || "", "https://localhost");
  const path = url.pathname.replace(/^\/api\//, "") || "health";
  const method = req.method;

  try {
    if (path === "health") { res.status(200).json({ status: "ok" }); return; }

    if (path === "drugs" && method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      res.status(200).json({ drugs: data || [] }); return;
    }

    if (path === "login" && method === "POST") {
      const { email, password } = req.body || {};
      const { data: user } = await supabase.from("users").select("*").eq("email", email?.trim().toLowerCase()).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({ error: "Invalid credentials" }); return;
      }
      res.status(200).json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin } }); return;
    }

    if (path === "signup" && method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password || password.length < 6) { res.status(400).json({ error: "Invalid input" }); return; }
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
      if (error) { res.status(400).json({ error: "Email registered" }); return; }
      res.status(200).json({ success: true }); return;
    }

    res.status(404).json({ error: `Not found: ${path}` });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
