// Lightweight input DTO validation with no external dependencies (in the node:sqlite spirit — zero-deps).
import net from "node:net";
import { HttpError } from "../core/http.js";
import { isTrack, type Track } from "./tracks.js";
import { toDomain } from "./domain.js";

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
const asNumber = (value: unknown, fallback = 0): number => (Number.isFinite(Number(value)) ? Number(value) : fallback);

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
  salary?: string;
  url?: string;
  status?: VacancyStatus;
  fit?: Fit;
  applied?: string;
  next?: string;
  notes?: string;
  stack?: string[];
  companyId?: number | null;
  favorite?: boolean;
  coverLetter?: string;
  coverLetterDetails?: string;
}

export function parseVacancyInput(body: unknown, { partial = false }: { partial?: boolean } = {}): VacancyInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: VacancyInput = {};
  if (!partial || has("company")) out.company = asString(b.company, "New").trim().slice(0, 200) || "New";
  if (!partial || has("position")) out.position = asString(b.position).trim().slice(0, 200);
  if (!partial || has("level")) out.level = asString(b.level).trim().slice(0, 40);
  if (!partial || has("salary")) out.salary = asString(b.salary).trim().slice(0, 60);
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
  if (!partial || has("companyId")) {
    if (b.companyId == null || b.companyId === "") {
      out.companyId = null;
    } else {
      const n = Number(b.companyId);
      if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "companyId" must be a positive integer');
      out.companyId = n;
    }
  }
  if (!partial || has("favorite")) out.favorite = b.favorite === true;
  if (!partial || has("coverLetter")) out.coverLetter = asString(b.coverLetter).slice(0, 5000);
  if (!partial || has("coverLetterDetails")) out.coverLetterDetails = asString(b.coverLetterDetails).slice(0, 1000);
  return out;
}

export interface JsonVacancyItem {
  company: string;
  position: string;
  level: string;
  salary: string;
  url: string;
  status: VacancyStatus;
  fit: Fit;
  applied: string;
  next: string;
  notes: string;
}

// Some hand-maintained job-tracker.json files (e.g. a personal tracker kept in another
// language/AI chat) use localized status labels instead of the app's canonical English wire
// values — accept the common Ukrainian variants (including the app's own uk vacancyStatus
// translations, see client/src/i18n/locales/uk/common.json, plus a couple of informal synonyms)
// by normalizing them to a canonical VacancyStatus before the strict STATUSES check below.
const STATUS_ALIASES: Record<string, VacancyStatus> = {
  "хочу подати": "Want to apply",
  "хочу подати заявку": "Want to apply",
  подано: "Applied",
  "подана заявка": "Applied",
  "відправив cv": "Applied",
  "відправила cv": "Applied",
  скринінг: "Screening",
  "технічне інтерв'ю": "Tech interview",
  "тестове завдання": "Take-home task",
  фінал: "Final",
  офер: "Offer",
  відмова: "Rejected",
  "на паузі": "Paused",
};

function normalizeStatus(status: string): string {
  return STATUS_ALIASES[status.trim().toLowerCase()] ?? status;
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
  const salary = asString(b.salary).trim().slice(0, 60);
  const url = toUrl(b.url, "url");
  const status = normalizeStatus(asString(b.status, "Want to apply"));
  if (!STATUSES.includes(status as VacancyStatus)) throw new HttpError(400, `Invalid status: "${status}"`);
  const fit = asString(b.fit, "med");
  if (!FITS.includes(fit as Fit)) throw new HttpError(400, `Invalid fit: "${fit}"`);
  const applied = toDateOrEmpty(b.applied, "applied");
  const next = toDateOrEmpty(b.next, "next");
  const notes = asString(b.notes).slice(0, 5000);
  return { company, position, level, salary, url, status: status as VacancyStatus, fit: fit as Fit, applied, next, notes };
}

export interface ProfileInput {
  skills: string[];
  cvText: string;
  domain?: string;
  track?: Track;
}

