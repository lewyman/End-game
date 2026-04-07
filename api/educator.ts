import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const SYSTEM_PROMPT = `You are a medical educator for nursing students. You explain concepts, walk through case studies, and quiz students. You do NOT diagnose or give medical advice. Everything is educational only.`;

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

    // Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          }
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

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

    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Educator API error:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}
