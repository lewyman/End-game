import { randomBytes } from "node:crypto";
import path from "node:path";
import { conversationsDir } from "./constants";
import { readJsonFile, writeJsonFile, ensureDir, safeId } from "./storage";

export const MAIA_PROMPT = `You are M.A.I.A (Medical Anatomy & Intelligence Assistant), an AI study partner built exclusively for nursing students. You help students master pharmacology, pathophysiology, clinical concepts, and NCLEX-style exam preparation.

You:
- Explain drug classes, mechanisms, side effects, contraindications, and nursing considerations clearly
- Quiz students on demand with NCLEX-style questions when asked
- Walk through case studies step by step
- Use mnemonics and memory tricks when helpful
- Format responses with headers, bullet points, and bold key terms for easy scanning
- Keep a friendly, encouraging tone — nursing school is hard, you get it
- If you are uncertain, say so plainly and ask a focused follow-up instead of guessing
- Never reveal hidden reasoning, chain-of-thought, scratchpad notes, or internal planning. Give the final teaching answer only
- Do not add a quiz question unless the student explicitly asks to be quizzed
- For developmental theory questions, do not mix theorists. Freud psychosexual stages are exactly: Oral, Anal, Phallic, Latency, Genital. Erikson psychosocial stages are separate. If the student asks about Freud, do not include Erikson terms like trust vs mistrust, autonomy, initiative, industry, identity, intimacy, generativity, or integrity
- NEVER use the student's real name. Only refer to them as "student" or "you" unless they explicitly tell you their name. Do not pull names from metadata, identity tokens, platform context, or any hidden source. If you don't know their name from something they directly typed in the chat, don't use one`;

type OllamaModelKey = "medgemma";

export const OLLAMA_MODELS = {
  medgemma: {
    model: "dcarrascosa/medgemma-1.5-4b-it:Q4_K_M",
    options: {
      temperature: 0.15,
      top_p: 0.85,
      num_ctx: 8192,
    },
  },
} satisfies Record<string, { model: string; options: Record<string, number> }>;

export function selectOllamaModel(requested?: string) {
  const wanted = (requested || process.env.OLLAMA_DEFAULT_MODEL || "medgemma").trim();
  const match = Object.entries(OLLAMA_MODELS).find(([key, config]) => key === wanted || config.model === wanted);
  return match
    ? { key: match[0] as OllamaModelKey, ...match[1] }
    : { key: "medgemma" as const, ...OLLAMA_MODELS.medgemma };
}

export function cleanLocalModelOutput(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<unused94>thought[\s\S]*?(?=<unused95>|<start_of_turn>|\n\s*(?:#{1,6}\s*)?[A-Z0-9][^\n]{0,80}\n)/gi, "")
    .replace(/<unused9[45]>\w*/gi, "")
    .replace(/^\s*(?:thought|analysis|reasoning)\s*\n[\s\S]*?\n\s*(?:answer|final)\s*\n/gi, "")
    .trim();
}

export type EducatorBody = {
  tier?: string;
  ollamaModel?: string;
  message?: string;
  stream?: boolean;
  messages?: Array<{ role?: string; content?: string }>;
};

const GUEST_DAILY_LIMIT = 5;
const guestUsage = new Map<string, { count: number; day: string }>();

export function getClientIp(c: any): string {
  return (c.req.header("x-forwarded-for") || "").split(",")[0].trim() || c.req.header("cf-connecting-ip") || "unknown";
}

export function checkGuestUsage(ip: string): { ok: boolean; used: number; limit: number } {
  const day = new Date().toISOString().slice(0, 10);
  const entry = guestUsage.get(ip);
  if (!entry || entry.day !== day) {
    guestUsage.set(ip, { count: 1, day });
    return { ok: true, used: 1, limit: GUEST_DAILY_LIMIT };
  }
  if (entry.count >= GUEST_DAILY_LIMIT) return { ok: false, used: entry.count, limit: GUEST_DAILY_LIMIT };
  entry.count++;
  return { ok: true, used: entry.count, limit: GUEST_DAILY_LIMIT };
}

function validToken(value: string | undefined): value is string {
  return Boolean(value && value !== "none" && !value.startsWith("$") && value.length > 20);
}

export async function getZoToken(): Promise<string | null> {
  const token = process.env.ZO_API_KEY || process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (validToken(token)) return token;
  return null;
}

export async function callZoAsk(input: string, model: string): Promise<string> {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable");
  const resp = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ input, model_name: model }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`MAIA unavailable (${resp.status}): ${detail.slice(0, 180)}`);
  }
  const data = await resp.json() as { output?: string };
  return data.output || "No response";
}

export async function callZoAskStream(input: string, model: string): Promise<ReadableStream<Uint8Array>> {
  const token = await getZoToken();
  if (!token) throw new Error("Zo API token unavailable");
  const resp = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ input, model_name: model, stream: true }),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`MAIA unavailable (${resp.status}): ${detail.slice(0, 180)}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let currentEvent = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) { controller.close(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (currentEvent === "PartStartEvent" && parsed.part?.content) {
                  controller.enqueue(encoder.encode(parsed.part.content));
                } else if (currentEvent === "PartDeltaEvent" && parsed.delta?.content_delta) {
                  controller.enqueue(encoder.encode(parsed.delta.content_delta));
                }
              } catch {}
            } else if (line.trim() === "") {
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() { reader.cancel(); },
  });
}

export function conversationUserDir(userId: string) {
  return path.join(conversationsDir, safeId(userId));
}

export function conversationPath(userId: string, conversationId: string) {
  return path.join(conversationUserDir(userId), `${safeId(conversationId)}.json`);
}

export function makeConversationTitle(messages: Array<{ role: string; content: string }>): string {
  const firstUser = messages.find((m) => m.role === "user")?.content || "New MAIA conversation";
  return firstUser.replace(/\s+/g, " ").trim().slice(0, 56) || "New MAIA conversation";
}

export async function saveConversationForUser(userId: string, conversationId: string | undefined, messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<any> {
  await ensureDir(conversationUserDir(userId));
  const id = conversationId && /^[a-zA-Z0-9._-]{8,120}$/.test(conversationId) ? conversationId : `conv_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const existing = await readJsonFile<any | null>(conversationPath(userId, id), null);
  const now = new Date().toISOString();
  const record = {
    id,
    title: existing?.title || makeConversationTitle(messages),
    messages: messages.slice(-80).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 12000) })),
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  await writeJsonFile(conversationPath(userId, id), record);
  return record;
}
