// Normalizes external job-aggregator tags (Remotive/Arbeitnow return arbitrary casing in the
// same list — "css", "excel", "frontend" next to "HTML", "Projektmanagement") to one consistent
// display style: a known technology keeps this app's own canonical casing (reusing TECHS' alias
// regexes, so "node"/"nodejs"/"node.js" all resolve the same way), a known abbreviation is fully
// upper-cased, and everything else is Title Cased word-by-word.
import { TECHS } from "./tech-dict.js";

const ABBREVIATIONS = new Set([
  "api",
  "css",
  "html",
  "ui",
  "ux",
  "qa",
  "ci",
  "cd",
  "hr",
  "seo",
  "sql",
  "php",
  "aws",
  "gcp",
  "http",
  "https",
  "url",
  "json",
  "xml",
  "vpn",
  "erp",
  "crm",
  "b2b",
  "b2c",
  "saas",
  "pm",
]);

function normalizeWord(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (lower === "ios") return "iOS";
  if (ABBREVIATIONS.has(lower)) return lower.toUpperCase();
  return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
}

function titleCase(raw: string): string {
  return raw
    .split(/(\s+|[/-])/)
    .map((part) => (part === "" || /^\s+$/.test(part) || part === "/" || part === "-" ? part : normalizeWord(part)))
    .join("");
}

/** Normalizes a single display tag. A tag matching a TECHS entry's alias regex (covers common
 * spelling variants like "node"/"nodejs"/"node.js") resolves to that entry's canonical casing;
 * a known abbreviation not in TECHS is upper-cased; anything else is Title Cased word-by-word. */
export function normalizeTag(tag: string): string {
  const raw = String(tag || "").trim();
  if (!raw) return raw;
  for (const [name, def] of Object.entries(TECHS)) {
    if (def.re.test(raw)) return name;
  }
  return titleCase(raw);
}
