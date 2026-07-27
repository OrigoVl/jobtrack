import { kbFor, type Resource } from "./knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { getKvJson, setKvJson, type Profile } from "../../db/index.js";
import { hashString } from "../../shared/hash.js";

// Динамічна база знань: LLM генерує ПЕРСОНАЛЬНИЙ навчальний фокус під конкретного
// кандидата (враховуючи його наявні навички з CV і попит вакансій). Кешується в БД.
// Якщо LLM недоступний — прозорий fallback на статичну knowledge-base.ts.
function hashSkills(skills: string[]): string {
  return hashString([...skills].sort((a, b) => a.localeCompare(b)).join(","));
}

// Перевірка «живості» посилання (щоб LLM не підсунув битий/вигаданий URL).
// SSRF-безпека: лише https, без localhost/приватних хостів.
async function isReachableUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|::1)/.test(host) || !host.includes(".")) return false;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (JobTrack)" },
      signal: ac.signal,
    });
    return res.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(to);
  }
}

interface AiResource {
  t?: unknown;
  u?: unknown;
}

// Валідуємо AI-посилання паралельно й лишаємо тільки живі, дедуплікуючи з курованими.
async function validateResources(curated: Resource[], aiResources: AiResource[]): Promise<Resource[]> {
  const curatedUrls = new Set(curated.map((r) => r.u));
  const candidates = aiResources
    .filter((r): r is { t: string; u: string } => !!r && typeof r.u === "string" && typeof r.t === "string" && !curatedUrls.has(r.u))
    .slice(0, 4);
  const checks = await Promise.all(candidates.map((r) => isReachableUrl(r.u)));
  const valid: Resource[] = candidates.filter((_, i) => checks[i]).map((r) => ({ t: r.t, u: r.u, ai: true }));
  return [...curated, ...valid];
}

export interface DynamicKnowledge {
  tech: string;
  drills: { q: string; lvl: string }[];
  cards: { q: string }[];
  focus: string | null;
  learn: string[];
  resources: Resource[];
  source: "static" | "ai";
  cached?: boolean;
}

interface DynamicKnowledgeContext {
  profile: Pick<Profile, "skills" | "domain">;
  demand: Record<string, number>;
}

interface CachedKnowledgePayload {
  focus: string | null;
  learn: string[];
  resources: Resource[];
}

/** Повертає навчальний контент для технології, персоналізований під кандидата. */
export async function getDynamicKnowledge(tech: string, { profile, demand }: DynamicKnowledgeContext): Promise<DynamicKnowledge> {
  const base = kbFor(tech);
  const shared = { tech, drills: base.drills, cards: base.cards };
  if (!llmAvailable()) {
    return { ...shared, focus: null, learn: base.learn, resources: base.resources, source: "static" };
  }
  const skills = profile.skills || [];
  const cacheKey = `kb:${tech}:${hashSkills(skills)}`;
  const cached = getKvJson<CachedKnowledgePayload>(cacheKey);
  if (cached) {
    return {
      ...shared,
      focus: cached.focus,
      learn: cached.learn,
      resources: cached.resources || base.resources,
      source: "ai",
      cached: true,
    };
  }
  const count = demand[tech] || 0;
  const role = profile.domain || "фахівець";
  const out = await chat(
    `Ти ментор для ролі «${role}». Відповідай ЛИШЕ валідним JSON українською.`,
    `Кандидат уже знає: ${skills.join(", ") || "—"}.\n` +
      `Йому треба підтягнути «${tech}»${count ? ` (потрібно у ${count} вакансіях зі списку)` : ""}.\n` +
      `Наводь мости від знайомого стеку до нового; не дублюй те, що він уже знає.\n` +
      `Поверни JSON строго такого формату (без markdown):\n` +
      `{"focus":"1-2 речення персональної поради саме для цього кандидата",` +
      `"learn":["5-7 конкретних тем від простого до складного, орієнтованих на співбесіду"],` +
      `"resources":[{"t":"назва","u":"https-URL офіційної документації або відомого туторіалу"}]}`,
    { json: true, maxTokens: 650, temperature: 0.4, tier: "smart" },
  );
  if (!out || !Array.isArray(out.learn) || out.learn.length === 0) {
    return {
      ...shared,
      focus: typeof out?.focus === "string" ? out.focus : null,
      learn: base.learn,
      resources: base.resources,
      source: "static",
    };
  }
  const aiResources: AiResource[] = Array.isArray(out.resources) ? out.resources : [];
  const resources = await validateResources(base.resources, aiResources);
  const payload: CachedKnowledgePayload = {
    focus: typeof out.focus === "string" ? out.focus : null,
    learn: out.learn.filter((x: unknown): x is string => typeof x === "string"),
    resources,
  };
  setKvJson(cacheKey, payload);
  return { ...shared, focus: payload.focus, learn: payload.learn, resources: payload.resources, source: "ai" };
}
