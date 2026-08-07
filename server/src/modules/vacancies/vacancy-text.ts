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

// Site chrome that is never part of the posting itself. Dropped wholesale before we go looking
// for the posting's own container below, so a page whose markup gives us no usable container
// still loses the worst of the noise instead of falling back to the raw full-page text.
const CHROME_TAGS = ["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe"];

// Ordered most-specific-first: the first candidate that matches a container with enough text wins.
// `<article>`/`<main>` are the standard semantic wrappers; `itemprop="description"` is schema.org's
// JobPosting field (what jobs.dou.ua actually uses); the class/id patterns cover the common
// hand-rolled job-board markup that has neither.
const CONTENT_CONTAINERS: RegExp[] = [
  /<(article)\b[^>]*>/i,
  /<(main)\b[^>]*>/i,
  /<(\w+)\b[^>]*\sitemprop=["']description["'][^>]*>/i,
  /<(\w+)\b[^>]*\sclass=["'][^"']*\b(?:vacancy|job-description|job_description|jobdescription|job-details|posting|description)\b[^"']*["'][^>]*>/i,
  /<(\w+)\b[^>]*\sid=["'][^"']*\b(?:vacancy|job-description|job_description|jobdescription|posting)\b[^"']*["'][^>]*>/i,
];

/** A container has to carry at least this much text to be believed — a tiny `<main>` wrapping only
 * a breadcrumb would otherwise beat the full page and lose the whole posting. */
const MIN_CONTENT_CHARS = 200;

function removeTags(html: string, tags: string[]): string {
  let out = html;
  for (const tag of tags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), " ");
  }
  return out;
}

/** Returns the markup of the balanced element whose opening tag starts at `openStart`, tracking
 * nesting depth so a `<div>` full of nested `<div>`s isn't cut short at the first `</div>`. Falls
 * back to "everything to the end" for unbalanced markup (missing close tag), which is common
 * enough in real-world pages that it must not throw. */
function sliceElement(html: string, openStart: number, tag: string): string | null {
  const openEnd = html.indexOf(">", openStart);
  if (openEnd === -1) return null;
  if (html[openEnd - 1] === "/") return html.slice(openStart, openEnd + 1); // self-closing, no content
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi");
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[2] === "/") continue; // self-closing sibling, doesn't change depth
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(openStart, m.index + m[0].length);
  }
  return html.slice(openStart);
}

/**
 * Narrows a fetched job-posting page down to the posting's OWN markup, before stripHtml() turns it
 * into the text every downstream consumer analyzes (skills, level, salary, LLM facts/summary).
 *
 * Without this, a jobs.dou.ua page contributed its "Гарячі вакансії" and "Схожі вакансії" sidebars
 * to the analyzed text — so a Vue/Nuxt posting came back with React, Angular, Python, SQL and
 * Node.js in its stack, scraped off links to OTHER companies' unrelated jobs. Every job board has
 * some version of that ("similar jobs", "more from this employer", category nav), so this is a
 * generic fix, not a DOU-specific one: drop the chrome tags, then keep the best posting container
 * we can identify, falling back to the chrome-stripped page when the markup gives us nothing.
 */
export function extractMainContent(html: string): string {
  const cleaned = removeTags(html, CHROME_TAGS);
  for (const re of CONTENT_CONTAINERS) {
    const m = re.exec(cleaned);
    if (!m?.[1]) continue;
    const element = sliceElement(cleaned, m.index, m[1]);
    if (element && stripHtml(element).length >= MIN_CONTENT_CHARS) return element;
  }
  return cleaned;
}

// Deliberately conservative: an explicit currency amount (or an amount immediately followed by a
// currency word), optionally as a range. Anything vaguer ("competitive", a bare "3000") is left to
// the LLM path — a wrong salary silently written onto a tracked application is worse than none.
// Every amount must both start and end on a digit, so the separators allowed *inside* it ("4 000
// 000") can't spill into the punctuation that follows the match ("$2000–3000 ," → "$2000–3000").
const AMOUNT = String.raw`\d(?:[\d\s.,]*\d)?\s?[kк]?`;
const SALARY_RE = new RegExp(
  String.raw`[$€£]\s?${AMOUNT}(?:\s?[–—-]\s?[$€£]?\s?${AMOUNT})?` +
    String.raw`|${AMOUNT}(?:\s?[–—-]\s?${AMOUNT})?\s?(?:USD|EUR|GBP|UAH|PLN|грн|₴)`,
  "i",
);

/**
 * Best-effort salary string straight off the posting's own text — deterministic, so a tracked
 * vacancy gets its salary filled in even with no LLM key (the same offline-fallback rule every AI
 * feature in this app follows). Returns "" when nothing confident is found; the caller decides
 * whether the LLM's own guess should fill the gap.
 *
 * Only safe to run on extractMainContent()-narrowed text: on a raw DOU page the first currency
 * amount on screen belongs to some unrelated "Гарячі вакансії" listing, not to this posting.
 */
export function extractSalary(text: unknown): string {
  const m = SALARY_RE.exec(String(text || ""));
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
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
