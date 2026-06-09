import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export function safeId(value: string): string {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "unknown";
}

export async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function readEnv(name: string): Promise<string | undefined> {
  const direct = process.env[name];
  if (direct) return direct;
  return undefined;
}

export { path, randomBytes };
