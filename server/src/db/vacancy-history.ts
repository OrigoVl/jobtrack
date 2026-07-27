// Історія зміни статусів вакансії — потрібна, бо колонка vacancies.status просто
// перезаписується при кожному оновленні: без окремого журналу неможливо чесно порахувати
// "скільки вакансій колись досягли етапу X" (реальна воронка), лише "скільки зараз на етапі X"
// (analytics.routes.ts funnel) — вакансія, відхилена на "Тех.співбесіді", зникає з цього етапу
// в поточному знімку, хоча реально через нього пройшла.
import db from "./client.js";

export function recordStatusChange(vacancyId: number, status: string): void {
  db.prepare("INSERT INTO vacancy_status_history (vacancy_id, status) VALUES (?, ?)").run(vacancyId, status);
}

/** Кількість УНІКАЛЬНИХ вакансій, що коли-небудь мали кожен статус (незалежно від поточного). */
export function getReachedCounts(): Record<string, number> {
  const rows = db
    .prepare("SELECT status, COUNT(DISTINCT vacancy_id) c FROM vacancy_status_history GROUP BY status")
    .all() as { status: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
}

export function deleteHistoryForVacancy(vacancyId: number): void {
  db.prepare("DELETE FROM vacancy_status_history WHERE vacancy_id = ?").run(vacancyId);
}
