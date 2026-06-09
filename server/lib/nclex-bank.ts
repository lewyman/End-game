import path from "node:path";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const BANK_DIR = path.join(process.cwd(), "data", "nclex-bank");
const INDEX_PATH = path.join(BANK_DIR, "index.json");
const RATINGS_PATH = path.join(BANK_DIR, "ratings.json");

interface NclexQuestion {
  id: string;
  category: string;
  type: "mcq" | "sata";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  categories: string[];
  bodySystems: string[];
  stem: string;
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  rationale: string;
  optionRationales: Record<string, string>;
  quality: number;
  timesServed: number;
  timesRatedUp: number;
  timesRatedDown: number;
  generatedAt: string;
  lastServedAt: string;
}

interface BankIndex {
  totalQuestions: number;
  categories: Record<string, { count: number; file: string }>;
  lastGenerated: string;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function getBankIndex(): Promise<BankIndex> {
  return readJson<BankIndex>(INDEX_PATH, { totalQuestions: 0, categories: {}, lastGenerated: "" });
}

export async function updateBankIndex(index: BankIndex) {
  await writeJson(INDEX_PATH, index);
}

export async function getQuestion(options: {
  topic?: string;
  difficulty?: string;
  excludeIds?: string[];
}): Promise<NclexQuestion | null> {
  const index = await getBankIndex();
  if (index.totalQuestions === 0) return null;

  const excludeSet = new Set(options.excludeIds || []);
  const categories = options.topic
    ? Object.entries(index.categories).filter(([cat, info]) => {
        if (options.topic === "comprehensive" || options.topic === "mixed") return true;
        return cat.toLowerCase().includes(options.topic!.toLowerCase());
      })
    : Object.entries(index.categories);

  if (categories.length === 0) return null;

  // Pick random category, load its file
  const [cat, info] = categories[Math.floor(Math.random() * categories.length)];
  const questions: NclexQuestion[] = await readJson<NclexQuestion[]>(
    path.join(BANK_DIR, info.file), []
  );

  // Filter by difficulty and exclude
  let pool = questions.filter(q => !excludeSet.has(q.id));
  if (options.difficulty && options.difficulty !== "any") {
    const diffPool = pool.filter(q => q.difficulty === options.difficulty);
    if (diffPool.length > 0) pool = diffPool;
  }

  if (pool.length === 0) return null;

  // Sort by least served first
  pool.sort((a, b) => a.timesServed - b.timesServed);

  return pool[0];
}

export async function recordServe(questionId: string) {
  const index = await getBankIndex();
  for (const [cat, info] of Object.entries(index.categories)) {
    const filePath = path.join(BANK_DIR, info.file);
    const questions: NclexQuestion[] = await readJson<NclexQuestion[]>(filePath, []);
    const idx = questions.findIndex(q => q.id === questionId);
    if (idx >= 0) {
      questions[idx].timesServed = (questions[idx].timesServed || 0) + 1;
      questions[idx].lastServedAt = new Date().toISOString();
      await writeJson(filePath, questions);
      return;
    }
  }
}

export async function rateQuestion(questionId: string, rating: "up" | "down") {
  const ratings = await readJson<Record<string, { up: number; down: number }>>(RATINGS_PATH, {});
  const entry = ratings[questionId] || { up: 0, down: 0 };
  if (rating === "up") entry.up++;
  else entry.down++;

  const total = entry.up + entry.down;
  const quality = total > 0 ? entry.up / total : 0.5;
  ratings[questionId] = entry;
  await writeJson(RATINGS_PATH, ratings);

  // Update quality in the bank file
  const index = await getBankIndex();
  for (const [cat, info] of Object.entries(index.categories)) {
    const filePath = path.join(BANK_DIR, info.file);
    const questions: NclexQuestion[] = await readJson<NclexQuestion[]>(filePath, []);
    const idx = questions.findIndex(q => q.id === questionId);
    if (idx >= 0) {
      questions[idx].quality = quality;
      questions[idx].timesRatedUp = entry.up;
      questions[idx].timesRatedDown = entry.down;
      await writeJson(filePath, questions);
      return;
    }
  }
}

export async function addQuestions(category: string, questions: NclexQuestion[]) {
  await ensureDir(BANK_DIR);

  const safe = category.replace(/[^a-z0-9-]/g, "-").slice(0, 60);
  const fileName = `${safe}.json`;
  const filePath = path.join(BANK_DIR, fileName);

  let existing: NclexQuestion[] = await readJson<NclexQuestion[]>(filePath, []);
  const existingIds = new Set(existing.map(q => q.id));
  const newQuestions = questions.filter(q => !existingIds.has(q.id));
  existing = [...existing, ...newQuestions];

  await writeJson(filePath, existing);

  const index = await getBankIndex();
  index.categories[category] = { count: existing.length, file: fileName };
  index.totalQuestions = Object.values(index.categories).reduce((sum, c) => sum + c.count, 0);
  index.lastGenerated = new Date().toISOString();
  await updateBankIndex(index);

  return { added: newQuestions.length, total: index.totalQuestions };
}

export async function getBankStats() {
  const index = await getBankIndex();
  return {
    totalQuestions: index.totalQuestions,
    categories: Object.entries(index.categories).map(([cat, info]) => ({
      category: cat, count: info.count
    })),
    lastGenerated: index.lastGenerated,
  };
}
