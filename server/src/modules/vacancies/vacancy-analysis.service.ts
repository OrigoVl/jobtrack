// Аналіз тексту вакансії: витяг тексту зі сторінки, розпізнавання навичок/рівня
// та обчислення "fit" (наскільки кандидат підходить) відносно профілю.
import { getProfile } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { HttpError } from "../../core/http.js";
import { assertSafeVacancyUrl, type Fit } from "../../shared/validation.js";

export function stripHtml(htmlStr: string): string {
  let s = htmlStr.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export async function fetchVacancyText(url: string): Promise<string> {
  const safeUrl = assertSafeVacancyUrl(url);
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(safeUrl, { headers: { "user-agent": "Mozilla/5.0 (JobTrack)" }, signal: ac.signal });
    if (!res.ok) throw new HttpError(502, "HTTP " + res.status);
    return stripHtml(await res.text());
  } finally {
    clearTimeout(to);
  }
}

// Груба евристика відповідності: більше збігів ніж прогалин → high, мало прогалин → med, інакше low.
export function computeFit(match: string[], gap: string[]): Fit {
  return match.length >= gap.length ? "high" : gap.length <= 2 ? "med" : "low";
}

export interface QuickAnalysis {
  techs: string[];
  level: string;
  match: string[];
  gap: string[];
  fit: Fit;
}

export async function quickAnalyze(text: string): Promise<QuickAnalysis> {
  const techs = await extractSkills(text);
  const level = extractLevel(text);
  const profile = getProfile();
  const match = techs.filter((t) => profile.skills.includes(t));
  const gap = techs.filter((t) => !profile.skills.includes(t));
  return { techs, level, match, gap, fit: computeFit(match, gap) };
}
