import path from "node:path";

export const DATA_ROOT = path.join(process.cwd(), "data");
export const usersDir = path.join(DATA_ROOT, "users");
export const conversationsDir = path.join(DATA_ROOT, "conversations");
export const usageDir = path.join(DATA_ROOT, "usage");
export const billingDir = path.join(DATA_ROOT, "billing");
export const reportsDir = path.join(DATA_ROOT, "reports");
export const nclexDir = path.join(DATA_ROOT, "nclex");
export const generatedToolHistoryDir = path.join(DATA_ROOT, "generated-tools-history");
export const communityDir = path.join(DATA_ROOT, "community");
export const generatedToolsDir = path.join(process.cwd(), "data", "generated-tools");

export const FREE_MAIA_DAILY_LIMIT = 2;
export const PRO_MAIA_DAILY_LIMIT = 20;
export const PRO_PLUS_MAIA_DAILY_LIMIT = 50;
export const MAX_MAIA_DAILY_LIMIT = 150;
export const FREE_PATHWAY_LIMIT = 1;
export const PRO_PATHWAY_LIMIT = 20;
export const PRO_PLUS_PATHWAY_LIMIT = 50;
export const MAX_PATHWAY_LIMIT = 150;
export const FREE_TOOL_LIMIT = 1;
export const PRO_TOOL_LIMIT = 5;
export const PRO_PLUS_TOOL_LIMIT = 20;
export const MAX_TOOL_LIMIT = 100;
export const FREE_FILE_LIMIT = 5;
export const PRO_FILE_LIMIT = 0;
export const PRO_PLUS_FILE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;
export const MAX_FILE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

export const PRO_MAIA_MODEL = "google/gemini-3.1-pro-preview";
export const DEFAULT_PRO_MODEL = "google/gemini-3.1-pro-preview";

export const PRO_MONTHLY_AMOUNT = 1999;
export const PRO_YEARLY_AMOUNT = 21499;
export const PRO_PLUS_MONTHLY_AMOUNT = 5999;
export const PRO_PLUS_YEARLY_AMOUNT = 59999;
export const MAX_MONTHLY_AMOUNT = 9999;
export const MAX_YEARLY_AMOUNT = 99999;

export const PRICE_TO_PLAN: Record<string, "free" | "pro" | "pro_plus" | "max"> = {
  "price_1TalCCHue6jkR6Odd4bu7GOa": "pro",
  "price_1TalCIHue6jkR6OddID87NkU": "pro",
  "price_1Tb3poHue6jkR6OdO2PYcgyy": "pro_plus",
  "price_1Tb3poHue6jkR6OdJbYi75zl": "pro_plus",
  "price_1Tb3poHue6jkR6OdOzSi5Czi": "max",
  "price_1Tb3poHue6jkR6Od53q1YJ8l": "max",
};

export const platformAdminEmails = new Set(["chad.l.lewis@endgameenhancements.com", "christian.c.lewis@endgameenhancements.com", "crusius00@gmail.com"]);

export type AuthUserRecord = { id: string; email: string; name?: string; picture?: string };
export type StoredUser = AuthUserRecord & {
  plan: "free" | "pro" | "pro_plus" | "max";
  trialStart?: number;
  trialEnd?: number;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: number;
  stripePriceId?: string;
  createdAt: string;
  updatedAt: string;
};
export type ConversationRecord = {
  id: string;
  title: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  created_at: string;
  updated_at: string;
};
