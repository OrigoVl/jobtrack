import { z } from "zod";
import { kbFor, type Resource } from "./knowledge-base.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { getKvJson, setKvJson, type Profile } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import { hashString } from "../../shared/hash.js";

// focus.nullable().catch(null) (not .catch("")) — DynamicKnowledge.focus is typed as
// `string | null` below: null means "the model gave nothing personal", as opposed to an
// empty string (had something to say, but said "nothing") — the same distinction as the
// old manual check `typeof out?.focus === "string" ? out.focus : null`.
const DynamicKnowledgeSchema = z.object({
  focus: z.string().nullable().catch(null),
  learn: z.array(z.string()),
  resources: z
    .array(z.object({ t: z.string(), u: z.string() }))
    .catch([])
    .default([]),
});

// Dynamic knowledge base: the LLM generates a PERSONAL learning focus for the specific
// candidate (accounting for their existing skills from the CV and vacancy demand). Cached in
// the DB. If the LLM is unavailable — a transparent fallback to the static knowledge-base.ts.
function hashSkills(skills: string[]): string {
  return hashString([...skills].sort((a, b) => a.localeCompare(b)).join(","));
}

// Checks that a link is "alive" (so the LLM can't slip in a broken/made-up URL).
// SSRF safety: https only, no localhost/private hosts.
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

// Validate AI-suggested links in parallel and keep only the live ones, deduped against the curated set.
async function validateResources(curated: Resource[], aiResources: { t: string; u: string }[]): Promise<Resource[]> {
  const curatedUrls = new Set(curated.map((r) => r.u));
  const candidates = aiResources.filter((r) => !curatedUrls.has(r.u)).slice(0, 4);
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

/** Returns learning content for a technology, personalized for the candidate. */
export async function getDynamicKnowledge(
  userId: UserId,
  tech: string,
  { profile, demand }: DynamicKnowledgeContext,
): Promise<DynamicKnowledge> {
  const base = kbFor(tech);
  const shared = { tech, drills: base.drills, cards: base.cards };
  if (!llmAvailable()) {
    return { ...shared, focus: null, learn: base.learn, resources: base.resources, source: "static" };
  }
  const skills = profile.skills || [];
  // Unlike the 4 caches in db/llm-cache.ts (deliberately global, safe only because they're
  // keyed on a hash of the FULL input text), this one is keyed on a hash of a DERIVED attribute
  // (the candidate's sorted skill set) — an existence-oracle risk if it were shared across
  // tenants. It isn't: getKvJson/setKvJson below write to the per-user `user_kv` table (real
  // `(user_id, k)` primary key), so this cache is already fully isolated per user regardless of
  // the hash algorithm.
  const cacheKey = `kb:${tech}:${hashSkills(skills)}`;
  const cached = await getKvJson<CachedKnowledgePayload>(userId, cacheKey);
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
  const role = profile.domain || "professional";
  const out = await chatJson(
    userId,
    `You are a mentor for the role "${role}". Respond with ONLY valid JSON in English.`,
    `The candidate already knows: ${skills.join(", ") || "—"}.\n` +
      `They need to pick up "${tech}"${count ? ` (required in ${count} vacancies from the list)` : ""}.\n` +
      `Build bridges from their familiar stack to the new one; don't duplicate what they already know.\n` +
      `Return JSON strictly in this format (no markdown):\n` +
      `{"focus":"1-2 sentences of personal advice specifically for this candidate",` +
      `"learn":["5-7 concrete topics from easy to advanced, interview-oriented"],` +
      `"resources":[{"t":"name","u":"https URL of official docs or a well-known tutorial"}]}`,
    DynamicKnowledgeSchema,
    { maxTokens: 650, temperature: 0.4, tier: "smart" },
  );
  if (!out || out.learn.length === 0) {
    return { ...shared, focus: out?.focus ?? null, learn: base.learn, resources: base.resources, source: "static" };
  }
  const resources = await validateResources(base.resources, out.resources);
  const payload: CachedKnowledgePayload = { focus: out.focus, learn: out.learn, resources };
  await setKvJson(userId, cacheKey, payload);
  return { ...shared, focus: payload.focus, learn: payload.learn, resources: payload.resources, source: "ai" };
}
