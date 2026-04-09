import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const SYSTEM_PROMPT = `You are a medical educator for nursing students. You explain concepts, walk through case studies, and quiz students. You do NOT diagnose or give medical advice. Everything is educational only. Be thorough but clear.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  // POST /api?path=/educator
  if (path === "/educator" && method === "POST") {
    const { message, userId } = req.body;
    if (!message || !userId) { res.status(400).json({ error: "Missing message or userId" }); return; }

    await supabase.from("messages").insert([{ user_id: userId, role: "user", content: message }]);

    const apiKey = process.env.GROK_KEY;
    if (!apiKey) { res.status(500).json({ error: "GROK_KEY not configured" }); return; }

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: message }], temperature: 0.7, max_tokens: 2048 })
    });

    if (!groqRes.ok) { res.status(502).json({ error: "LLM error" }); return; }
    const groqData = await groqRes.json();
    const aiResponse = groqData.choices?.[0]?.message?.content || "";

    await supabase.from("messages").insert([{ user_id: userId, role: "assistant", content: aiResponse }]);

    let audioUrl: string | null = null;
    const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}";
    try {
      const credentials = JSON.parse(credJson);
      const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      const client = await auth.getClient();
      const tokenRes = await client.getAccessToken();
      const token = tokenRes?.token;
      if (token) {
        const ttsRes = await fetch(TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ input: { text: aiResponse.substring(0, 5000) }, voice: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" }, audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: 0 } })
        });
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.audioContent) audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
        }
      }
    } catch (_) { /* TTS optional */ }

    res.json({ response: aiResponse, audioUrl });
    return;
  }

  res.status(404).json({ error: "Not found" });
}
