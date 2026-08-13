// Line-by-line CV audit: the shared vocabulary (what a finding IS and where it points), the
// deterministic rule engine, and the one function that applies a finding back to the document.
//
// The shape here is deliberately modelled on how a good human/agent résumé audit actually reads —
// a verdict per LINE with a ready replacement ("REWRITE this bullet → that bullet"), not a score
// plus a paragraph of advice. That's what makes it actionable: every finding carries a stable
// ADDRESS into the structured CvDoc, so the UI can offer one click to apply it.
//
// Two producers feed the same pipeline and the same UI:
//   - `ruleFindings()` below — mechanical, provable, and available with no LLM key at all.
//   - the server's cv-audit.service.ts — judgement calls (positioning, credibility, merges) that
//     genuinely need a model, and which is told NOT to re-report what the rules already caught.
import type { CvDoc, CvExperience } from "../../../shared/types";
import { themeOf } from "./cv-doc-utils";

/** What the audit says should happen to a line — the same vocabulary a written résumé audit uses. */
export type AuditVerdict = "rewrite" | "delete" | "merge" | "add" | "keep";
export type AuditSeverity = "high" | "medium" | "low";

/**
 * A stable address into the document. Every finding carries one, which is what lets "apply" be a
 * single deterministic edit rather than a fuzzy search-and-replace over the CV's text — the same
 * bullet text can legitimately appear under two jobs, so matching on content alone would edit the
 * wrong one.
 */
export type AuditTarget =
  | { kind: "title" }
  | { kind: "summary" }
  | { kind: "location" }
  | { kind: "links" }
  | { kind: "experience"; exp: number }
  | { kind: "expRole"; exp: number }
  | { kind: "expPeriod"; exp: number }
  | { kind: "expNote"; exp: number }
  | { kind: "bullet"; exp: number; bullet: number }
  | { kind: "education"; index: number }
  | { kind: "theme" };

/** Rule ids. The UI resolves each to a localized title/explanation, so the engine itself stays
 * free of copy and the two locales can't drift out of sync with the logic. */
export type AuditRule =
  | "missingLocation"
  | "currentRoleNotPresent"
  | "yearsMismatch"
  | "clicheOpener"
  | "linkUrlsNotInText"
  | "atsRiskTemplate"
  | "noSeniorityInTitle"
  | "entryWithoutBullets"
  | "unquantifiedJob"
  | "overlongBullet"
  | "inconsistentRoleCaps"
  | "universityTypo";

export interface AuditFinding {
  /** Stable across re-runs (derived from rule/target, never from array position alone) so a
   * dismissal sticks to the finding it was made about rather than to "whatever is third today". */
  id: string;
  target: AuditTarget;
  verdict: AuditVerdict;
  severity: AuditSeverity;
  source: "rule" | "ai";
  /** Set on rule findings — the UI looks up localized copy for it. */
  rule?: AuditRule;
  /** Set on AI findings, already in the user's language (the prompt runs with outputLocale "app"). */
  title?: string;
  reason?: string;
  /** The current text, for the before→after display. */
  before?: string;
  /** The proposed replacement. A finding WITHOUT this is diagnostic only — the UI shows it and
   * jumps to the field, but offers no Apply button, because there's nothing to apply. */
  after?: string;
  /** For a "merge": the other bullet index, folded into `target`'s bullet and then removed. */
  mergeWith?: number;
}

/** Which editor section a finding's address belongs to — lets every audit row double as a "take me
 * there" jump, the same affordance ResumeCompleteness's missing-items list already provides. Lives
 * here rather than beside the panel so that file only exports components (fast refresh). */
export type AuditJumpTarget = "general" | "experience" | "education" | "design";

export function jumpTargetFor(target: AuditTarget): AuditJumpTarget {
  switch (target.kind) {
    case "title":
    case "summary":
    case "location":
    case "links":
      return "general";
    case "education":
      return "education";
    case "theme":
      return "design";
    default:
      return "experience";
  }
}