export function parseProfileInput(body: unknown): ProfileInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: ProfileInput = { skills: toStringArray(b.skills, "skills"), cvText: asString(b.cvText).slice(0, 20000) };
  if (has("domain")) out.domain = asString(b.domain).trim().slice(0, 80);
  // An empty/invalid track clears the override (falls back to auto-detection), rather than
  // throwing — this field is a convenience selector, not a value with a "wrong" input to reject.
  if (has("track")) {
    const track = asString(b.track).trim();
    out.track = isTrack(track) ? track : undefined;
  }
  return out;
}

export interface SkillLevelInput {
  tech: string;
  /** null clears a manual override, going back to the computed level. */
  level: number | null;
}

/** PUT /roadmap/level body. `level` null/empty/absent clears the override. */
export function parseSkillLevelInput(body: unknown): SkillLevelInput {
  const b = (body || {}) as Record<string, unknown>;
  const tech = asString(b.tech).trim().slice(0, 80);
  if (!tech) throw new HttpError(400, "No skill specified");
  if (b.level == null || b.level === "") return { tech, level: null };
  const n = Number(b.level);
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new HttpError(400, 'Field "level" must be an integer between 0 and 100');
  return { tech, level: n };
}

// 1..50: below 1 the "goal" concept is meaningless, above 50/week is almost certainly a typo (a
// real power-user job search rarely exceeds a handful of applications a day).
export function parseWeeklyApplyGoalInput(body: unknown): number {
  const b = (body || {}) as Record<string, unknown>;
  const n = Number(b.weekly);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new HttpError(400, 'Field "weekly" must be an integer between 1 and 50');
  return n;
}

// Shared by parseInterviewTurnInput and parseDesignTaskInput — both accept an optional vacancy to
// scope generation to (0/null/absent means "general").
function parseOptionalVacancyId(value: unknown): number | null {
  if (value == null || value === 0) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "vacancyId" must be a positive integer');
  return n;
}

export interface InterviewTurnInput {
  vacancyId: number | null;
  transcript: { q: string; a: string }[];
  maxTurns: number;
}

/** POST /mock/interview body — see mock-interview.service.ts. `transcript` is the whole
 * conversation so far (this endpoint is stateless), capped defensively since its length directly
 * gates how many chatJson calls a single request can trigger downstream. */
export function parseInterviewTurnInput(body: unknown): InterviewTurnInput {
  const b = (body || {}) as Record<string, unknown>;
  const vacancyId = parseOptionalVacancyId(b.vacancyId);
  if (b.transcript != null && !Array.isArray(b.transcript)) throw new HttpError(400, 'Field "transcript" must be an array');
  const transcript = ((b.transcript as unknown[]) || []).slice(0, 10).map((item, i) => {
    const it = (item || {}) as Record<string, unknown>;
    if (typeof it.q !== "string" || typeof it.a !== "string")
      throw new HttpError(400, `Transcript entry ${i} must have string "q" and "a"`);
    return { q: it.q.trim().slice(0, 600), a: it.a.trim().slice(0, 2000) };
  });
  // Clamped here AND again in mock-interview.service.ts (belt and suspenders) — this value gates
  // how many chatJson calls a single request can trigger, so it's never trusted from just one layer.
  const maxTurns = Math.max(3, Math.min(10, Number(b.maxTurns) || 6));
  return { vacancyId, transcript, maxTurns };
}

export interface CompanyInput {
  name: string;
  notes: string;
  questions: string[];
  /** Bare host ("acme.com"), normalized via toDomain() from a full URL/bare domain — used as the
   * contact-enrichment provider/cache key (modules/contacts/enrichment/). "" when unset/unparseable —
   * this is a lenient, best-effort field, never a reason to reject the whole company. */
  website?: string;
}

export function parseCompanyInput(body: unknown): CompanyInput {
  const b = (body || {}) as Record<string, unknown>;
  const name = asString(b.name).trim().slice(0, 200);
  if (!name) throw new HttpError(400, "Company name is required", null, "COMPANY_NAME_REQUIRED");
  return {
    name,
    notes: asString(b.notes).slice(0, 5000),
    questions: toStringArray(b.questions, "questions"),
    website: toDomain(asString(b.website)),
  };
}

export interface ContactInput {
  name?: string;
  role?: string;
  companyId?: number | null;
  vacancyId?: number | null;
  email?: string;
  linkedinUrl?: string;
  notes?: string;
  lastContactAt?: string;
}

