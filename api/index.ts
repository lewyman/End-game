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

async function resolveUserId(req: VercelRequest) {
  const headerId = req.headers["x-user-id"] as string | undefined;
  if (headerId) return headerId;
  const email = req.headers["x-user-email"] as string | undefined;
  if (!email) return null;
  const { data } = await supabase.from("users").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

function getUserEmail(req: VercelRequest) {
  return (req.headers["x-user-email"] as string | undefined) || null;
}

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

  // GET /api?path=/health
  if (path === "/health" && method === "GET") {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
    return;
  }

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

  // POST /api?path=/oauth-login (Google, Facebook, Microsoft)
  if (path === "/oauth-login" && method === "POST") {
    const { email, provider } = req.body;
    if (!email || !provider) { res.status(400).json({ error: "Email and provider required" }); return; }
    
    // Check if user exists by email
    const { data: existingUser } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
    
    if (existingUser) {
      // User exists - return user with current tier
      res.json({ 
        success: true, 
        user: { 
          email: existingUser.email, 
          tier: existingUser.tier || "free", 
          isAdmin: existingUser.is_admin 
        } 
      });
      return;
    }
    
    // Create new OAuth user with free tier
    const { error: insertError } = await supabase.from("users").insert([{ 
      email: email.trim().toLowerCase(), 
      password: "", // OAuth users don't need password
      tier: "free", 
      is_admin: false,
      oauth_provider: provider 
    }]);
    
    if (insertError) { res.status(400).json({ error: insertError.message }); return; }
    
    res.json({ 
      success: true, 
      user: { 
        email: email.trim().toLowerCase(), 
        tier: "free", 
        isAdmin: false 
      } 
    });
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

  // GET /api?path=/songs
  if (path === "/songs" && method === "GET") {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    res.json({ songs: data || [] });
    return;
  }

  // GET /api?path=/songs/:slug
  const songMatch = path.match(/^\/songs\/([^/]+)$/);
  if (songMatch && method === "GET") {
    const slug = songMatch[1];
    const { data: song } = await supabase.from("songs").select("*").eq("slug", slug).single();
    if (!song) { res.status(404).json({ error: "Not found" }); return; }
    // Increment play count
    await supabase.from("songs").update({ play_count: (song.play_count || 0) + 1 }).eq("slug", slug);
    res.json({ song });
    return;
  }

  // Playlists, favorites, recently played helpers
  if (path === "/playlists" && method === "GET") {
    const uid = await resolveUserId(req);
    const query = supabase.from("playlists").select("*, playlist_songs(song_id)").order("created_at", { ascending: false });
    const finalQuery = uid ? query.or(`is_public.eq.true,user_id.eq.${uid}`) : query.eq("is_public", true);
    const { data } = await finalQuery;
    res.json({ playlists: data || [] });
    return;
  }

  if (path === "/playlists" && method === "POST") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user info" }); return; }
    const { name, description, isPublic } = req.body;
    if (!name) { res.status(400).json({ error: "Playlist name required" }); return; }
    const { data, error } = await supabase.from("playlists").insert([{ user_id: uid, name, description: description || "", is_public: !!isPublic }]).select().single();
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ playlist: data });
    return;
  }

  const playlistSongMatch = path.match(/^\/playlists\/([^/]+)\/songs$/);
  if (playlistSongMatch && method === "POST") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const playlistId = playlistSongMatch[1];
    const playlist = await supabase.from("playlists").select("user_id").eq("id", playlistId).single();
    if (!playlist.data || playlist.data.user_id !== uid) { res.status(403).json({ error: "Not owner" }); return; }
    const { songId } = req.body;
    if (!songId) { res.status(400).json({ error: "songId required" }); return; }
    const { error } = await supabase.from("playlist_songs").insert([{ playlist_id: playlistId, song_id: songId }]);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
    return;
  }

  const playlistSongDeleteMatch = path.match(/^\/playlists\/([^/]+)\/songs\/([^/]+)$/);
  if (playlistSongDeleteMatch && method === "DELETE") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const playlistId = playlistSongDeleteMatch[1];
    const songId = playlistSongDeleteMatch[2];
    const playlist = await supabase.from("playlists").select("user_id").eq("id", playlistId).single();
    if (!playlist.data || playlist.data.user_id !== uid) { res.status(403).json({ error: "Not owner" }); return; }
    await supabase.from("playlist_songs").delete().eq("playlist_id", playlistId).eq("song_id", songId);
    res.json({ success: true });
    return;
  }

  if (path === "/favorites" && method === "GET") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const { data } = await supabase.from("favorites").select("song_id").eq("user_id", uid);
    res.json({ favorites: (data || []).map((row) => row.song_id) });
    return;
  }

  if (path === "/favorites" && method === "POST") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const { songId } = req.body;
    if (!songId) { res.status(400).json({ error: "songId required" }); return; }
    const { error } = await supabase.from("favorites").insert([{ user_id: uid, song_id: songId }]);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
    return;
  }

  const favoriteDeleteMatch = path.match(/^\/favorites\/([^/]+)$/);
  if (favoriteDeleteMatch && method === "DELETE") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    await supabase.from("favorites").delete().eq("user_id", uid).eq("song_id", favoriteDeleteMatch[1]);
    res.json({ success: true });
    return;
  }

  if (path === "/recently-played" && method === "GET") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const { data } = await supabase
      .from("recently_played")
      .select("song_id, played_at")
      .eq("user_id", uid)
      .order("played_at", { ascending: false })
      .limit(20);
    res.json({ recentlyPlayed: data || [] });
    return;
  }

  if (path === "/recently-played" && method === "POST") {
    const uid = await resolveUserId(req);
    if (!uid) { res.status(401).json({ error: "Missing user" }); return; }
    const { songId } = req.body;
    if (!songId) { res.status(400).json({ error: "songId required" }); return; }
    await supabase.from("recently_played").insert([{ user_id: uid, song_id: songId }]);
    res.json({ success: true });
    return;
  }

  // POST /api?path=/admin/songs (admin only)
  if (path === "/admin/songs" && method === "POST") {
    const adminEmail = req.headers["x-admin-email"] as string;
    if (!adminEmail) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { data: admin } = await supabase.from("users").select("is_admin").eq("email", adminEmail).single();
    if (!admin?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }
    const { slug, title, artist, drug_name, drug_class, description, lyrics, audio_path, cover_path, duration_seconds, tier, genre } = req.body;
    if (!slug || !title || !drug_name || !audio_path) { res.status(400).json({ error: "slug, title, drug_name, audio_path required" }); return; }
    const { error } = await supabase.from("songs").insert([{ slug, title, artist: artist || 'NursingPharmacology', drug_name, drug_class: drug_class || '', description: description || '', lyrics: lyrics || '', audio_path, cover_path: cover_path || '', duration_seconds: duration_seconds || 180, tier: tier || 'free', genre: genre || 'pop' }]);
    if (error) { res.status(400).json({ error: error.message }); return; }
    res.json({ success: true });
    return;
  }

  // DELETE /api?path=/admin/songs/:slug (admin only)
  const deleteSongMatch = path.match(/^\/admin\/songs\/([^/]+)$/);
  if (deleteSongMatch && method === "DELETE") {
    const adminEmail = req.headers["x-admin-email"] as string;
    if (!adminEmail) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { data: admin } = await supabase.from("users").select("is_admin").eq("email", adminEmail).single();
    if (!admin?.is_admin) { res.status(403).json({ error: "Admin only" }); return; }
    await supabase.from("songs").delete().eq("slug", deleteSongMatch[1]);
    res.json({ success: true });
    return;
  }

  res.status(404).json({ error: "Not found" });
}
