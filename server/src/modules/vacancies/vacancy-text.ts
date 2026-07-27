// Чисті текстові утиліти без I/O (без БД/мережі) — винесені окремо від vacancy-analysis.service.ts,
// щоб їх можна було юніт-тестити без завантаження db/* (а отже й node:sqlite).
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

// Груба евристика відповідності: більше збігів ніж прогалин → high, мало прогалин → med, інакше low.
export function computeFit(match: string[], gap: string[]): Fit {
  return match.length >= gap.length ? "high" : gap.length <= 2 ? "med" : "low";
}