/** Parses a networking contact (create or partial update — same `{ partial }` shape as
 * parseVacancyInput/parseCalendarEventInput). `companyId`/`vacancyId` are only range/shape-checked
 * here; confirming they belong to the caller needs a DB lookup — see contacts.routes.ts. */
export function parseContactInput(body: unknown, { partial = false }: { partial?: boolean } = {}): ContactInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: ContactInput = {};
  if (!partial || has("name")) out.name = asString(b.name).trim().slice(0, 200);
  if (!partial || has("role")) out.role = asString(b.role).trim().slice(0, 160);
  if (!partial || has("companyId")) {
    if (b.companyId == null || b.companyId === "") {
      out.companyId = null;
    } else {
      const n = Number(b.companyId);
      if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "companyId" must be a positive integer');
      out.companyId = n;
    }
  }
  if (!partial || has("vacancyId")) {
    if (b.vacancyId == null || b.vacancyId === "") {
      out.vacancyId = null;
    } else {
      const n = Number(b.vacancyId);
      if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "vacancyId" must be a positive integer');
      out.vacancyId = n;
    }
  }
  if (!partial || has("email")) out.email = asString(b.email).trim().slice(0, 200);
  if (!partial || has("linkedinUrl")) out.linkedinUrl = b.linkedinUrl ? toUrl(b.linkedinUrl, "linkedinUrl") : "";
  if (!partial || has("notes")) out.notes = asString(b.notes).slice(0, 5000);
  if (!partial || has("lastContactAt")) out.lastContactAt = toDateOrEmpty(b.lastContactAt, "lastContactAt");
  return out;
}

// Default recruiter/hiring-contact titles used when the caller doesn't pass any — see
// modules/contacts/enrichment/enrichment-providers.ts's EnrichmentQuery for the shape this feeds.
const DEFAULT_ENRICHMENT_TITLES = ["recruiter", "talent acquisition", "technical recruiter", "hr"];
const MAX_ENRICHMENT_TITLES = 5;

export interface EnrichmentQuery {
  companyName: string;
  domain: string;
  titles: string[];
  personName: string;
  limit: number;
}

/** POST /contacts/enrich body — see modules/contacts/enrichment/enrichment.service.ts's
 * enrichContacts(). `domain` accepts a full URL/bare host/email the same way CompanyInput.website
 * does (normalized via toDomain()); resolving a domain from a linked company's own `website` is
 * contacts.routes.ts's job (needs a DB lookup), not this pure parsing layer. */
export function parseEnrichmentQuery(body: unknown): EnrichmentQuery {
  const b = (body || {}) as Record<string, unknown>;
  const companyName = asString(b.companyName).trim().slice(0, 200);
  const domain = toDomain(asString(b.domain));
  const rawTitles = toStringArray(b.titles, "titles").slice(0, MAX_ENRICHMENT_TITLES);
  const titles = rawTitles.length ? rawTitles : DEFAULT_ENRICHMENT_TITLES;
  const personName = asString(b.personName).trim().slice(0, 200);
  const rawLimit = Number(b.limit);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(25, Math.floor(rawLimit))) : 10;
  return { companyName, domain, titles, personName, limit };
}

export interface PostingContactsInput {
  /** Which tracked vacancy's own text to read. 0 = none given. */
  vacancyId: number;
  /** Text pasted directly (a posting copied from elsewhere, an email signature). "" = none. */
  text: string;
}

/** POST /contacts/extract body — see modules/contacts/enrichment/posting-contacts.ts. Exactly one
 * of the two inputs is required, and resolving `vacancyId` to its text is contacts.routes.ts's job
 * (it needs an ownership-scoped DB lookup), not this pure parsing layer. The cap is well above a
 * long posting but stops a caller pushing a novel through an LLM endpoint. */
export function parsePostingContactsInput(body: unknown): PostingContactsInput {
  const b = (body || {}) as Record<string, unknown>;
  const rawId = Number(b.vacancyId ?? 0);
  const vacancyId = Number.isInteger(rawId) && rawId > 0 ? rawId : 0;
  const text = asString(b.text).slice(0, 40000).trim();
  if (!vacancyId && !text) throw new HttpError(400, 'Provide either "vacancyId" or "text"');
  return { vacancyId, text };
}

