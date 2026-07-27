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
  if (!partial || has("applied")) out.applied = asString(b.applied).trim().slice(0, 40);
  if (!partial || has("next")) out.next = asString(b.next).trim().slice(0, 200);
  if (!partial || has("notes")) out.notes = asString(b.notes).slice(0, 5000);
  if (!partial || has("stack")) out.stack = toStringArray(b.stack, "stack");
  return out;
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
