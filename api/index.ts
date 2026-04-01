import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Key, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const pathname = req.url?.split("?")[0] || "/";
  const path = pathname.replace(/^\/api/, "") || "/";
  const method = req.method;

  try {
    if (path === "/health" || path === "/") {
      res.json({ status: "ok" }); return;
    }

    if (path === "/drugs" && method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      res.json({ drugs: data || [] }); return;
    }

    const drugMatch = path.match(/^\/drugs\/([^/]+)$/);
    if (drugMatch && method === "GET") {
      const slug = drugMatch[1];
      const { data: drug } = await supabase.from("drugs").select("*").eq("slug", slug).single();
      if (!drug) { res.status(404).json({ error: "Not found" }); return; }
      const { data: blocks } = await supabase.from("content_blocks").select("*").eq("drug_slug", slug).order("block_order");
      res.json({ drug: { ...drug, blocks: blocks || [] } }); return;
    }

    if (path === "/login" && method === "POST") {
      const { email, password } = req.body || {};
      const { data: user } = await supabase.from("users").select("*").eq("email", email?.trim().toLowerCase()).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({ error: "Invalid credentials" }); return;
      }
      res.json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin } }); return;
    }

    if (path === "/signup" && method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password || password.length < 6) { res.status(400).json({ error: "Invalid input" }); return; }
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
      if (error) { res.status(400).json({ error: "Email registered" }); return; }
      res.json({ success: true }); return;
    }

    const sessionKey = req.headers["x-session-key"] as string;
    const userEmail = req.headers["x-user-email"] as string;
    let isAdmin = false;
    if (sessionKey?.startsWith("admin-") && userEmail) {
      const { data: u } = await supabase.from("users").select("is_admin").eq("email", userEmail).single();
      isAdmin = u?.is_admin === true;
    }

    if (path === "/admin/drugs" && method === "POST") {
      if (!isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
      const { slug, name, class: drugClass, description, tier = "free", image } = req.body;
      const { error } = await supabase.from("drugs").insert([{ slug, name, class: drugClass, description, tier, image: image || "" }]);
      if (error) { res.status(400).json({ error: error.message }); return; }
      res.json({ success: true, slug }); return;
    }

    const adminMatch = path.match(/^\/admin\/drugs\/(.+)$/);
    if (adminMatch) {
      const slug = adminMatch[1];
      if (!isAdmin) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (method === "PUT") {
        const { name, class: drugClass, description, tier, image } = req.body;
        const { error } = await supabase.from("drugs").update({ name, class: drugClass, description, tier, image: image || "" }).eq("slug", slug);
        if (error) { res.status(400).json({ error: error.message }); return; }
        res.json({ success: true }); return;
      }
      if (method === "DELETE") {
        await supabase.from("content_blocks").delete().eq("drug_slug", slug);
        await supabase.from("drugs").delete().eq("slug", slug);
        res.json({ success: true }); return;
      }
    }

    res.status(404).json({ error: "Not found" });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
