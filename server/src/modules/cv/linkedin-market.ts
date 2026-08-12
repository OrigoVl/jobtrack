// The market-aware half of the LinkedIn optimizer: what this app knows that a generic AI chat
// doesn't — which roles this candidate is ACTUALLY applying to and which technologies those
// specific postings ask for. Deliberately pure and LLM-free: the ranking and the audit below are
// deterministic, so they're identical with or without an API key (the LLM only writes the prose
// in cv-linkedin.service.ts), and they can be unit-tested without mocking anything.

/** LinkedIn caps the Skills section at 50 entries and "Open to work" at 5 job titles. */
const LINKEDIN_SKILLS_MAX = 50;
const LINKEDIN_OPEN_TO_ROLES_MAX = 5;
/** How many demanded technologies are worth naming in a headline before it turns into a keyword
 * dump — the headline has 220 characters total and still needs to read like a sentence. */
const HEADLINE_KEYWORDS_MAX = 5;

export interface LinkedInMarketContext {
  /** The candidate's own skills, ordered by how much their tracked vacancies ask for each. */
  rankedSkills: string[];
  /** The role titles they're really applying to, most-tracked first. */
  targetRoles: string[];
  /** The subset of rankedSkills their tracked vacancies actually mention — the keywords a
   * recruiter searching for these roles would be typing. */
  headlineKeywords: string[];
  /** False when the tracker is empty, i.e. everything above is just profile data in original
   * order and the caller shouldn't claim the result is market-informed. */
  marketAware: boolean;
}

/** Groups equivalent role titles ("Senior  Backend Engineer " / "senior backend engineer") without
 * losing the original casing for display. */
function normalizeRole(role: string): string {
  return role.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * `demand` is shared/demand.ts's computeDemand() output (recency-weighted mention counts across
 * the user's tracked vacancies); `positions` is the raw `position` column of those same vacancies.
 */
export function buildMarketContext(skills: string[], demand: Record<string, number>, positions: string[]): LinkedInMarketContext {
  // A stable sort keyed on demand: skills the tracker never mentions keep their profile order at
  // the back rather than being dropped — they're still the candidate's skills, just not what this
  // particular job search is about.
  const rankedSkills = skills
    .map((skill, index) => ({ skill, index, weight: demand[skill] ?? 0 }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, LINKEDIN_SKILLS_MAX)
    .map((s) => s.skill);

  const roleCounts = new Map<string, { display: string; count: number }>();
  for (const position of positions) {
    const key = normalizeRole(position);
    if (!key) continue;
    const seen = roleCounts.get(key);
    if (seen) seen.count += 1;
    else roleCounts.set(key, { display: position.trim().replace(/\s+/g, " "), count: 1 });
  }
  const targetRoles = [...roleCounts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .slice(0, LINKEDIN_OPEN_TO_ROLES_MAX)
    .map((r) => r.display);

  const headlineKeywords = rankedSkills.filter((skill) => (demand[skill] ?? 0) > 0).slice(0, HEADLINE_KEYWORDS_MAX);

  return {
    rankedSkills,
    targetRoles,
    headlineKeywords,
    marketAware: targetRoles.length > 0 || headlineKeywords.length > 0,
  };
}

/** An About section shorter than this reads as an afterthought — LinkedIn shows roughly the first
 * three lines before "…see more", so anything that can't fill them wastes the slot entirely. */
const ABOUT_MIN_USEFUL = 300;
/** How many of the candidate's ranked skills the About section should name to actually surface in
 * recruiter keyword search. One is a mention; two-plus is a theme. */
const ABOUT_MIN_KEYWORDS = 2;

/** Stable identifiers, NOT display text — the client maps each to its own i18n key (see this
 * repo's rule about never translating a wire value). */
export type LinkedInAuditCheckId =
  | "headlinePresent"
  | "headlineWithinLimit"
  | "headlineHasKeyword"
  | "aboutPresent"
  | "aboutLongEnough"
  | "aboutWithinLimit"
  | "aboutHasKeywords";

export interface LinkedInAuditCheck {
  id: LinkedInAuditCheckId;
  ok: boolean;
}

export interface LinkedInAudit {
  /** 0-100, simply the share of checks passed — deliberately not a weighted "expert" score, since
   * every check below is a concrete pass/fail the user can see for themselves. */
  score: number;
  checks: LinkedInAuditCheck[];
}

const LINKEDIN_HEADLINE_MAX = 220;
const LINKEDIN_ABOUT_MAX = 2600;

/** Case-insensitive whole-ish match, so "node.js" in the profile counts for a "Node.js" skill but
 * "java" doesn't match inside "JavaScript". */
function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
}

/**
 * Scores the profile the candidate ALREADY has, against the market context above — the part that
 * makes this more than a text generator ("your headline names none of the 4 technologies your
 * tracked vacancies ask for"). Runs identically offline; the LLM never sees it.
 */
export function auditLinkedInProfile(current: { headline: string; about: string }, context: LinkedInMarketContext): LinkedInAudit {
  const headline = current.headline.trim();
  const about = current.about.trim();
  const headlineTerms = [...context.headlineKeywords, ...context.targetRoles];
  const checks: LinkedInAuditCheck[] = [
    { id: "headlinePresent", ok: headline.length > 0 },
    { id: "headlineWithinLimit", ok: headline.length > 0 && headline.length <= LINKEDIN_HEADLINE_MAX },
    // With an empty tracker there are no keywords to demand — the check passes rather than
    // punishing the candidate for something this app can't know yet.
    { id: "headlineHasKeyword", ok: headlineTerms.length === 0 || headlineTerms.some((term) => mentions(headline, term)) },
    { id: "aboutPresent", ok: about.length > 0 },
    { id: "aboutLongEnough", ok: about.length >= ABOUT_MIN_USEFUL },
    { id: "aboutWithinLimit", ok: about.length > 0 && about.length <= LINKEDIN_ABOUT_MAX },
    {
      id: "aboutHasKeywords",
      ok: context.rankedSkills.length === 0 || context.rankedSkills.filter((skill) => mentions(about, skill)).length >= ABOUT_MIN_KEYWORDS,
    },
  ];
  const passed = checks.filter((c) => c.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}
