import { z } from "zod";
import { extractTechs } from "./tech-dict.js";
import { chatJson, llmAvailable } from "../llm/index.js";
import { getKvJson, setKvJson } from "../db/index.js";
import type { UserId } from "../db/user-id.js";
import { hashString } from "./hash.js";

const SkillsSchema = z.object({ skills: z.array(z.string()) });
const DomainSchema = z.object({ domain: z.string().catch("") });

// Universal skill extraction and profession detection.
// Works for ANY industry via the LLM; offline — falls back to the tech dictionary (IT).
// Cached by the text's hash, so we don't pay twice for the same CV/vacancy.
// Shared between the vacancies and cv modules — hence it lives in shared/, not in either one.

function dedupe(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
}

/** Extracts key skills/tools from vacancy or CV text. */
export async function extractSkills(userId: UserId, text: string): Promise<string[]> {
  const regex = extractTechs(text).map((t) => t.name);
  if (!llmAvailable() || !text || text.trim().length < 30) return regex;
  // Deliberately NOT scoped by userId yet — see the same note in llm/client.ts's chat(): one of
  // the 5 known cross-tenant-leak-risk caches, fixed in phase 4.
  const cacheKey = `skx:${hashString(text)}`;
  const cached = await getKvJson<{ skills: string[] }>(userId, cacheKey);
  if (cached) return cached.skills;
  const out = await chatJson(
    userId,
    "You are a recruiting assistant. You extract key professional skills, tools, and technologies from text in any industry. Respond ONLY with valid JSON.",
    `Text (vacancy or CV):\n${text.slice(0, 4000)}\n\n` +
      `Return JSON: {"skills":["8-15 normalized short names of skills/tools/technologies"]}`,
    SkillsSchema,
    { maxTokens: 400, temperature: 0.2 },
  );
  const ai: string[] = (out?.skills ?? []).map((s) => s.trim()).filter(Boolean);
  if (!ai.length) return regex;
  const skills = dedupe([...regex, ...ai]).slice(0, 25);
  await setKvJson(userId, cacheKey, { skills });
  return skills;
}

/** Determines the candidate's profession/role from their CV (for personalizing prompts). */
export async function detectDomain(userId: UserId, cvText: string): Promise<string> {
  if (!llmAvailable() || !cvText || cvText.trim().length < 30) return "";
  // Deliberately NOT scoped by userId yet — same note as extractSkills() above.
  const cacheKey = `domain:${hashString(cvText)}`;
  const cached = await getKvJson<{ domain: string }>(userId, cacheKey);
  if (cached) return cached.domain;
  const out = await chatJson(
    userId,
    "You determine a candidate's profession from their CV. Respond ONLY with valid JSON in English.",
    `CV:\n${cvText.slice(0, 3000)}\n\n` +
      `Return JSON: {"domain":"short role name, e.g.: Frontend Developer, UX Designer, Accountant, Marketer, Data Analyst"}`,
    DomainSchema,
    { maxTokens: 60, temperature: 0.2 },
  );
  const domain = (out?.domain ?? "").trim().slice(0, 80);
  if (domain) await setKvJson(userId, cacheKey, { domain });
  return domain;
}
