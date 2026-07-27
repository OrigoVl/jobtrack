// Кольорова прогресія статусу вакансії — від нейтрального (ще не подано) через холодні
// відтінки (у процесі) до теплих (близько до фіналу), і окремо зелений/червоний/сірий для
// явних завершень (оффер/відмова/пауза). Використовується і в таблиці (фон <select>), і в
// Канбані (кольоровий індикатор колонки), щоб статус читався з першого погляду без наведення.
import type { VacancyStatus } from "./types";

export const STATUS_SELECT_CLASS: Record<VacancyStatus, string> = {
  "Хочу подати": "bg-slate-100 text-slate-700 border-slate-200",
  "Відправив CV": "bg-sky-50 text-sky-700 border-sky-200",
  Скринінг: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Тех.співбесіда": "bg-violet-50 text-violet-700 border-violet-200",
  "Тестове завдання": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  Фінал: "bg-amber-50 text-amber-700 border-amber-200",
  Оффер: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Відмова: "bg-rose-50 text-rose-700 border-rose-200",
  Пауза: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export const STATUS_DOT_CLASS: Record<VacancyStatus, string> = {
  "Хочу подати": "bg-slate-400",
  "Відправив CV": "bg-sky-500",
  Скринінг: "bg-indigo-500",
  "Тех.співбесіда": "bg-violet-500",
  "Тестове завдання": "bg-fuchsia-500",
  Фінал: "bg-amber-500",
  Оффер: "bg-emerald-500",
  Відмова: "bg-rose-500",
  Пауза: "bg-zinc-400",
};

// Той самий колір, що й STATUS_DOT_CLASS, але як ліва рамка картки в Канбані — щоб статус
// читався і тоді, коли колонка проскролена за межі екрана.
export const STATUS_BORDER_L_CLASS: Record<VacancyStatus, string> = {
  "Хочу подати": "border-l-slate-400",
  "Відправив CV": "border-l-sky-500",
  Скринінг: "border-l-indigo-500",
  "Тех.співбесіда": "border-l-violet-500",
  "Тестове завдання": "border-l-fuchsia-500",
  Фінал: "border-l-amber-500",
  Оффер: "border-l-emerald-500",
  Відмова: "border-l-rose-500",
  Пауза: "border-l-zinc-400",
};

// Фолбек про всяк випадок: status у Vacancy типізований як string (сервер історично приймав
// довільний рядок), тож індексація за невідомим значенням не має падати чи лишати порожній клас.
export const DEFAULT_STATUS_SELECT_CLASS = "bg-slate-100 text-slate-700 border-slate-200";
export const DEFAULT_STATUS_DOT_CLASS = "bg-slate-400";
export const DEFAULT_STATUS_BORDER_L_CLASS = "border-l-slate-400";
