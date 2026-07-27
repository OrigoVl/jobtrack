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
  const rows = db.prepare("SELECT status, COUNT(DISTINCT vacancy_id) c FROM vacancy_status_history GROUP BY status").all() as {
    status: string;
    c: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
}

export function deleteHistoryForVacancy(vacancyId: number): void {
  db.prepare("DELETE FROM vacancy_status_history WHERE vacancy_id = ?").run(vacancyId);
}

export interface StageConversion {
  from: string;
  to: string;
  /** % вакансій, що досягли `from`, які ПОТІМ (чи одночасно) досягли й `to`. null — жодна вакансія ще не досягала `from`. */
  rate: number | null;
}

/**
 * Конверсія між СУСІДНІМИ етапами заданого порядку (напр. funnelOrder з analytics.routes.ts) —
 * класична funnel-метрика: яка частка тих, хто дійшов до етапу N, дійшла й до N+1. Рахується
 * лише з getReachedCounts() (уже завантажені дані, без додаткового запиту до БД) — тому дешева
 * й безпечна викликати на кожен /analytics. НЕ припускає строго лінійний рух (вакансія може
 * "перескочити" етап чи піти у "Відмова" з будь-якого етапу) — це коректно, бо рахує лише
 * "чи КОЛИ-НЕБУДЬ був на обох етапах", а не послідовність переходів.
 */
export function getFunnelConversion(order: readonly string[]): StageConversion[] {
  const reached = getReachedCounts();
  const result: StageConversion[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i]!;
    const to = order[i + 1]!;
    const fromCount = reached[from] || 0;
    const toCount = reached[to] || 0;
    result.push({ from, to, rate: fromCount > 0 ? Math.round((Math.min(toCount, fromCount) / fromCount) * 100) : null });
  }
  return result;
}

export interface StageDuration {
  status: string;
  /** Середня кількість днів МІЖ входом у цей статус і НАСТУПНОЮ зміною статусу (по всіх вакансіях). */
  avgDays: number;
  /** К-сть переходів, з яких усереднено avgDays — щоб UI міг сховати статистично незначущі рядки (напр. count===1). */
  count: number;
}

/**
 * Середній час "затримки" в кожному статусі — для кожної вакансії дивимось на ПОСЛІДОВНІ пари
 * записів історії (упорядковані за часом) і рахуємо різницю в днях. Той самий принцип, що й у
 * survival-аналізі "time in state": показує, на якому етапі кандидат/рекрутер найдовше тримає
 * паузу — інформація, якої немає в статичних funnel/funnelReached (лише "скільки", не "як довго").
 */
export function getAvgDaysInStage(): StageDuration[] {
  const rows = db
    .prepare("SELECT vacancy_id, status, changed_at FROM vacancy_status_history ORDER BY vacancy_id, changed_at")
    .all() as { vacancy_id: number; status: string; changed_at: string }[];
  const sums = new Map<string, { total: number; count: number }>();
  for (let i = 0; i < rows.length - 1; i++) {
    const cur = rows[i]!;
    const next = rows[i + 1]!;
    if (next.vacancy_id !== cur.vacancy_id) continue; // межа між різними вакансіями — не пара переходу
    const days = (new Date(next.changed_at).getTime() - new Date(cur.changed_at).getTime()) / 86_400_000;
    if (!Number.isFinite(days) || days < 0) continue;
    const acc = sums.get(cur.status) ?? { total: 0, count: 0 };
    acc.total += days;
    acc.count += 1;
    sums.set(cur.status, acc);
  }
  return [...sums.entries()]
    .map(([status, { total, count }]) => ({ status, avgDays: Math.round((total / count) * 10) / 10, count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}
