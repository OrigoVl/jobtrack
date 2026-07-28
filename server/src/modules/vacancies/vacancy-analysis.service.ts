// Vacancy text analysis: extracting text from the page, detecting skills/level,
// and computing "fit" (how well the candidate matches) against the profile.
import { getProfile } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { demandMap } from "../../shared/demand.js";
import { HttpError } from "../../core/http.js";
import { contextLogger } from "../../core/logger.js";
import { assertSafeVacancyUrl, type Fit } from "../../shared/validation.js";
import { computeFit, stripHtml } from "./vacancy-text.js";

// Re-export only computeFit — vacancies.routes.ts deliberately imports it from here (not
// directly from vacancy-text.js) so routes don't get yet another import path. stripHtml is only
// used inside this file (fetchVacancyText below) — other places import it directly from
// vacancy-text.js (see vacancy-text.test.ts), so re-exporting it here would be redundant.
export { computeFit };

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

// Does NOT compute semanticFit (embeddings similarity between CV and vacancy, see
// llm/embeddings.ts) — quickAnalyze() is called from tryAutoEnrichStack() below for BACKGROUND
// auto-enrichment (creating/editing a vacancy from a URL, single/bulk re-parse, DOU/JSON import),
// where only techs/level/fit are used (semanticFit is never read or stored in the DB there —
// computing it here would mean paying for an embeddings call on EVERY auto-enrichment for a
// value that gets discarded immediately). semanticFit is computed SEPARATELY, only in the
// interactive POST /vacancies/analyze (vacancies.routes.ts), where the result is shown to the
// user right away in the analyzer (client/src/features/analyzer).
export async function quickAnalyze(text: string): Promise<QuickAnalysis> {
  const profile = getProfile();
  const techs = await extractSkills(text);
  const level = extractLevel(text);
  const match = techs.filter((t) => profile.skills.includes(t));
  const gap = techs.filter((t) => !profile.skills.includes(t));
  // The demand map (skill frequency among already-added vacancies) weighs fit: missing a
  // common, frequently-requested skill is worse than missing a niche one — see computeFit() in vacancy-text.ts.
  return { techs, level, match, gap, fit: computeFit(match, gap, demandMap()) };
}

/**
 * Best-effort auto-enrichment of stack/level/fit from a vacancy link (from any public https
 * source — LinkedIn, Djinni, robota.ua, jobs.dou.ua, etc., see assertSafeVacancyUrl) — unlike
 * fetchVacancyText/quickAnalyze it NEVER throws: a host blocked by SSRF protection (local/
 * internal), a network error, a timeout, or an empty page just return null, so the caller
 * (creating/updating a vacancy, import) can safely continue its main operation even if
 * auto-enrichment failed.
 */
export async function tryAutoEnrichStack(url: string): Promise<QuickAnalysis | null> {
  if (!url) return null;
  try {
    assertSafeVacancyUrl(url);
  } catch (e) {
    // "debug", not "warn": a blocked SSRF host is an expected, normal outcome
    // (the user may have pasted an internal/test link), not a reason to make noise in the error logs.
    contextLogger().debug({ url, reason: (e as Error).message }, "Auto-enrich skipped: URL blocked by SSRF guard");
    return null;
  }
  try {
    const text = await fetchVacancyText(url);
    if (text.length < 200) {
      // The most common user-facing cause of "the stack didn't fill in": the page is protected
      // against scraping (JS rendering, login wall, anti-bot) — without this log we'd have to guess why.
      contextLogger().warn({ url, textLength: text.length }, "Auto-enrich skipped: fetched page text too short/empty");
      return null;
    }
    return await quickAnalyze(text);
  } catch (e) {
    contextLogger().warn({ url, err: e }, "Auto-enrich failed: could not fetch or analyze vacancy URL");
    return null;
  }
}
