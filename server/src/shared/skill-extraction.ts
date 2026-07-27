import { z } from "zod";
import { extractTechs } from "./tech-dict.js";
import { chatJson, llmAvailable } from "../llm/index.js";
import { getKvJson, setKvJson } from "../db/index.js";
import { hashString } from "./hash.js";

const SkillsSchema = z.object({ skills: z.array(z.string()) });
const DomainSchema = z.object({ domain: z.string().catch("") });

// Універсальна екстракція навичок і детекція професії.
// Працює для БУДЬ-ЯКОЇ галузі через LLM; офлайн — fallback на словник технологій (IT).
// Кешується за хешем тексту, щоб не платити двічі за те саме резюме/вакансію.
// Спільна для модулів vacancies і cv — тому лежить у shared/, а не в одному з них.

function dedupe(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
}

/** Витягує ключові навички/інструменти з тексту вакансії або CV. */
export async function extractSkills(text: string): Promise<string[]> {
  const regex = extractTechs(text).map((t) => t.name);
  if (!llmAvailable() || !text || text.trim().length < 30) return regex;
  const cacheKey = `skx:${hashString(text)}`;
  const cached = getKvJson<{ skills: string[] }>(cacheKey);
  if (cached) return cached.skills;
  const out = await chatJson(
    "Ти асистент з добору персоналу. Витягуєш ключові професійні навички, інструменти та технології з тексту будь-якої галузі. Відповідай ЛИШЕ валідним JSON.",
    `Текст (вакансія або резюме):\n${text.slice(0, 4000)}\n\n` +
      `Поверни JSON: {"skills":["8-15 нормалізованих коротких назв навичок/інструментів/технологій"]}`,
    SkillsSchema,
    { maxTokens: 400, temperature: 0.2 },
  );
  const ai: string[] = (out?.skills ?? []).map((s) => s.trim()).filter(Boolean);
  if (!ai.length) return regex;
  const skills = dedupe([...regex, ...ai]).slice(0, 25);
  setKvJson(cacheKey, { skills });
  return skills;
}

/** Визначає професію/роль кандидата за резюме (для персоналізації промптів). */
export async function detectDomain(cvText: string): Promise<string> {
  if (!llmAvailable() || !cvText || cvText.trim().length < 30) return "";
  const cacheKey = `domain:${hashString(cvText)}`;
  const cached = getKvJson<{ domain: string }>(cacheKey);
  if (cached) return cached.domain;
  const out = await chatJson(
    "Ти визначаєш професію кандидата за резюме. Відповідай ЛИШЕ валідним JSON українською.",
    `Резюме:\n${cvText.slice(0, 3000)}\n\n` +
      `Поверни JSON: {"domain":"коротка назва ролі, напр.: Frontend-розробник, UX-дизайнер, Бухгалтер, Маркетолог, Data Analyst"}`,
    DomainSchema,
    { maxTokens: 60, temperature: 0.2 },
  );
  const domain = (out?.domain ?? "").trim().slice(0, 80);
  if (domain) setKvJson(cacheKey, { domain });
  return domain;
}