/** Rules whose fix is purely mechanical — safe to apply in bulk without reading each one. An
 * `after` that rewrites prose (or anything the LLM wrote) is deliberately excluded: those are
 * judgement calls the candidate should actually look at. */
const MECHANICAL_RULES: ReadonlySet<AuditRule> = new Set<AuditRule>([
  "currentRoleNotPresent",
  "linkUrlsNotInText",
  "inconsistentRoleCaps",
  "universityTypo",
  "atsRiskTemplate",
]);

export function isMechanical(f: AuditFinding): boolean {
  return f.source === "rule" && !!f.rule && MECHANICAL_RULES.has(f.rule) && (f.after !== undefined || f.target.kind === "theme");
}

// ---------------------------------------------------------------------------
// Period parsing
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
  // Ukrainian, in the forms the CV Builder's own date text actually gets typed in.
  січ: 0,
  лют: 1,
  бер: 2,
  кві: 3,
  тра: 4,
  чер: 5,
  лип: 6,
  сер: 7,
  вер: 8,
  жов: 9,
  лис: 10,
  гру: 11,
};

/**
 * Words that mean "still working here", in both of the app's locales.
 *
 * Bounded with Unicode lookarounds, NOT `\b`: JavaScript's `\b` is ASCII-only, so it never matches
 * between a space and "д" — with `\b` every Ukrainian word in this list was silently unmatchable,
 * and a Ukrainian CV's current role would always have read as one the candidate had left.
 */
const PRESENT_WORDS =
  /(?<![\p{L}\p{N}])(present|current|now|today|ongoing|теперішній час|дотепер|донині|наразі|по\s*теперішній|тепер)(?![\p{L}\p{N}])/iu;

export function isOngoing(period: string): boolean {
  return PRESENT_WORDS.test(period);
}

/** One endpoint of a period, as an absolute month index — comparable and subtractable. */
function parseEndpoint(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const year = s.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const y = Number(year[0]);
  const monthKey = Object.keys(MONTHS).find((m) => s.includes(m));
  const month = monthKey ? MONTHS[monthKey]! : 0;
  return y * 12 + month;
}

export interface ParsedPeriod {
  start: number | null;
  end: number | null;
  ongoing: boolean;
}

/**
 * Splits "Sep 2021 — Aug 2026" / "2019 - Present" / "Жов 2018 — Жов 2019" into endpoints.
 *
 * Accepts every dash people actually type (hyphen, en, em) plus "to"/"до", because this reads text
 * a human typed into a free-form field, not a date picker. An unparseable side comes back as null
 * rather than a guess — every caller below treats null as "no signal" and stays silent, which is
 * the right failure mode for something that tells the user their CV is wrong.
 */
export function parsePeriod(period: string): ParsedPeriod {
  const ongoing = isOngoing(period);
  // Same ASCII-`\b` trap as PRESENT_WORDS above — "2019 до 2021" never split, so both endpoints
  // resolved to the same year and every Ukrainian-typed period came out as zero-length.
  const parts = period.split(/\s*(?:[–—-]{1,2}|(?<![\p{L}\p{N}])(?:to|до)(?![\p{L}\p{N}]))\s*/iu).filter((p) => p.trim());
  if (parts.length === 0) return { start: null, end: null, ongoing };
  const start = parseEndpoint(parts[0]!);
  const end = ongoing ? null : parseEndpoint(parts[parts.length - 1] ?? "");
  return { start, end, ongoing };
}

/** Total career span in MONTHS, from the earliest start to the latest end across all roles.
 * Returns null when nothing parses — better to say nothing than to contradict the CV on a guess. */
export function careerSpanMonths(experience: CvExperience[], now = new Date()): number | null {
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  let earliest: number | null = null;
  let latest: number | null = null;
  for (const e of experience) {
    const { start, end, ongoing } = parsePeriod(e.period ?? "");
    if (start !== null && (earliest === null || start < earliest)) earliest = start;
    const effectiveEnd = ongoing ? nowIdx : end;
    if (effectiveEnd !== null && (latest === null || effectiveEnd > latest)) latest = effectiveEnd;
  }
  if (earliest === null || latest === null || latest < earliest) return null;
  return latest - earliest;
}

