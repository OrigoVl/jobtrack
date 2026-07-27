// Легка валідація вхідних DTO без зовнішніх залежностей (у стилі node:sqlite — zero-deps).
import { HttpError } from "../core/http.js";

export const STATUSES = [
  "Хочу подати",
  "Відправив CV",
  "Скринінг",
  "Тех.співбесіда",
  "Тестове завдання",
  "Фінал",
  "Оффер",
  "Відмова",
  "Пауза",
] as const;
export type VacancyStatus = (typeof STATUSES)[number];

export const FITS = ["high", "med", "low"] as const;
export type Fit = (typeof FITS)[number];

export const ROADMAP_STATUSES = ["todo", "learning", "done"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

const asString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : value == null ? fallback : String(value));

function toStringArray(value: unknown, field: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new HttpError(400, `Поле "${field}" має бути масивом рядків`);
  }
  return Array.from(new Set((value as string[]).map((s) => s.trim()).filter(Boolean))).slice(0, 80);
}

// "applied"/"next" — порожній рядок означає "не задано", інакше МАЄ бути ISO YYYY-MM-DD:
// server/src/modules/analytics/analytics.routes.ts і dashboard.tsx порівнюють ці поля як
// рядки (v.next < today, a.next > b.next) — довільний вільний текст ("завтра", "15.08")
// тихо ламає сортування "найближчі кроки" й детекцію протермінованих кроків без жодної помилки.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function toDateOrEmpty(value: unknown, field: string): string {
  const raw = asString(value).trim();
  if (!raw) return "";
  if (!ISO_DATE_RE.test(raw)) throw new HttpError(400, `Поле "${field}" має бути датою у форматі РРРР-ММ-ДД`);
  return raw;
}

