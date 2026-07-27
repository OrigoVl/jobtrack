// Аналіз тексту вакансії: витяг тексту зі сторінки, розпізнавання навичок/рівня
// та обчислення "fit" (наскільки кандидат підходить) відносно профілю.
import { getProfile } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { demandMap } from "../../shared/demand.js";
import { semanticSimilarity, embeddingsAvailable } from "../../llm/embeddings.js";
import { HttpError } from "../../core/http.js";
import { contextLogger } from "../../core/logger.js";
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
  /**
   * Косинусна схожість embeddings CV↔текст вакансії, [0,1] — семантичний сигнал ПОВЕРХ
   * tech-словника: ловить смислову близькість навіть без спільних tech-термінів (див.
   * llm/embeddings.ts). null — embeddings недоступні (не-OpenAI провайдер/немає ключа/CV
   * порожній) або запит до API не вдався; НЕ впливає на детермінований `fit` вище (той
   * лишається offline-тестованим і не залежить від мережі) — лише додатковий орієнтир.
   */
  semanticFit: number | null;
}

export async function quickAnalyze(text: string): Promise<QuickAnalysis> {
  const profile = getProfile();
  const [techs, semanticFit] = await Promise.all([
    extractSkills(text),
    embeddingsAvailable() && profile.cvText ? semanticSimilarity(text, profile.cvText) : Promise.resolve(null),
  ]);
  const level = extractLevel(text);
  const match = techs.filter((t) => profile.skills.includes(t));
  const gap = techs.filter((t) => !profile.skills.includes(t));
  // Мапа попиту (частота навички серед уже доданих вакансій) зважує fit: пропустити типову,
  // часто-запитувану навичку гірше за пропуск нішевої — див. computeFit() у vacancy-text.ts.
  return { techs, level, match, gap, fit: computeFit(match, gap, demandMap()), semanticFit };
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
  } catch (e) {
    // "debug", не "warn": заблокований SSRF-хост — очікуваний, нормальний результат
    // (юзер міг вставити внутрішнє/тестове посилання), не привід шуміти в логах помилками.
    contextLogger().debug({ url, reason: (e as Error).message }, "Auto-enrich skipped: URL blocked by SSRF guard");
    return null;
  }
  try {
    const text = await fetchVacancyText(url);
    if (text.length < 200) {
      // Найчастіша причина "стек не підтягнувся" з боку юзера: сторінка захищена від скрапінгу
      // (JS-рендер, login wall, anti-bot) — без цього логу довелось би відгадувати причину.
      contextLogger().warn({ url, textLength: text.length }, "Auto-enrich skipped: fetched page text too short/empty");
      return null;
    }
    return await quickAnalyze(text);
  } catch (e) {
    contextLogger().warn({ url, err: e }, "Auto-enrich failed: could not fetch or analyze vacancy URL");
    return null;
  }
}