/**
 * How many years of experience the CV's own dates support — ROUNDED, not floored.
 *
 * Rounding is the honest reading of how people write this: 7 years 11 months is "8 years" to any
 * reader, and flooring it to 7 would have the audit telling a candidate their accurate claim
 * contradicts their dates. It also correctly catches the opposite case this was built for — 7
 * years 10 months stated as "7 years", which rounds to 8 and is genuinely underselling.
 */
export function careerSpanYears(experience: CvExperience[], now = new Date()): number | null {
  const months = careerSpanMonths(experience, now);
  return months === null ? null : Math.round(months / 12);
}

export interface YearsClaim {
  years: number;
  /** True for "8+ years" — a FLOOR, so more experience than stated isn't a contradiction. */
  atLeast: boolean;
}

/** The "N years of experience" claim the summary makes, if it makes one. */
export function claimedYears(summary: string): YearsClaim | null {
  const m = summary.match(/(\d{1,2})\s*(\+?)\s*(?:years?|yrs?|роки?в?|років)/i);
  return m ? { years: Number(m[1]), atLeast: m[2] === "+" } : null;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Openers that carry no information — the ones that show up in every résumé template. */
const CLICHE_OPENERS =
  /^\s*(results[-\s]?driven|motivated|passionate|hard[-\s]?working|detail[-\s]?oriented|dynamic|self[-\s]?starter|proactive|enthusiastic|dedicated|highly skilled|цілеспрямований|мотивований|відповідальний)/i;

const SENIORITY_WORDS = /\b(senior|lead|principal|staff|head|architect|founding|сеньйор|провідн|головн)\b/i;

/** Anything that reads as a real address rather than a bare word. */
const URL_LIKE = /[a-z0-9-]+\.[a-z]{2,}/i;

const ATS_RISK_TEMPLATES = new Set(["twocol", "sidebar"]);

/** Roughly the point past which a bullet stops being scannable in a six-second read. */
const MAX_BULLET_WORDS = 45;

/** Title Case a role, matching how the header states it — "Full stack developer" reads as sloppy
 * next to a header that says "Full Stack Developer". Small words stay lowercase. */
const MINOR_WORDS = new Set(["and", "or", "of", "the", "a", "an", "in", "at", "for", "to", "with"]);
function titleCaseRole(role: string): string {
  return role
    .split(/(\s+|\/)/)
    .map((tok, i) => {
      if (!/[a-z]/i.test(tok)) return tok;
      const lower = tok.toLowerCase();
      if (i > 0 && MINOR_WORDS.has(lower)) return lower;
      // Leaves an already-capitalized acronym ("QA", "iOS") alone rather than mangling it.
      if (tok.length > 1 && tok === tok.toUpperCase()) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
}

const NOW_FOR_TESTS = { now: new Date() };

/**
 * Every mechanical finding the app can make about a CV, with no LLM involved.
 *
 * Each rule here is something that can be PROVEN from the document — a date that contradicts a
 * claim, a URL that won't reach the text layer, a template that fragments the reading order. The
 * judgement calls ("is this positioned as senior?", "do these two bullets want merging?") are the
 * server's job; keeping them apart is what lets this half stay honest and instant.
 */
export function ruleFindings(doc: CvDoc, now: Date = NOW_FOR_TESTS.now): AuditFinding[] {
  const out: AuditFinding[] = [];
  const theme = themeOf(doc);
  const push = (f: Omit<AuditFinding, "source">) => out.push({ ...f, source: "rule" });

  // --- Contact -------------------------------------------------------------
  if (!(doc.location ?? "").trim()) {
    push({
      id: "rule:missingLocation",
      target: { kind: "location" },
      verdict: "add",
      severity: "high",
      rule: "missingLocation",
    });
  }

  const links = (doc.links ?? []).filter((l) => l.url.trim());
  // Only a finding when the label doesn't already contain the address — a link labelled
  // "github.com/x" is already in the text layer and needs nothing.
  if (links.length && theme.linkStyle !== "url" && theme.linkStyle !== "both" && links.some((l) => !URL_LIKE.test(l.label))) {
    push({
      id: "rule:linkUrlsNotInText",
      target: { kind: "theme" },
      verdict: "rewrite",
      severity: "high",
      rule: "linkUrlsNotInText",
      before: links.map((l) => l.label || l.url).join(" · "),
      after: links
        .map((l) =>
          l.url
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\/+$/, ""),
        )
        .join(" · "),
    });
  }

  // --- Dates ---------------------------------------------------------------
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  doc.experience.forEach((e, exp) => {
    const period = (e.period ?? "").trim();
    const { end, ongoing } = parsePeriod(period);
    // A role whose stated end is the current month (or later) but which doesn't SAY it's ongoing
    // reads to both a recruiter and a model as "already left" — the single most consequential
    // date defect, because it changes the candidate's apparent availability.
    if (!ongoing && end !== null && end >= nowIdx) {
      push({
        id: `rule:currentRoleNotPresent:${exp}`,
        target: { kind: "expPeriod", exp },
        verdict: "rewrite",
        severity: "high",
        rule: "currentRoleNotPresent",
        before: period,
        after: period.replace(/(\s*(?:[–—-]{1,2})\s*)[^–—-]*$/, "$1Present"),
      });
    }
  });

  const span = careerSpanYears(doc.experience, now);
  const claimed = claimedYears(doc.summary);
  // "8+" is a floor, so having MORE experience than stated isn't a contradiction — only fewer
  // years than claimed is. A plain "8 years" has to match what the dates round to, in either
  // direction: understating is the case this was built for (7y10m written as "7 years"), and
  // overstating is the one that costs credibility.
  if (span !== null && claimed !== null && (claimed.atLeast ? span < claimed.years : span !== claimed.years)) {
    push({
      id: "rule:yearsMismatch",
      target: { kind: "summary" },
      verdict: "rewrite",
      severity: "medium",
      rule: "yearsMismatch",
      before: `${claimed.years}`,
      after: `${span}`,
    });
  }

  // --- Prose ---------------------------------------------------------------
  if (doc.summary.trim() && CLICHE_OPENERS.test(doc.summary)) {
    push({
      id: "rule:clicheOpener",
      target: { kind: "summary" },
      verdict: "rewrite",
      severity: "medium",
      rule: "clicheOpener",
      // The offending phrase itself, straight from the match — precise enough for the UI to quote
      // back ("your summary opens with …") without dragging in the rest of the sentence.
      before: (doc.summary.match(CLICHE_OPENERS)?.[0] ?? "").trim(),
    });
  }

  if (doc.title.trim() && span !== null && span >= 6 && !SENIORITY_WORDS.test(doc.title)) {
    push({
      id: "rule:noSeniorityInTitle",
      target: { kind: "title" },
      verdict: "rewrite",
      severity: "medium",
      rule: "noSeniorityInTitle",
      before: doc.title.trim(),
      after: `Senior ${doc.title.trim()}`,
    });
  }

  // --- Experience entries --------------------------------------------------
  const headerCased = /[A-Z]/.test(doc.title) && doc.title === titleCaseRole(doc.title);
  doc.experience.forEach((e, exp) => {
    const bullets = e.bullets.filter((b) => b.trim());
    if (!bullets.length) {
      push({
        id: `rule:entryWithoutBullets:${exp}`,
        target: { kind: "experience", exp },
        verdict: "add",
        severity: "high",
        rule: "entryWithoutBullets",
        before: [e.role, e.company].filter(Boolean).join(" — "),
      });
    } else if (!bullets.some((b) => /\d/.test(b))) {
      // Judged per JOB, not per bullet: not every line needs a number, but a whole role without a
      // single one has nothing for a screener to hold onto.
      push({
        id: `rule:unquantifiedJob:${exp}`,
        target: { kind: "experience", exp },
        verdict: "rewrite",
        severity: "medium",
        rule: "unquantifiedJob",
        before: [e.role, e.company].filter(Boolean).join(" — "),
      });
    }

    bullets.forEach((b, i) => {
      if (b.trim().split(/\s+/).length > MAX_BULLET_WORDS) {
        push({
          id: `rule:overlongBullet:${exp}:${i}`,
          target: { kind: "bullet", exp, bullet: e.bullets.indexOf(b) },
          verdict: "rewrite",
          severity: "low",
          rule: "overlongBullet",
          before: b.trim(),
        });
      }
    });

    // Only worth raising when the header itself is consistently Title Cased — otherwise this is
    // just imposing a style the candidate didn't choose.
    const role = (e.role ?? "").trim();
    if (headerCased && role && /[a-z]/.test(role) && role !== titleCaseRole(role)) {
      push({
        id: `rule:inconsistentRoleCaps:${exp}`,
        target: { kind: "expRole", exp },
        verdict: "rewrite",
        severity: "low",
        rule: "inconsistentRoleCaps",
        before: role,
        after: titleCaseRole(role),
      });
    }
  });

  // --- Education -----------------------------------------------------------
  doc.education.forEach((ed, index) => {
    if (/polytechnical/i.test(ed.school)) {
      push({
        id: `rule:universityTypo:${index}`,
        target: { kind: "education", index },
        verdict: "rewrite",
        severity: "low",
        rule: "universityTypo",
        before: ed.school,
        after: ed.school.replace(/polytechnical/gi, (m) => (m[0] === "P" ? "Polytechnic" : "polytechnic")),
      });
    }
  });

  // --- Layout --------------------------------------------------------------
  if (ATS_RISK_TEMPLATES.has(theme.template)) {
    push({
      id: "rule:atsRiskTemplate",
      target: { kind: "theme" },
      verdict: "rewrite",
      severity: "medium",
      rule: "atsRiskTemplate",
      before: theme.template,
      after: "classic",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Applying a finding
// ---------------------------------------------------------------------------

/**
 * Whether an address still points at something that exists in this document.
 *
 * The AI findings are computed against a snapshot, and the user keeps editing afterwards — a
 * finding about "bullet 3 of job 2" has to disappear from the list once that bullet is gone,
 * rather than sit there offering to fix a line that has moved. `applyFinding` already refuses to
 * act on a stale address; this is what stops one being OFFERED in the first place.
 */
export function resolvesAgainst(target: AuditTarget, doc: CvDoc): boolean {
  switch (target.kind) {
    case "bullet":
      return !!doc.experience[target.exp]?.bullets[target.bullet];
    case "experience":
    case "expRole":
    case "expPeriod":
    case "expNote":
      return !!doc.experience[target.exp];
    case "education":
      return !!doc.education[target.index];
    default:
      return true;
  }
}

/**
 * Applies one finding, returning a NEW document — pure, so the caller keeps the previous value for
 * undo without this needing to know anything about undo.
 *
 * Returns the document unchanged when the finding has no `after` (diagnostic-only findings, which
 * the UI doesn't offer an Apply button for) or when its address no longer resolves — the document
 * can legitimately have been edited since the audit ran, and a stale index must be a no-op rather
 * than an edit to whatever now sits at that position.
 */
export function applyFinding(doc: CvDoc, f: AuditFinding): CvDoc {
  const after = f.after;
  const t = f.target;

  if (f.verdict === "delete") {
    if (t.kind === "bullet") {
      const e = doc.experience[t.exp];
      if (!e || !e.bullets[t.bullet]) return doc;
      return {
        ...doc,
        experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, bullets: x.bullets.filter((_, bi) => bi !== t.bullet) } : x)),
      };
    }
    return doc;
  }

  if (f.verdict === "merge" && t.kind === "bullet" && f.mergeWith !== undefined && after !== undefined) {
    const e = doc.experience[t.exp];
    if (!e || !e.bullets[t.bullet] || !e.bullets[f.mergeWith]) return doc;
    const drop = f.mergeWith;
    return {
      ...doc,
      experience: doc.experience.map((x, i) =>
        i === t.exp ? { ...x, bullets: x.bullets.map((b, bi) => (bi === t.bullet ? after : b)).filter((_, bi) => bi !== drop) } : x,
      ),
    };
  }

  if (after === undefined) return doc;

  switch (t.kind) {
    case "title":
      return { ...doc, title: after };
    case "summary":
      // The years rule carries just the two numbers rather than a rewritten sentence — replacing
      // the figure in place is a surgical fix that keeps the candidate's own wording intact.
      if (f.rule === "yearsMismatch" && f.before) {
        return { ...doc, summary: doc.summary.replace(new RegExp(`\\b${f.before}\\b`), after) };
      }
      return { ...doc, summary: after };
    case "location":
      return { ...doc, location: after };
    case "expRole": {
      if (!doc.experience[t.exp]) return doc;
      return { ...doc, experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, role: after } : x)) };
    }
    case "expPeriod": {
      if (!doc.experience[t.exp]) return doc;
      return { ...doc, experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, period: after } : x)) };
    }
    case "expNote": {
      if (!doc.experience[t.exp]) return doc;
      return { ...doc, experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, note: after } : x)) };
    }
    case "bullet": {
      const e = doc.experience[t.exp];
      if (!e) return doc;
      // An "add" targets a bullet slot that doesn't exist yet — append rather than no-op.
      if (f.verdict === "add") {
        return { ...doc, experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, bullets: [...x.bullets, after] } : x)) };
      }
      if (!e.bullets[t.bullet]) return doc;
      return {
        ...doc,
        experience: doc.experience.map((x, i) =>
          i === t.exp ? { ...x, bullets: x.bullets.map((b, bi) => (bi === t.bullet ? after : b)) } : x,
        ),
      };
    }
    case "experience": {
      // A whole-entry finding with a replacement means "add this bullet to the entry" — the
      // unquantified/no-bullets rules are the two that produce it.
      if (!doc.experience[t.exp]) return doc;
      return { ...doc, experience: doc.experience.map((x, i) => (i === t.exp ? { ...x, bullets: [...x.bullets, after] } : x)) };
    }
    case "education": {
      if (!doc.education[t.index]) return doc;
      return { ...doc, education: doc.education.map((x, i) => (i === t.index ? { ...x, school: after } : x)) };
    }
    case "links":
      return doc;
    case "theme": {
      const theme = themeOf(doc);
      if (f.rule === "linkUrlsNotInText") return { ...doc, theme: { ...theme, linkStyle: "url" } };
      if (f.rule === "atsRiskTemplate") return { ...doc, theme: { ...theme, template: "classic" } };
      return doc;
    }
    default:
      return doc;
  }
}

/** Applies many findings in one pass. Order matters: findings that REMOVE a bullet are applied
 * last and highest-index-first, so an earlier finding's stored index is still valid when it runs.
 * Without this, deleting bullet 1 would silently shift bullet 2 out from under the next finding. */
export function applyFindings(doc: CvDoc, findings: AuditFinding[]): CvDoc {
  const shifts = (f: AuditFinding) => f.verdict === "delete" || f.verdict === "merge";
  const stable = findings.filter((f) => !shifts(f));
  const shifting = findings.filter(shifts).sort((a, b) => {
    const ai = a.target.kind === "bullet" ? a.target.bullet : -1;
    const bi = b.target.kind === "bullet" ? b.target.bullet : -1;
    return bi - ai;
  });
  return [...stable, ...shifting].reduce(applyFinding, doc);
}