export interface DigestPreferencesInput {
  enabled: boolean;
}

export function parseDigestPreferencesInput(body: unknown): DigestPreferencesInput {
  const b = (body || {}) as Record<string, unknown>;
  return { enabled: b.enabled === true };
}

// Only a plan NAME, checked against a hardcoded whitelist — the Stripe price id itself is
// resolved server-side from env (modules/billing/plans.ts), never accepted from the client. A
// checkout request must never be able to supply its own priceId/amount/quantity/coupon: this is
// the one input-validation function in this file whose job is partly security (plan escalation),
// not just shape-checking.
export const CHECKOUT_PLANS = ["pro"] as const;
export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

export interface CheckoutInput {
  plan: CheckoutPlan;
}

export function parseCheckoutInput(body: unknown): CheckoutInput {
  const b = (body || {}) as Record<string, unknown>;
  const plan = b.plan;
  if (typeof plan !== "string" || !CHECKOUT_PLANS.includes(plan as CheckoutPlan)) {
    throw new HttpError(400, `Invalid plan: "${String(plan)}"`, null, "UNKNOWN_PLAN");
  }
  return { plan: plan as CheckoutPlan };
}

export const JOB_SEARCH_REGIONS = ["all", "ua", "remote"] as const;
export type JobSearchRegion = (typeof JOB_SEARCH_REGIONS)[number];

export interface SavedSearchInput {
  query: string;
  region: JobSearchRegion;
  label: string;
}

/** A job alert (saved search) — create only, no partial/update variant (the client only ever
 * deletes and re-creates one, there's no "edit" UI for an existing alert). */
export function parseSavedSearchInput(body: unknown): SavedSearchInput {
  const b = (body || {}) as Record<string, unknown>;
  const query = asString(b.query).trim().slice(0, 200);
  if (!query) throw new HttpError(400, 'Field "query" is required');
  const region = asString(b.region, "all");
  if (!JOB_SEARCH_REGIONS.includes(region as JobSearchRegion)) throw new HttpError(400, `Invalid region: "${region}"`);
  return { query, region: region as JobSearchRegion, label: asString(b.label).trim().slice(0, 120) };
}

export const CALENDAR_EVENT_TYPES = ["interview", "call", "deadline", "reminder", "other"] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

/** A full timestamp (not just a date — calendar events carry a time-of-day), normalized to ISO
 * via Date round-tripping so downstream string comparisons (repo range filters) are consistent
 * regardless of what shape the client sent (`Z`, `+00:00`, no offset, ...). */
