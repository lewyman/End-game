import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getUserById(id: string) {
  const { data } = await supabase.from("users").select("*").eq("id", id).single();
  return data;
}

export async function upsertUser(user: Record<string, any>) {
  const { data } = await supabase.from("users").upsert(user).select().single();
  return data;
}

export async function getConversations(userId: string) {
  const { data } = await supabase.from("conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  return data || [];
}

export async function upsertConversation(conv: Record<string, any>) {
  const { data } = await supabase.from("conversations").upsert(conv).select().single();
  return data;
}

export async function getDailyUsage(userId: string, date: string) {
  const { data } = await supabase.from("daily_usage").select("*").eq("user_id", userId).eq("date", date).single();
  return data;
}

export async function incrementUsage(userId: string, date: string, field: string) {
  const { data: existing } = await supabase.from("daily_usage").select("*").eq("user_id", userId).eq("date", date).single();
  if (existing) {
    const { data } = await supabase.from("daily_usage").update({ [field]: (existing[field] || 0) + 1 }).eq("id", existing.id).select().single();
    return data;
  }
  const id = `${userId}_${date}`;
  const { data } = await supabase.from("daily_usage").insert({ id, user_id: userId, date, [field]: 1 }).select().single();
  return data;
}

export async function getNclexAttempts(userId: string) {
  const { data } = await supabase.from("nclex_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);
  return data || [];
}

export async function saveNclexAttempt(attempt: Record<string, any>) {
  const { data } = await supabase.from("nclex_attempts").insert(attempt).select().single();
  return data;
}

export async function getPathways(userId: string) {
  const { data } = await supabase.from("pathways").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data || [];
}

export async function upsertPathway(pw: Record<string, any>) {
  const { data } = await supabase.from("pathways").upsert(pw).select().single();
  return data;
}

export async function getPathwayProgress(userId: string, pwId: string) {
  const { data } = await supabase.from("pathway_progress").select("*").eq("user_id", userId).eq("pathway_id", pwId).single();
  return data;
}

export async function upsertPathwayProgress(progress: Record<string, any>) {
  const { data } = await supabase.from("pathway_progress").upsert(progress).select().single();
  return data;
}

export async function getGeneratedTools() {
  const { data } = await supabase.from("generated_tools").select("*").order("created_at", { ascending: false });
  return data || [];
}

export async function upsertGeneratedTool(tool: Record<string, any>) {
  const { data } = await supabase.from("generated_tools").upsert(tool).select().single();
  return data;
}

export async function getCommunityPosts() {
  const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false });
  return data || [];
}

export async function createCommunityPost(post: Record<string, any>) {
  const { data } = await supabase.from("community_posts").insert(post).select().single();
  return data;
}

export async function getNclexBankQuestion(params: { topic?: string; difficulty?: string; excludeIds?: string[] }) {
  let q = supabase.from("nclex_questions").select("*");
  if (params.topic) q = q.ilike("topic", `%${params.topic}%`);
  if (params.difficulty && params.difficulty !== "any") q = q.eq("difficulty", params.difficulty);
  if (params.excludeIds?.length) q = q.not("id", "in", `(${params.excludeIds.join(",")})`);
  q = q.order("times_served", { ascending: true }).limit(1);
  const { data } = await q.single();
  return data;
}

export async function recordNclexServe(id: string) {
  await supabase.rpc("increment_served", { question_id: id });
}

export async function rateNclexQuestion(id: string, rating: string) {
  await supabase.rpc("rate_question", { question_id: id, rating });
}

export async function addNclexQuestions(questions: Record<string, any>[]) {
  const { data } = await supabase.from("nclex_questions").upsert(questions).select();
  return data;
}

export async function getReviews() {
  const { data } = await supabase.from("generated_tools").select("*").eq("status", "pending").order("created_at", { ascending: false });
  return data || [];
}

export async function getKnowledgeWebNodes(userId: string) {
  const { data } = await supabase.from("knowledge_web_nodes").select("*").eq("user_id", userId);
  return data || [];
}

export async function upsertKnowledgeWebNode(node: Record<string, any>) {
  const { data } = await supabase.from("knowledge_web_nodes").upsert(node).select().single();
  return data;
}

export async function saveReport(report: Record<string, any>) {
  const { data } = await supabase.from("reports").insert(report).select().single();
  return data;
}
