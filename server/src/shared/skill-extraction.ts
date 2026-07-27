import { extractTechs } from "./tech-dict.js";
import { chat, llmAvailable } from "../llm/index.js";
import { getKvJson, setKvJson } from "../db/index.js";
import { hashString } from "./hash.js";

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
  const out = await chat(
    "Ти асистент з добору персоналу. Витягуєш ключові професійні навички, інструменти та технології з тексту будь-якої галузі. Відповідай ЛИШЕ валідним JSON.",
    `Текст (вакансія або резюме):\n${text.slice(0, 4000)}\n\n` +
      `Поверни JSON: {"skills":["8-15 нормалізованих коротких назв навичок/інструментів/технологій"]}`,
    { json: true, maxTokens: 400, temperature: 0.2 },
  );
  const ai: string[] = Array.isArray(out?.skills)
    ? out.skills
        .filter((s: unknown): s is string => typeof s === "string")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];
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
  const out = await chat(
    "Ти визначаєш професію кандидата за резюме. Відповідай ЛИШЕ валідним JSON українською.",
    `Резюме:\n${cvText.slice(0, 3000)}\n\n` +
      `Поверни JSON: {"domain":"коротка назва ролі, напр.: Frontend-розробник, UX-дизайнер, Бухгалтер, Маркетолог, Data Analyst"}`,
    { json: true, maxTokens: 60, temperature: 0.2 },
  );
  const domain = typeof out?.domain === "string" ? out.domain.trim().slice(0, 80) : "";
  if (domain) setKvJson(cacheKey, { domain });
  return domain;
}
