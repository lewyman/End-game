import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight immediately - before any other logic
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Key, Authorization, X-User-Tier");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const path = (req.query.path as string) || "/";
  const method = req.method;

  // GET /api?path=/drugs
  if (path === "/drugs" && method === "GET") {
    const { data } = await supabase.from("drugs").select("*").order("name");
    res.json({ drugs: data || [] });
    return;
  }

  // GET /api?path=/drugs/:slug
  const drugMatch = path.match(/^\/drugs\/([^/]+)$/);
  if (drugMatch && method === "GET") {
    const slug = drugMatch[1];
    const { data: drug } = await supabase.from("drugs").select("*").eq("slug", slug).single();
    if (!drug) { res.status(404).json({ error: "Not found" }); return; }
    const { data: blocks } = await supabase.from("content_blocks").select("*").eq("drug_slug", slug).order("block_order");
    res.json({ drug: { ...drug, blocks: blocks || [] } });
    return;
  }

  // POST /api?path=/login
  if (path === "/login" && method === "POST") {
    const { email, password } = req.body;
    const { data: user } = await supabase.from("users").select("*").eq("email", email?.trim().toLowerCase()).single();
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const bcrypt = await import("bcryptjs");
    if (!(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    res.json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin } });
    return;
  }

  // POST /api?path=/signup
  if (path === "/signup" && method === "POST") {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) { res.status(400).json({ error: "Invalid input" }); return; }
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
    if (error) { res.status(400).json({ error: "Email registered" }); return; }
    res.json({ success: true });
    return;
  }

  res.status(404).json({ error: "Not found" });
}
