// Попит ринку — рахується з реального стеку доданих вакансій. Використовується
// в CV-рев'ю, плані навчання, роудмапі, аналітиці, «фокусі тижня» та 21-денному плані.
import db, { j } from "../db/index.js";

export function demandMap(): Record<string, number> {
  const rows = db.prepare("SELECT stack FROM vacancies").all() as { stack: string }[];
  const map: Record<string, number> = {};
  rows.forEach((v) => j(v.stack).forEach((t) => (map[t] = (map[t] || 0) + 1)));
  return map;
}
