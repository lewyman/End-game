import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const sessions = new Map<string, { email: string; isAdmin: boolean; createdAt: number }>();

function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Key, X-User-Email");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const url = new URL(req.url || "", "https://localhost");
  const path = url.pathname.replace(/^\/api\//, "") || "health";
  const method = req.method;

  try {
    // HEALTH
    if (path === "health") {
      const { data } = await supabase.from("drugs").select("id");
      res.status(200).json({ status: "ok", drugs: (data || []).length }); return;
    }

    // PUBLIC: List all drugs
    if (path === "drugs" && method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      res.status(200).json({ drugs: data || [] }); return;
    }

    // PUBLIC: Get single drug with blocks
    const drugMatch = path.match(/^drugs\/(.+)$/);
    if (drugMatch && method === "GET") {
      const slug = drugMatch[1];
      const { data: drug } = await supabase.from("drugs").select("*").eq("slug", slug).single();
      if (!drug) { res.status(404).json({ error: "Drug not found" }); return; }
      const { data: blocks } = await supabase.from("content_blocks").select("*").eq("drug_slug", slug).order("block_order");
      res.status(200).json({ drug: { ...drug, blocks: blocks || [] } }); return;
    }

    // PUBLIC: Login
    if (path === "login" && method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password) { res.status(400).json({ error: "Missing credentials" }); return; }
      const { data: user } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({ error: "Invalid credentials" }); return;
      }
      let sessionKey = null;
      if (user.is_admin) {
        sessionKey = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
        sessions.set(sessionKey, { email: user.email, isAdmin: true, createdAt: Date.now() });
      }
      res.status(200).json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin, sessionKey } }); return;
    }

    // PUBLIC: Signup
    if (path === "signup" && method === "POST") {
      const { email, password } = req.body || {};
      if (!email || !password || password.length < 6) { res.status(400).json({ error: "Invalid input" }); return; }
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
      if (error) { res.status(400).json({ error: "Email already registered" }); return; }
      res.status(200).json({ success: true }); return;
    }

    // SESSION AUTH helper
    function getSessionUser() {
      const key = req.headers["x-session-key"] as string;
      const email = req.headers["x-user-email"] as string;
      if (key?.startsWith("admin-") && email) {
        const s = sessions.get(key);
        if (s && s.email === email && s.isAdmin) return email;
      }
      return null;
    }

    // ADMIN: require auth
    const adminEmail = getSessionUser();

    // ADMIN: List users
    if (path === "admin/users" && method === "GET" && adminEmail) {
      const { data } = await supabase.from("users").select("*").order("joined_at", { ascending: false });
      res.status(200).json({ users: data || [] }); return;
    }

    // ADMIN: Update user
    const userMatch = path.match(/^admin\/users\/(.+)$/);
    if (userMatch && method === "PUT" && adminEmail) {
      const email = userMatch[1];
      const { tier, is_admin } = req.body || {};
      const updates: any = {};
      if (tier) updates.tier = tier;
      if (is_admin !== undefined) updates.is_admin = is_admin;
      const { error } = await supabase.from("users").update(updates).eq("email", decodeURIComponent(email));
      if (error) { res.status(400).json({ error: error.message }); return; }
      res.status(200).json({ success: true }); return;
    }

    // ADMIN: Create drug
    if (path === "admin/drugs" && method === "POST" && adminEmail) {
      const { slug, name, class: drugClass, description, tier, image } = req.body || {};
      if (!slug || !name || !drugClass) { res.status(400).json({ error: "Missing required fields" }); return; }
      const { error } = await supabase.from("drugs").insert([{ slug, name, class: drugClass, description: description || "", tier: tier || "free", image: image || "" }]);
      if (error) { res.status(400).json({ error: error.message }); return; }
      res.status(200).json({ success: true, slug }); return;
    }

    // ADMIN: Update drug
    if (userMatch && path.startsWith("admin/drugs/") && method === "PUT" && adminEmail) {
      const slug = userMatch[1];
      const { name, class: drugClass, description, tier, image } = req.body || {};
      const updates: any = {};
      if (name) updates.name = name;
      if (drugClass) updates.class = drugClass;
      if (description !== undefined) updates.description = description;
      if (tier) updates.tier = tier;
      if (image !== undefined) updates.image = image;
      const { error } = await supabase.from("drugs").update(updates).eq("slug", decodeURIComponent(slug));
      if (error) { res.status(400).json({ error: error.message }); return; }
      res.status(200).json({ success: true }); return;
    }

    // ADMIN: Delete drug
    if (userMatch && path.startsWith("admin/drugs/") && method === "DELETE" && adminEmail) {
      const slug = decodeURIComponent(userMatch[1]);
      await supabase.from("content_blocks").delete().eq("drug_slug", slug);
      await supabase.from("drugs").delete().eq("slug", slug);
      res.status(200).json({ success: true }); return;
    }

    // ADMIN: Get drug blocks
    if (path.match(/^admin\/drugs\/.+\/blocks$/) && method === "GET" && adminEmail) {
      const slug = decodeURIComponent(path.match(/^admin\/drugs\/(.+)\/blocks$/)?.[1] || "");
      const { data: blocks } = await supabase.from("content_blocks").select("*").eq("drug_slug", slug).order("block_order");
      res.status(200).json({ blocks: blocks || [] }); return;
    }

    // ADMIN: Save drug blocks
    if (path.match(/^admin\/drugs\/.+\/blocks$/) && method === "PUT" && adminEmail) {
      const slug = decodeURIComponent(path.match(/^admin\/drugs\/(.+)\/blocks$/)?.[1] || "");
      const { blocks } = req.body || {};
      if (!Array.isArray(blocks)) { res.status(400).json({ error: "blocks must be an array" }); return; }
      // Delete existing, insert new
      await supabase.from("content_blocks").delete().eq("drug_slug", slug);
      if (blocks.length > 0) {
        const toInsert = blocks.map((b: any, i: number) => ({
          drug_slug: slug,
          block_order: b.block_order ?? i,
          type: b.type || "content",
          title: b.title || "",
          content: b.content || "",
          key_points: b.keyPoints || b.key_points || "",
          question: b.question || "",
          options: Array.isArray(b.options) ? b.options.join("|") : (b.options || ""),
          correct: b.correct || "",
          explanation: b.explanation || "",
          rationale: b.rationale || "",
          image: b.image || "",
        }));
        const { error } = await supabase.from("content_blocks").insert(toInsert);
        if (error) { res.status(400).json({ error: error.message }); return; }
      }
      res.status(200).json({ success: true }); return;
    }

    res.status(404).json({ error: `Not found: ${path}` });
  } catch (err: any) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
