// Аналіз тексту вакансії: витяг тексту зі сторінки, розпізнавання навичок/рівня
// та обчислення "fit" (наскільки кандидат підходить) відносно профілю.
import { getProfile } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { HttpError } from "../../core/http.js";
import { assertSafeVacancyUrl, type Fit } from "../../shared/validation.js";
import { computeFit, stripHtml } from "./vacancy-text.js";

export { computeFit, stripHtml };

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

/**
 * Best-effort автозбагачення стеку/рівня/fit за посиланням на вакансію (з будь-якого публічного
 * https-джерела — LinkedIn, Djinni, robota.ua, jobs.dou.ua тощо, див. assertSafeVacancyUrl) —
 * на відміну від fetchVacancyText/quickAnalyze НІКОЛИ не кидає: заблокований SSRF-захистом
 * хост (локальний/внутрішній), мережева помилка, таймаут чи порожня сторінка просто повертають
 * null, щоб виклик (створення/оновлення вакансії, імпорт) міг безпечно продовжити основну
 * операцію навіть якщо автозбагачення не вдалося.
 */
export async function tryAutoEnrichStack(url: string): Promise<QuickAnalysis | null> {
  if (!url) return null;
  try {
    assertSafeVacancyUrl(url);
  } catch {
    return null;
  }
  try {
    const text = await fetchVacancyText(url);
    if (text.length < 200) return null;
    return await quickAnalyze(text);
  } catch {
    return null;
  }
}
