// Adapting a structured CV (the builder's CvDoc) to one specific vacancy — combines the existing
// LLM gap analysis (matchCv, cv-analysis.service.ts) with a deterministic, offline-safe
// REORDERING of the candidate's OWN skills/experience bullets by relevance to that vacancy.
// Deliberately conservative: nothing is invented — every skill and every bullet in the result
// already existed in the original doc, only their ORDER changes (front-load what's relevant),
// plus (only when the LLM actually produced one) the summary is swapped for matchCv's
// tailoredSummary. This is what lets the feature work fully offline too: matchCv's own offline
// heuristic never fills tailoredSummary (see heuristicMatch), so the summary just stays as-is —
// the skill/bullet reordering (a real "algorithm", not an LLM guess) is the only thing that
// changes for offline users.
import { extractTechs } from "../../shared/tech-dict.js";
import type { UserId } from "../../db/user-id.js";
import { matchCv, type CvMatch } from "./cv-analysis.service.js";
import type { CvDoc } from "./cv.schemas.js";

export interface CvTailorResult {
  doc: CvDoc;
  match: CvMatch & { offline: boolean };
  reordered: { skills: number; bullets: number };
}

/** Flattens a structured CV doc into plain text for matchCv's prompt — a minimal, server-side
 * counterpart to the client's cvDocToText() (builder/cv-doc-utils.ts): only what the LLM
 * actually needs (name/title/summary/skills/experience bullets), not full section formatting. */
function flattenCvDoc(doc: CvDoc): string {
  const parts = [doc.name, doc.title, doc.summary, doc.skills.join(", ")];
  doc.experience.forEach((e) => {
    parts.push(`${e.role} — ${e.company} (${e.period})`);
    parts.push(...e.bullets);
  });
  parts.push(
    ...doc.education.map((e) => [e.degree, e.school, e.period].filter(Boolean).join(", ")),
    ...doc.projects.map((p) => [p.title, p.description].filter(Boolean).join(" — ")),
  );
  return parts.filter(Boolean).join("\n");
}

/** A skill is relevant to the vacancy either via the tech dictionary's alias-aware regexes
 * (`relevantTechs` — e.g. the vacancy says "JS" and the candidate has "JavaScript") or a plain
 * case-insensitive substring (covers skills outside the dictionary the candidate typed
 * themselves, e.g. "Figma", "Salesforce", "Scrum"). */
function isSkillRelevant(skill: string, textLower: string, relevantTechs: Set<string>): boolean {
  if (relevantTechs.has(skill)) return true;
  const s = skill.toLowerCase().trim();
  return s.length > 2 && textLower.includes(s);
}

/** A bullet is relevant if it names a technology the vacancy also asks for — via the tech
 * dictionary on the bullet's own text, so "Migrated CI to Docker" only counts for a vacancy
 * that actually mentions Docker/containers, not for every vacancy regardless of content. */
function bulletRelevant(bulletText: string, relevantTechs: Set<string>): boolean {
  if (!relevantTechs.size) return false;
  return extractTechs(bulletText).some((t) => relevantTechs.has(t.name));
}

/** Stable partition: everything relevant to the vacancy first (original relative order
 * preserved among themselves), then the rest (same) — deterministic and easy to reason about,
 * unlike a full relevance-score sort which could reshuffle equally-relevant items unpredictably.
 * `moved` is 0 when the partition didn't actually change anything (nothing relevant, or
 * everything is). */
function frontLoad<T>(items: T[], isRelevant: (item: T) => boolean): { items: T[]; moved: number } {
  const front: T[] = [];
  const back: T[] = [];
  for (const item of items) (isRelevant(item) ? front : back).push(item);
  return { items: [...front, ...back], moved: front.length > 0 && front.length < items.length ? front.length : 0 };
}

export async function tailorCv(userId: UserId, doc: CvDoc, jobTitle: string, jobText: string): Promise<CvTailorResult> {
  const match = await matchCv(userId, flattenCvDoc(doc), jobTitle, jobText);
  const vacancyText = `${jobTitle}\n${jobText}`;
  const relevantTechs = new Set(extractTechs(vacancyText).map((t) => t.name));
  const textLower = vacancyText.toLowerCase();

  const skillsResult = frontLoad(doc.skills, (skill) => isSkillRelevant(skill, textLower, relevantTechs));
  let movedBullets = 0;
  const experience = doc.experience.map((e) => {
    const r = frontLoad(e.bullets, (b) => bulletRelevant(b, relevantTechs));
    movedBullets += r.moved;
    return { ...e, bullets: r.items };
  });

  const tailoredDoc: CvDoc = {
    ...doc,
    skills: skillsResult.items,
    experience,
    summary: match.tailoredSummary || doc.summary,
  };

  return { doc: tailoredDoc, match, reordered: { skills: skillsResult.moved, bullets: movedBullets } };
}
