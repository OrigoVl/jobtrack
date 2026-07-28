// Lightweight input DTO validation with no external dependencies (in the node:sqlite spirit — zero-deps).
import net from "node:net";
import { HttpError } from "../core/http.js";

export const STATUSES = [
  "Want to apply",
  "Applied",
  "Screening",
  "Tech interview",
  "Take-home task",
  "Final",
  "Offer",
  "Rejected",
  "Paused",
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
    throw new HttpError(400, `Field "${field}" must be an array of strings`);
  }
  return Array.from(new Set((value as string[]).map((s) => s.trim()).filter(Boolean))).slice(0, 80);
}

// "applied"/"next" — an empty string means "not set", otherwise it MUST be ISO YYYY-MM-DD:
// server/src/modules/analytics/analytics.routes.ts and dashboard.tsx compare these fields as
// strings (v.next < today, a.next > b.next) — arbitrary free text ("tomorrow", "08/15")
// silently breaks "upcoming steps" sorting and overdue-step detection without any error.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function toDateOrEmpty(value: unknown, field: string): string {
  const raw = asString(value).trim();
  if (!raw) return "";
  if (!ISO_DATE_RE.test(raw)) throw new HttpError(400, `Field "${field}" must be a date in YYYY-MM-DD format`);
  return raw;
}

function toUrl(value: unknown, field: string): string {
  const raw = asString(value).trim();
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, `Field "${field}" contains an invalid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, `Field "${field}" must be an http(s) link`);
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
  if (!partial || has("company")) out.company = asString(b.company, "New").trim().slice(0, 200) || "New";
  if (!partial || has("position")) out.position = asString(b.position).trim().slice(0, 200);
  if (!partial || has("level")) out.level = asString(b.level).trim().slice(0, 40);
  if (!partial || has("url")) out.url = toUrl(b.url, "url");
  if (!partial || has("status")) {
    const status = asString(b.status, "Want to apply");
    if (!STATUSES.includes(status as VacancyStatus)) throw new HttpError(400, `Invalid status: "${status}"`);
    out.status = status as VacancyStatus;
  }
  if (!partial || has("fit")) {
    const fit = asString(b.fit, "med");
    if (!FITS.includes(fit as Fit)) throw new HttpError(400, `Invalid fit: "${fit}"`);
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
 * Parses one item of an import array in an external tracker format
 * (`{company, pos, level, fit, status, applied, next, notes, url}` — e.g. job-tracker.json,
 * which the user maintains by hand outside the app). Accepts "pos" as the primary field name
 * (and "position" for compatibility with its own export), strictly validates status/fit/dates —
 * throws an HttpError on the specific item; the caller must catch it and not stop the whole import.
 */
export function parseJsonVacancyItem(raw: unknown): JsonVacancyItem {
  const b = (raw || {}) as Record<string, unknown>;
  const company = asString(b.company, "New").trim().slice(0, 200) || "New";
  const position = asString(b.pos ?? b.position)
    .trim()
    .slice(0, 200);
  const level = asString(b.level).trim().slice(0, 40);
  const url = toUrl(b.url, "url");
  const status = asString(b.status, "Want to apply");
  if (!STATUSES.includes(status as VacancyStatus)) throw new HttpError(400, `Invalid status: "${status}"`);
  const fit = asString(b.fit, "med");
  if (!FITS.includes(fit as Fit)) throw new HttpError(400, `Invalid fit: "${fit}"`);
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
  if (!name) throw new HttpError(400, "Company name is required");
  return {
    name,
    notes: asString(b.notes).slice(0, 5000),
    questions: toStringArray(b.questions, "questions"),
  };
}

export function parseText(body: unknown, field = "text", { min = 1, max = 20000 }: { min?: number; max?: number } = {}): string {
  const text = asString((body as Record<string, unknown> | null | undefined)?.[field]);
  if (text.trim().length < min) throw new HttpError(400, `Field "${field}" cannot be empty`);
  return text.slice(0, max);
}

export interface Pagination {
  /** undefined — pagination was not requested, return the whole list (current default behavior). */
  limit?: number;
  offset: number;
}

/**
 * Optional pagination for list endpoints: if no query parameters are passed, we return the
 * whole list as before (compatible with older clients and the Kanban board, which needs to
 * see all vacancies at once to group them by status). limit/offset can be set explicitly
 * once the list grows large enough that loading it in chunks is worthwhile.
 */
export function parsePagination(query: unknown): Pagination {
  const q = (query || {}) as Record<string, unknown>;
  let limit: number | undefined;
  if (Object.prototype.hasOwnProperty.call(q, "limit")) {
    const n = Number(q.limit);
    if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Parameter "limit" must be a positive number');
    limit = Math.min(Math.floor(n), 500);
  }
  let offset = 0;
  if (Object.prototype.hasOwnProperty.call(q, "offset")) {
    const n = Number(q.offset);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Parameter "offset" must be a non-negative number');
    offset = Math.floor(n);
  }
  return { limit, offset };
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "metadata.google.internal"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    return (
      a === 127 || // loopback (127.0.0.0/8)
      a === 10 || // private (10.0.0.0/8)
      a === 0 || // "this network" (0.0.0.0/8)
      (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 — the typical cloud-metadata address
      (a === 172 && b >= 16 && b <= 31) || // private (172.16.0.0/12)
      (a === 192 && b === 168) // private (192.168.0.0/16)
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" || // loopback
      lower.startsWith("fe80") || // link-local
      lower.startsWith("fc") || // unique local (fc00::/7)
      lower.startsWith("fd") ||
      lower.startsWith("::ffff:127.") || // IPv4-mapped variants of the above
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:169.254.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return false;
}

/**
 * SSRF protection for parsing vacancies by link. This used to be a hard allowlist of just
 * jobs.dou.ua — a user rightly pointed out they want auto stack detection from ANY source
 * (LinkedIn, Djinni, robota.ua, Indeed, etc.), not just one site. Now any public https host is
 * allowed; we only block obvious internal/local targets — localhost, private/loopback/link-local
 * IP literals (including 169.254.169.254 — the classic AWS/GCP/Azure cloud-metadata address, a
 * popular SSRF target).
 *
 * This is a syntax-only check WITHOUT a real DNS resolve (a deliberate trade-off, not a full SSRF
 * shield): the app is a local, single-user tracker, the link is entered by the user themselves,
 * and an async dns.lookup() on every call would complicate the contract (this function stays
 * synchronous and is called in several places) and would make unit tests depend on the network.
 * The residual risk — a public host that resolves to a private IP via DNS rebinding at the exact
 * moment of the request — is acceptable here; a multi-tenant/publicly-reachable deployment would
 * need a full resolve-and-pin (checking the IP AFTER resolution, connecting to that verified IP).
 */
export function assertSafeVacancyUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "Invalid vacancy URL");
  }
  if (url.protocol !== "https:") throw new HttpError(400, "Only https links are allowed");
  // url.hostname for IPv6 literals returns the address IN SQUARE BRACKETS (e.g. "[::1]") —
  // net.isIP()/net.isIPv6() don't understand brackets and would silently return false, skipping the check.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new HttpError(400, "This link points to a local/internal resource — not allowed");
  }
  if (net.isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new HttpError(400, "This link points to a private IP address — not allowed");
  }
  return url.toString();
}
