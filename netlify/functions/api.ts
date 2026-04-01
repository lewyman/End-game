import type { Context } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Session-Key, Authorization, X-User-Email",
};

const sessions = new Map<string, { email: string; createdAt: number }>();

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function requireAdmin(headers: Headers): Promise<string | null> {
  const key = headers.get("x-session-key");
  const email = headers.get("x-user-email");
  if (key?.startsWith("admin-") && email) {
    const { data: u } = await supabase.from("users").select("is_admin").eq("email", email).single();
    if (u?.is_admin) return email;
  }
  const s = sessions.get(key || "");
  if (!s) return null;
  const { data: u } = await supabase.from("users").select("is_admin,email").eq("email", s.email).single();
  return u?.is_admin ? u.email : null;
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  
  const url = new URL(req.url);
  const path = url.pathname.replace("/.netlify/functions/api", "").replace(/^\//, "") || "health";
  
  try {
    if (path === "health") return json({ status: "ok" });
    
    if (path === "drugs" && req.method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      return json({ drugs: data || [] });
    }
    
    const drugMatch = path.match(/^drugs\/([^/]+)$/);
    if (drugMatch && req.method === "GET") {
      const slug = drugMatch[1];
      const { data: drug } = await supabase.from("drugs").select("*").eq("slug", slug).single();
      if (!drug) return json({ error: "Not found" }, 404);
      const { data: blocks } = await supabase.from("content_blocks").select("*").eq("drug_slug", slug).order("block_order");
      return json({ drug: { ...drug, blocks: blocks || [] } });
    }
    
    if (path === "login" && req.method === "POST") {
      const body = await req.json();
      const email = body.email?.trim().toLowerCase();
      const { data: user } = await supabase.from("users").select("*").eq("email", email).single();
      if (!user || !(await bcrypt.compare(body.password, user.password))) {
        return json({ error: "Invalid credentials" }, 401);
      }
      let sessionKey = null;
      if (user.is_admin) {
        sessionKey = `admin-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
        sessions.set(sessionKey, { email: user.email, createdAt: Date.now() });
      }
      return json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin, sessionKey } });
    }
    
    if (path === "signup" && req.method === "POST") {
      const body = await req.json();
      const email = body.email?.trim().toLowerCase();
      if (!email || !body.password || body.password.length < 6) return json({ error: "Invalid input" }, 400);
      const hash = await bcrypt.hash(body.password, 10);
      const { error } = await supabase.from("users").insert([{ email, password: hash, tier: "free", is_admin: false }]);
      if (error) return json({ error: "Email registered" }, 400);
      return json({ success: true, user: { email, tier: "free", isAdmin: false } });
    }
    
    const adminEmail = await requireAdmin(req.headers);
    
    if (path === "admin/drugs" && req.method === "POST") {
      if (!adminEmail) return json({ error: "Unauthorized" }, 401);
      const body = await req.json();
      const { slug, name, class: drugClass, description, tier = "free", image } = body;
      const { error } = await supabase.from("drugs").insert([{ slug, name, class: drugClass, description, tier, image: image || "", created_at: new Date().toISOString() }]);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, slug });
    }
    
    const updateMatch = path.match(/^admin\/drugs\/(.+)$/);
    if (updateMatch && req.method === "PUT") {
      if (!adminEmail) return json({ error: "Unauthorized" }, 401);
      const slug = updateMatch[1];
      const body = await req.json();
      const { name, class: drugClass, description, tier, image } = body;
      const { error } = await supabase.from("drugs").update({ name, class: drugClass, description, tier, image: image || "", updated_at: new Date().toISOString() }).eq("slug", slug);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
    
    if (updateMatch && req.method === "DELETE") {
      if (!adminEmail) return json({ error: "Unauthorized" }, 401);
      const slug = updateMatch[1];
      await supabase.from("content_blocks").delete().eq("drug_slug", slug);
      await supabase.from("drugs").delete().eq("slug", slug);
      return json({ success: true });
    }
    
    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    console.error("API Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};