function toIsoDateTime(value: unknown, field: string): string {
  const raw = asString(value).trim();
  if (!raw) throw new HttpError(400, `Field "${field}" is required`);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Field "${field}" must be a valid date/time`);
  return d.toISOString();
}

/** Same as toIsoDateTime, but an empty/missing value means "not set" (e.g. `endAt`) instead of an error. */
function toIsoDateTimeOrNull(value: unknown, field: string): string | null {
  const raw = asString(value).trim();
  if (!raw) return null;
  return toIsoDateTime(raw, field);
}

export interface CalendarEventInput {
  title?: string;
  notes?: string;
  startAt?: string;
  endAt?: string | null;
  type?: CalendarEventType;
  meetingUrl?: string;
  vacancyId?: number | null;
  contactId?: number | null;
}

/**
 * Parses a manual calendar event (create or partial update — see `{ partial }`, same shape as
 * parseVacancyInput). `vacancyId` is only range/shape-checked here (a positive integer or null);
 * confirming it actually belongs to the caller is the repository/service's job (it needs a DB
 * lookup), not this pure parsing layer.
 */
export function parseCalendarEventInput(body: unknown, { partial = false }: { partial?: boolean } = {}): CalendarEventInput {
  const b = (body || {}) as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const out: CalendarEventInput = {};
  if (!partial || has("title")) out.title = asString(b.title).trim().slice(0, 200);
  if (!partial || has("notes")) out.notes = asString(b.notes).slice(0, 5000);
  if (!partial || has("startAt")) out.startAt = toIsoDateTime(b.startAt, "startAt");
  if (!partial || has("endAt")) out.endAt = toIsoDateTimeOrNull(b.endAt, "endAt");
  if (!partial || has("type")) {
    const type = asString(b.type, "other");
    if (!CALENDAR_EVENT_TYPES.includes(type as CalendarEventType)) throw new HttpError(400, `Invalid type: "${type}"`);
    out.type = type as CalendarEventType;
  }
  // toUrl (http(s) only, same helper as contacts.linkedinUrl) rather than a free-text field: this
  // value is rendered as an href, so a "javascript:" or "data:" one must be rejected at the edge
  // rather than trusted to whatever renders it. Empty means "no call link", not an error.
  if (!partial || has("meetingUrl")) out.meetingUrl = b.meetingUrl ? toUrl(b.meetingUrl, "meetingUrl") : "";
  if (!partial || has("vacancyId")) {
    if (b.vacancyId == null || b.vacancyId === "") {
      out.vacancyId = null;
    } else {
      const n = Number(b.vacancyId);
      if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "vacancyId" must be a positive integer');
      out.vacancyId = n;
    }
  }
  // Same shape-only check as vacancyId above (and the same division of labour: ownership is the
  // route's job) — e.g. "coffee chat with this recruiter".
  if (!partial || has("contactId")) {
    if (b.contactId == null || b.contactId === "") {
      out.contactId = null;
    } else {
      const n = Number(b.contactId);
      if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Field "contactId" must be a positive integer');
      out.contactId = n;
    }
  }
  return out;
}

const DESIGN_NODE_KINDS = [
  "client",
  "loadBalancer",
  "service",
  "database",
  "cache",
  "queue",
  "cdn",
  "storage",
  "thirdParty",
  "generic",
] as const;
type DesignNodeKind = (typeof DESIGN_NODE_KINDS)[number];
// Bounds how large a diagram (and therefore how big a grade/help prompt) a single request can
// produce — clamped here AND again by design.service.ts's own callers, same "belt and suspenders"
// as parseInterviewTurnInput's maxTurns above.
const MAX_DESIGN_NODES = 40;
const MAX_DESIGN_EDGES = 80;
// Freeform pen/shape/arrow/text annotations (see design.service.ts's DesignAnnotation comment for
// why these never reach the grading prompt) — capped the same "belt and suspenders" way as the
// node/edge counts above, plus their own point-count cap since a single pen stroke can otherwise
// carry an unbounded number of points.
const MAX_DESIGN_ANNOTATIONS = 60;
const MAX_FREEHAND_POINTS = 500;
const DESIGN_ANNOTATION_KINDS = ["freehand", "rectangle", "ellipse", "arrow", "text"] as const;
type DesignAnnotationKind = (typeof DESIGN_ANNOTATION_KINDS)[number];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const DEFAULT_ANNOTATION_COLOR = "#4338ca";

export interface DesignGenerateTaskInput {
  vacancyId: number | null;
}

/** POST /design/task body — an optional vacancy to bias the generated task toward (see
 * design.service.ts's buildVacancyDesignContext). Absent/0 means a general task. */
export function parseDesignGenerateTaskInput(body: unknown): DesignGenerateTaskInput {
  const b = (body || {}) as Record<string, unknown>;
  return { vacancyId: parseOptionalVacancyId(b.vacancyId) };
}

export interface DesignTaskInput {
  title: string;
  scenario: string;
  requirements: string[];
  constraints: string[];
  difficulty: "easy" | "medium" | "hard";
}

// The client resends the whole task it was given (POST /design/grade and /design/help are
// stateless, like /mock/interview) — re-validated/clamped here rather than trusted, since it
// flows straight into an LLM prompt.
function parseDesignTask(raw: unknown): DesignTaskInput {
  const b = (raw || {}) as Record<string, unknown>;
  const difficulty = asString(b.difficulty, "medium");
  return {
    title: asString(b.title).trim().slice(0, 200),
    scenario: asString(b.scenario).slice(0, 2000),
    requirements: toStringArray(b.requirements, "requirements").slice(0, 20),
    constraints: toStringArray(b.constraints, "constraints").slice(0, 20),
    difficulty: (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium") as DesignTaskInput["difficulty"],
  };
}

type DesignAnnotationBaseInput = { id: string; color: string; rotation?: number };
export type DesignAnnotationInput =
  | (DesignAnnotationBaseInput & { kind: "freehand"; points: { x: number; y: number }[] })
  | (DesignAnnotationBaseInput & { kind: "rectangle" | "ellipse"; x: number; y: number; width: number; height: number })
  | (DesignAnnotationBaseInput & {
      kind: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      startNodeId?: string;
      endNodeId?: string;
    })
  | (DesignAnnotationBaseInput & { kind: "text"; x: number; y: number; text: string });

/** Wraps any incoming rotation into [0, 360) — an out-of-range or garbage value becomes a
 * harmless 0/equivalent angle rather than being rejected, since annotations are decorative and a
 * bad one shouldn't 400 the whole diagram save. */
function parseRotation(raw: unknown): number {
  const deg = asNumber(raw) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/** `nodeIds` is the set of node ids that survived parsing above — an arrow bound to a node that
 * isn't in this diagram (stale client state, hand-crafted payload) keeps its coordinates and
 * simply loses the binding, rather than throwing the way a structural edge to an unknown node
 * does: the binding is a drawing convenience, not a claim about the diagram's structure. */
function parseDesignAnnotation(item: unknown, i: number, nodeIds: Set<string>): DesignAnnotationInput | null {
  const it = (item || {}) as Record<string, unknown>;
  const id = asString(it.id).trim().slice(0, 100) || `annotation-${i}`;
  const rawKind = asString(it.kind);
  if (!DESIGN_ANNOTATION_KINDS.includes(rawKind as DesignAnnotationKind)) return null;
  const kind = rawKind as DesignAnnotationKind;
  const rawColor = asString(it.color);
  const color = HEX_COLOR_RE.test(rawColor) ? rawColor : DEFAULT_ANNOTATION_COLOR;
  const rotation = parseRotation(it.rotation);
  const base = rotation ? { id, color, rotation } : { id, color };
  switch (kind) {
    case "freehand": {
      const rawPoints = Array.isArray(it.points) ? it.points : [];
      const points = rawPoints
        .slice(0, MAX_FREEHAND_POINTS)
        .map((p) => ({ x: asNumber((p as Record<string, unknown>)?.x), y: asNumber((p as Record<string, unknown>)?.y) }));
      return points.length < 2 ? null : { ...base, kind: "freehand", points };
    }
    case "rectangle":
    case "ellipse":
      return { ...base, kind, x: asNumber(it.x), y: asNumber(it.y), width: asNumber(it.width), height: asNumber(it.height) };
    case "arrow": {
      const startNodeId = asString(it.startNodeId).trim();
      const endNodeId = asString(it.endNodeId).trim();
      return {
        ...base,
        kind: "arrow",
        x1: asNumber(it.x1),
        y1: asNumber(it.y1),
        x2: asNumber(it.x2),
        y2: asNumber(it.y2),
        ...(nodeIds.has(startNodeId) ? { startNodeId } : {}),
        ...(nodeIds.has(endNodeId) ? { endNodeId } : {}),
      };
    }
    case "text":
      return { ...base, kind: "text", x: asNumber(it.x), y: asNumber(it.y), text: asString(it.text).slice(0, 500) };
  }
}

export interface DesignDiagramInput {
  nodes: { id: string; kind: DesignNodeKind; label: string; x: number; y: number }[];
  edges: { id: string; source: string; target: string; label?: string }[];
  annotations: DesignAnnotationInput[];
}

/** Also reused directly by companies.routes.ts's PUT /companies/:id/diagram — same shape, same
 * size caps, whether the diagram is part of a grading request or saved standalone on a company. */
export function parseDesignDiagramInput(raw: unknown): DesignDiagramInput {
  const b = (raw || {}) as Record<string, unknown>;
  if (b.nodes != null && !Array.isArray(b.nodes)) throw new HttpError(400, 'Field "nodes" must be an array');
  if (b.edges != null && !Array.isArray(b.edges)) throw new HttpError(400, 'Field "edges" must be an array');
  if (b.annotations != null && !Array.isArray(b.annotations)) throw new HttpError(400, 'Field "annotations" must be an array');
  const nodes = ((b.nodes as unknown[]) || []).slice(0, MAX_DESIGN_NODES).map((item, i) => {
    const it = (item || {}) as Record<string, unknown>;
    const id = asString(it.id).trim().slice(0, 100);
    if (!id) throw new HttpError(400, `Node ${i} is missing an id`);
    const kind = asString(it.kind, "generic");
    return {
      id,
      kind: (DESIGN_NODE_KINDS.includes(kind as DesignNodeKind) ? kind : "generic") as DesignNodeKind,
      label: asString(it.label).trim().slice(0, 80),
      x: asNumber(it.x),
      y: asNumber(it.y),
    };
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = ((b.edges as unknown[]) || []).slice(0, MAX_DESIGN_EDGES).map((item, i) => {
    const it = (item || {}) as Record<string, unknown>;
    const id = asString(it.id).trim().slice(0, 100) || `edge-${i}`;
    const source = asString(it.source).trim();
    const target = asString(it.target).trim();
    if (!nodeIds.has(source) || !nodeIds.has(target)) throw new HttpError(400, `Edge ${i} references an unknown node`);
    const label = asString(it.label).trim().slice(0, 60);
    return label ? { id, source, target, label } : { id, source, target };
  });
  const annotations = ((b.annotations as unknown[]) || [])
    .slice(0, MAX_DESIGN_ANNOTATIONS)
    .map((item, i) => parseDesignAnnotation(item, i, nodeIds))
    .filter((a): a is DesignAnnotationInput => a != null);
  return { nodes, edges, annotations };
}

export interface DesignGradeInput {
  task: DesignTaskInput;
  diagram: DesignDiagramInput;
}

/** POST /design/grade body — see design.service.ts's gradeDesign(). */
export function parseDesignGradeInput(body: unknown): DesignGradeInput {
  const b = (body || {}) as Record<string, unknown>;
  return { task: parseDesignTask(b.task), diagram: parseDesignDiagramInput(b.diagram) };
}

export interface DesignHelpInput {
  task: DesignTaskInput;
  diagram: DesignDiagramInput;
  question: string;
}

/** POST /design/help body — see design.service.ts's helpWithDesign(). */
export function parseDesignHelpInput(body: unknown): DesignHelpInput {
  const b = (body || {}) as Record<string, unknown>;
  const question = asString(b.question).trim().slice(0, 500);
  if (!question) throw new HttpError(400, 'Field "question" is required');
  return { task: parseDesignTask(b.task), diagram: parseDesignDiagramInput(b.diagram), question };
}

export interface DesignDefenseInput {
  task: DesignTaskInput;
  diagram: DesignDiagramInput;
  transcript: { q: string; a: string }[];
  maxTurns: number;
}

/** POST /design/defense body — see design.service.ts's runDefenseTurn(). Stateless, like
 * /mock/interview: `transcript` is the whole discussion so far, capped defensively since its
 * length directly gates how many chatJson calls a single request can trigger downstream. */
export function parseDesignDefenseInput(body: unknown): DesignDefenseInput {
  const b = (body || {}) as Record<string, unknown>;
  if (b.transcript != null && !Array.isArray(b.transcript)) throw new HttpError(400, 'Field "transcript" must be an array');
  const transcript = ((b.transcript as unknown[]) || []).slice(0, 10).map((item, i) => {
    const it = (item || {}) as Record<string, unknown>;
    if (typeof it.q !== "string" || typeof it.a !== "string")
      throw new HttpError(400, `Transcript entry ${i} must have string "q" and "a"`);
    return { q: it.q.trim().slice(0, 600), a: it.a.trim().slice(0, 2000) };
  });
  // Clamped here AND again in design.service.ts (belt and suspenders), same reasoning as
  // parseInterviewTurnInput's maxTurns above — this value gates chatJson call count.
  const maxTurns = Math.max(2, Math.min(4, Number(b.maxTurns) || 3));
  return { task: parseDesignTask(b.task), diagram: parseDesignDiagramInput(b.diagram), transcript, maxTurns };
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