function toUrl(value: unknown, field: string): string {
  const raw = asString(value).trim();
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, `Поле "${field}" містить некоректний URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, `Поле "${field}" має бути http(s)-посиланням`);
  }
  return raw;
}

export interface VacancyInput {
  company?: string;
  position?: string;
  level?: string;
  url?: string;
  status?: VacancyStatus;
  fit?: Fit;
  applied?: string;
  next?: string;
  notes?: string;
  stack?: string[];
}

export function parseVacancyInput(body: unknown, { partial = false }: { partial?: boolean } = {}): VacancyInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: VacancyInput = {};
  if (!partial || has("company")) out.company = asString(b.company, "Нова").trim().slice(0, 200) || "Нова";
  if (!partial || has("position")) out.position = asString(b.position).trim().slice(0, 200);
  if (!partial || has("level")) out.level = asString(b.level).trim().slice(0, 40);
  if (!partial || has("url")) out.url = toUrl(b.url, "url");
  if (!partial || has("status")) {
    const status = asString(b.status, "Хочу подати");
    if (!STATUSES.includes(status as VacancyStatus)) throw new HttpError(400, `Некоректний статус: "${status}"`);
    out.status = status as VacancyStatus;
  }
  if (!partial || has("fit")) {
    const fit = asString(b.fit, "med");
    if (!FITS.includes(fit as Fit)) throw new HttpError(400, `Некоректний fit: "${fit}"`);
    out.fit = fit as Fit;
  }
  if (!partial || has("applied")) out.applied = toDateOrEmpty(b.applied, "applied");
  if (!partial || has("next")) out.next = toDateOrEmpty(b.next, "next");
  if (!partial || has("notes")) out.notes = asString(b.notes).slice(0, 5000);
  if (!partial || has("stack")) out.stack = toStringArray(b.stack, "stack");
  return out;
}

export interface JsonVacancyItem {
  company: string;
  position: string;
  level: string;
  url: string;
  status: VacancyStatus;
  fit: Fit;
  applied: string;
  next: string;
  notes: string;
}

/**
 * Парсить один елемент масиву імпорту у форматі зовнішнього трекера
 * (`{company, pos, level, fit, status, applied, next, notes, url}` — напр. job-tracker.json,
 * який власноруч веде користувач поза застосунком). Приймає "pos" як основну назву поля
 * (і "position" для сумісності зі своїм же експортом), суворо валідує status/fit/дати —
 * кидає HttpError на конкретному елементі, виклик має ловити її й не зупиняти весь імпорт.
 */
export function parseJsonVacancyItem(raw: unknown): JsonVacancyItem {
  const b = (raw || {}) as Record<string, unknown>;
  const company = asString(b.company, "Нова").trim().slice(0, 200) || "Нова";
  const position = asString(b.pos ?? b.position)
    .trim()
    .slice(0, 200);
  const level = asString(b.level).trim().slice(0, 40);
  const url = toUrl(b.url, "url");
  const status = asString(b.status, "Хочу подати");
  if (!STATUSES.includes(status as VacancyStatus)) throw new HttpError(400, `Некоректний статус: "${status}"`);
  const fit = asString(b.fit, "med");
  if (!FITS.includes(fit as Fit)) throw new HttpError(400, `Некоректний fit: "${fit}"`);
  const applied = toDateOrEmpty(b.applied, "applied");
  const next = toDateOrEmpty(b.next, "next");
  const notes = asString(b.notes).slice(0, 5000);
  return { company, position, level, url, status: status as VacancyStatus, fit: fit as Fit, applied, next, notes };
}

export interface ProfileInput {
  skills: string[];
  cvText: string;
  domain?: string;
}

export function parseProfileInput(body: unknown): ProfileInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: ProfileInput = { skills: toStringArray(b.skills, "skills"), cvText: asString(b.cvText).slice(0, 20000) };
  if (has("domain")) out.domain = asString(b.domain).trim().slice(0, 80);
  return out;
}

export interface CompanyInput {
  name: string;
  notes: string;
  questions: string[];
}

export function parseCompanyInput(body: unknown): CompanyInput {
  const b = (body || {}) as Record<string, unknown>;
  const name = asString(b.name).trim().slice(0, 200);
  if (!name) throw new HttpError(400, "Назва компанії обовʼязкова");
  return {
    name,
    notes: asString(b.notes).slice(0, 5000),
    questions: toStringArray(b.questions, "questions"),
  };
}

export function parseText(body: unknown, field = "text", { min = 1, max = 20000 }: { min?: number; max?: number } = {}): string {
  const text = asString((body as Record<string, unknown> | null | undefined)?.[field]);
  if (text.trim().length < min) throw new HttpError(400, `Поле "${field}" не може бути порожнім`);
  return text.slice(0, max);
}

export interface Pagination {
  /** undefined — пагінацію не запитано, повернути весь список (поточна поведінка за замовчуванням). */
  limit?: number;
  offset: number;
}

/**
 * Опційна пагінація для list-ендпоінтів: якщо query-параметри не передані — повертаємо
 * весь список як і раніше (сумісність зі старими клієнтами й Kanban-дошкою, якій треба
 * бачити всі вакансії одразу для групування за статусом). limit/offset можна задати явно,
 * коли список виросте настільки, що варто підвантажувати частинами.
 */
export function parsePagination(query: unknown): Pagination {
  const q = (query || {}) as Record<string, unknown>;
  let limit: number | undefined;
  if (Object.prototype.hasOwnProperty.call(q, "limit")) {
    const n = Number(q.limit);
    if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Параметр "limit" має бути додатним числом');
    limit = Math.min(Math.floor(n), 500);
  }
  let offset = 0;
  if (Object.prototype.hasOwnProperty.call(q, "offset")) {
    const n = Number(q.offset);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Параметр "offset" має бути невідʼємним числом');
    offset = Math.floor(n);
  }
  return { limit, offset };
}

// SSRF-захист: сервер ходить лише на jobs.dou.ua і лише по https.
export function assertSafeVacancyUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "Некоректний URL вакансії");
  }
  if (url.protocol !== "https:") throw new HttpError(400, "Дозволені лише https-посилання");
  if (!/(^|\.)dou\.ua$/i.test(url.hostname)) {
    throw new HttpError(400, "Парсинг дозволено лише для посилань jobs.dou.ua");
  }
  return url.toString();
}
