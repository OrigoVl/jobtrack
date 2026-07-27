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

// Вага навички для розрахунку fit: навички, що частіше зустрічаються в реальних вакансіях
// (за мапою попиту `demand`), важать більше — пропустити типову/базову вимогу гірше для
// fit, ніж пропустити нішеву. Без мапи попиту (демо/тест без БД) усі навички рівноважні (1).
function skillWeight(skill: string, demand: Record<string, number>, maxDemand: number): number {
  if (maxDemand <= 0) return 1;
  return 1 + (demand[skill] || 0) / maxDemand;
}

/**
 * Ймовірнісна оцінка відповідності кандидата вакансії за списком збігів (`match`) і прогалин
 * (`gap`) у стеку. Замінює попередню грубу евристику (`match.length >= gap.length ? "high" :
 * gap.length <= 2 ? "med" : "low"`), яка мала два реальні дефекти:
 *   1. Рахувала АБСОЛЮТНУ кількість, не частку — 5 match / 5 gap (50%) визнавались "high".
 *   2. `gap.length <= 2` не враховував match — 0 match / 2 gap (0% відповідності!) все одно
 *      ставало "med".
 * Тепер: частка (`matchScore / (matchScore+gapScore)`, зважена попитом навички на ринку,
 * якщо мапа попиту передана) проходить крізь логістичну функцію навколо 50% — м'якший,
 * симетричний перехід між high/med/low замість різких порогів, і 0 match ГАРАНТОВАНО не
 * може дати вище за "low" (ratio=0 → probability≈0.047, завжди < будь-якого розумного порогу).
 */
export function computeFit(match: string[], gap: string[], demand: Record<string, number> = {}): Fit {
  if (!match.length && !gap.length) return "high"; // немає жодних відомих вимог — немає підстав знижувати оцінку
  const maxDemand = Math.max(0, ...Object.values(demand));
  const matchScore = match.reduce((sum, s) => sum + skillWeight(s, demand, maxDemand), 0);
  const gapScore = gap.reduce((sum, s) => sum + skillWeight(s, demand, maxDemand), 0);
  const ratio = matchScore / (matchScore + gapScore);
  // Логістична крутизна (k=6): ratio=0.5 (50/50) дає ~0.5 (межа high/med), ratio=0/1 дає
  // майже 0/1 — плавний, але впевнений перехід без "магічних" абсолютних лічильників.
  const probability = 1 / (1 + Math.exp(-6 * (ratio - 0.5)));
  return probability >= 0.65 ? "high" : probability >= 0.35 ? "med" : "low";
}
