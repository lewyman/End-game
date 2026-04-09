import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const SYSTEM_PROMPT = `You are a medical educator for nursing students. You explain concepts, walk through case studies, and quiz students. You do NOT diagnose or give medical advice. Everything is educational only. Be thorough but clear.`;

// Groq API
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Google TTS REST API
const TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { message, userId } = req.body;

  if (!message || !userId) {
    res.status(400).json({ error: "Missing message or userId" });
    return;
  }

  try {
    // Save user's message to Supabase
    const { error: userError } = await supabase.from("messages").insert([
      {
        user_id: userId,
        role: "user",
        content: message,
      }
    ]);
    if (userError) {
      console.error("Error saving user message:", userError);
    }

    // Call Groq API
    const apiKey = process.env.GROK_KEY;
    if (!apiKey) {
      throw new Error("GROK_KEY not configured");
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const aiResponse = groqData.choices?.[0]?.message?.content || "";

    // Save AI response to Supabase
    const { error: aiError } = await supabase.from("messages").insert([
      {
        user_id: userId,
        role: "assistant",
        content: aiResponse,
      }
    ]);
    if (aiError) {
      console.error("Error saving AI response:", aiError);
    }

    // Generate speech with Google TTS using service account
    let audioUrl = null;
    try {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}");
      
      const auth = new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      const client = await auth.getClient();
      const token = await client.getAccessToken();

      if (token) {
        const ttsResponse = await fetch(TTS_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            input: { text: aiResponse.substring(0, 5000) },
            voice: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
            audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: 0 },
          }),
        });

        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          if (ttsData.audioContent) {
            audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
          }
        } else {
          console.error("TTS API error:", await ttsResponse.text());
        }
      } else {
        console.error("No access token obtained");
      }
    } catch (ttsError) {
      console.error("TTS error:", ttsError);
    }

    res.json({ response: aiResponse, audioUrl });
  } catch (error) {
    console.error("Educator API error:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}
