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

  const path = (req.query.path as string) || "health";
  const method = req.method;

  try {
    if (path === "health") return json({ status: "ok" });

    if (path === "drugs" && method === "GET") {
      const { data } = await supabase.from("drugs").select("*").order("name");
      return json({ drugs: data || [] });
    }

    if (path === "login" && method === "POST") {
      const { email, password } = req.body;
      const { data: user } = await supabase.from("users").select("*").eq("email", email?.trim().toLowerCase()).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return json({ error: "Invalid credentials" }, 401);
      }
      return json({ success: true, user: { email: user.email, tier: user.tier, isAdmin: user.is_admin } });
    }

    if (path === "signup" && method === "POST") {
      const { email, password } = req.body;
      if (!email || !password || password.length < 6) return json({ error: "Invalid input" }, 400);
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert([{ email: email.trim().toLowerCase(), password: hash, tier: "free", is_admin: false }]);
      if (error) return json({ error: "Email registered" }, 400);
      return json({ success: true });
    }

    const adminMatch = path.match(/^admin\/drugs\/(.+)/);
    if (adminMatch && method === "PUT") {
      const slug = adminMatch[1];
      const { name, class: drugClass, description, tier, image } = req.body;
      const { error } = await supabase.from("drugs").update({ name, class: drugClass, description, tier, image }).eq("slug", slug);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: "Internal error" }, 500);
  }
}
