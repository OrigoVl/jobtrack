// Pure text utilities with no I/O (no DB/network) — split out from vacancy-analysis.service.ts
// so they can be unit-tested without loading db/* (and therefore node:sqlite).
import type { Fit } from "../../shared/validation.js";

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

// A skill's weight for computing fit: skills that appear more often in real vacancies (per the
// `demand` map) weigh more — missing a common/baseline requirement hurts fit more than missing a
// niche one. Without a demand map (demo/test without a DB), all skills weigh equally (1).
function skillWeight(skill: string, demand: Record<string, number>, maxDemand: number): number {
  if (maxDemand <= 0) return 1;
  return 1 + (demand[skill] || 0) / maxDemand;
}

/**
 * A probabilistic fit score for the candidate against a vacancy, from a list of stack matches
 * (`match`) and gaps (`gap`). Replaces the previous crude heuristic (`match.length >= gap.length
 * ? "high" : gap.length <= 2 ? "med" : "low"`), which had two real defects:
 *   1. It counted ABSOLUTE counts, not a ratio — 5 match / 5 gap (50%) was judged "high".
 *   2. `gap.length <= 2` ignored match entirely — 0 match / 2 gap (0% fit!) still
 *      became "med".
 * Now: a ratio (`matchScore / (matchScore+gapScore)`, weighted by market demand for the skill
 * if a demand map is passed) is run through a logistic function centered at 50% — a softer,
 * symmetric transition between high/med/low instead of sharp thresholds, and 0 match is
 * GUARANTEED to never score above "low" (ratio=0 → probability≈0.047, always below any
 * reasonable threshold).
 */
export function computeFit(match: string[], gap: string[], demand: Record<string, number> = {}): Fit {
  if (!match.length && !gap.length) return "high"; // no known requirements at all — no basis to lower the score
  const maxDemand = Math.max(0, ...Object.values(demand));
  const matchScore = match.reduce((sum, s) => sum + skillWeight(s, demand, maxDemand), 0);
  const gapScore = gap.reduce((sum, s) => sum + skillWeight(s, demand, maxDemand), 0);
  const ratio = matchScore / (matchScore + gapScore);
  // Logistic steepness (k=6): ratio=0.5 (50/50) gives ~0.5 (the high/med boundary), ratio=0/1
  // gives almost 0/1 — a smooth but confident transition without "magic" absolute counters.
  const probability = 1 / (1 + Math.exp(-6 * (ratio - 0.5)));
  return probability >= 0.65 ? "high" : probability >= 0.35 ? "med" : "low";
}

/**
 * Synthesizes a short natural-language blob from a vacancy's own structured fields, for
 * embedding (see llm/embeddings.ts#embed, vacancies.repo.ts#findSimilarVacancies). Deliberately
 * built from what's ALWAYS present on every vacancy row (not the raw fetched job-posting text,
 * which isn't persisted) so every vacancy — imported, manually added, enriched or not — gets a
 * consistent, always-fresh embedding input. Returns "" for a vacancy with no meaningful content
 * yet (blank position/company/stack/notes) — callers should treat that as "nothing to embed".
 */
export function vacancyEmbeddingText(v: { position: string; company: string; level: string; stack: string[]; notes: string }): string {
  const parts: string[] = [];
  if (v.position || v.company) parts.push(`${v.position || "Unknown position"} at ${v.company || "an unknown company"}.`);
  if (v.level) parts.push(`Level: ${v.level}.`);
  if (v.stack.length) parts.push(`Stack: ${v.stack.join(", ")}.`);
  if (v.notes.trim()) parts.push(v.notes.trim());
  return parts.join(" ").trim();
}
