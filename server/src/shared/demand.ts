// Попит ринку — рахується з реального стеку доданих вакансій. Використовується
// в CV-рев'ю, плані навчання, роудмапі, аналітиці, «фокусі тижня» та 21-денному плані.
import db, { j } from "../db/index.js";

// Раніше кожна вакансія важила рівно 1, незалежно від того, додана вона вчора чи рік тому —
// вакансія з "мертвого" ринку (застарілий стек, компанія вже не набирає) назавжди займала
// місце в попиті нарівні зі свіжою. Експоненційне згасання за часом (recency decay) —
// стандартний підхід у time series/рекомендаційних системах для "живого" сигналу: вага
// вакансії зменшується вдвічі кожні HALF_LIFE_DAYS днів від дати додавання.
const HALF_LIFE_DAYS = 90;

/** Вага вакансії за віком: 1.0 у день додавання, 0.5 через HALF_LIFE_DAYS, і так далі. */
export function recencyWeight(createdIso: string, now: Date = new Date()): number {
  const created = new Date(createdIso);
  // Немає/зіпсована дата (старі сідові рядки до появи колонки created) — не карати за
  // відсутність даних, рахувати як щойно додану (вага 1), а не 0 (що занулило б попит навички).
  if (Number.isNaN(created.getTime())) return 1;
  const ageDays = Math.max(0, (now.getTime() - created.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Мапа "навичка -> зважений попит" по всіх доданих вакансіях. Значення округлюється до
 * цілого — код і LLM-промпти по всьому застосунку (roadmap/аналітика/knowledge-порада)
 * трактують це число як "у скількох вакансіях зустрічається" (`потрібно у ${count} вакансіях`
 * тощо), тож заокруглене число лишається читабельним у тому ж дусі, просто старі вакансії
 * тепер долучаються частками (0.5, 0.25...), а не рівно 1 — свіжий попит переважує застарілий.
 */
export function demandMap(now: Date = new Date()): Record<string, number> {
  const rows = db.prepare("SELECT stack, created FROM vacancies").all() as { stack: string; created: string }[];
  const weighted: Record<string, number> = {};
  rows.forEach((v) => {
    const weight = recencyWeight(v.created, now);
    j(v.stack).forEach((t) => (weighted[t] = (weighted[t] || 0) + weight));
  });
  const map: Record<string, number> = {};
  for (const [tech, sum] of Object.entries(weighted)) map[tech] = Math.round(sum);
  return map;
}
