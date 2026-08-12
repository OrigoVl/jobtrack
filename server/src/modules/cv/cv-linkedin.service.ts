// LinkedIn profile optimizer (Phase 9) — generates a headline + "About" section from the
// candidate's own profile (skills/domain/CV text). No LinkedIn API integration (that needs
// OAuth/partner approval) — this only produces text the user copies into their own profile
// themselves. Same offline-fallback shape as every other AI feature in this app.
import { z } from "zod";
import { chatJson, llmAvailable, quoteUntrustedText } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Profile } from "../../db/types.js";
import { LANGUAGE_NAME, type AppLocale } from "../../shared/locale.js";
import { auditLinkedInProfile, type LinkedInAudit, type LinkedInMarketContext } from "./linkedin-market.js";
import type { CvDoc } from "./cv.schemas.js";

// LinkedIn's own hard limits: the headline field stops accepting input at 220 characters and the
// About section at 2600. They're the schema's max() (not just a line in the prompt) on purpose —
// an over-long field is unusable, it silently truncates on paste, and chatJson() turns a schema
// miss into an automatic repair retry that asks the model to shorten it.
const LINKEDIN_HEADLINE_MAX = 220;
const LINKEDIN_ABOUT_MAX = 2600;

const LinkedInOptimizeSchema = z.object({
  headline: z.string().min(1).max(LINKEDIN_HEADLINE_MAX),
  about: z.string().min(1).max(LINKEDIN_ABOUT_MAX),
});

/** One blob per user, so a `user_kv` row rather than a table (this repo's default for exactly this
 * shape — no child rows, no ordering, nothing else references it by id). */
export const LINKEDIN_SAVED_KEY = "linkedinProfile";

const SavedLinkedInProfileSchema = z.object({
  current: z.object({ headline: z.string(), about: z.string() }),
  headline: z.string(),
  about: z.string(),
  savedAt: z.string(),
});
export type SavedLinkedInProfile = z.infer<typeof SavedLinkedInProfileSchema>;

/** Re-validated on every read, same "schema is the migration point" convention cv.schemas.ts uses
 * for the CV document — a blob written by an older shape reads back as "nothing saved yet" instead
 * of throwing on a page load. */
export function parseSavedLinkedInProfile(value: unknown): SavedLinkedInProfile | null {
  const parsed = SavedLinkedInProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export interface LinkedInOptimizeResult {
  headline: string;
  about: string;
  /** The candidate's own skills, ordered for LinkedIn's Skills section by what their tracked
   * vacancies ask for — deterministic, so it's identical with or without an LLM. */
  skills: string[];
  /** Job titles for LinkedIn's "Open to work" — the roles they're really applying to. */
  targetRoles: string[];
  /** Scored review of the profile the candidate pasted in, or null when they pasted nothing. */
  audit: LinkedInAudit | null;
  /** False when the vacancy tracker is empty, i.e. `skills`/`targetRoles` are just profile data
   * and the UI shouldn't present them as market insight. */
  marketAware: boolean;
  offline: boolean;
}

/** Copy for the offline (no-LLM) profile, one variant per app locale — same reasoning as
 * writing.service.ts's offline cover letter: a Ukrainian-UI user getting an English template back
 * reads as the feature being broken. The Ukrainian text is deliberately gender-neutral (the
 * profile has no gender to agree with). */
const OFFLINE_COPY: Record<AppLocale, { defaultRole: string; about: (role: string, skills: string) => string }> = {
  en: {
    defaultRole: "Specialist",
    about: (role, skills) =>
      `${role} with hands-on experience${skills ? ` in ${skills}` : ""}. ` +
      `Focused on delivering measurable results and continuously growing my skill set. ` +
      `Open to new opportunities where I can contribute and keep learning.`,
  },
  uk: {
    defaultRole: "Спеціаліст",
    about: (role, skills) =>
      `${role} з практичним досвідом${skills ? ` у ${skills}` : ""}. ` +
      `Зосереджуюсь на вимірюваних результатах і постійно розвиваю свої навички. ` +
      `Розглядаю нові можливості, де зможу принести користь і продовжити навчатися.`,
  },
};

/** Trims to LinkedIn's limit on a word boundary. Only the offline path needs this — the LLM path
 * gets the same limits enforced by the Zod schema above, which retries instead of truncating. */
function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/**
 * What the LLM gets to write prose FROM. Prefers the pasted/uploaded résumé text, and falls back
 * to flattening the CV Builder document — without that fallback a user who built their CV in the
 * Builder and never pasted raw text hands the optimizer nothing but a skills list.
 */
export function cvSourceText(profile: Profile, doc: CvDoc | null): string {
  const pasted = (profile.cvText || "").trim();
  if (pasted) return pasted;
  if (!doc) return "";
  const experience = doc.experience
    .slice(0, 6)
    .map((e) => [[e.role, e.company, e.period].filter(Boolean).join(" · "), ...e.bullets.slice(0, 6)].join("\n"))
    .join("\n\n");
  return [doc.title, doc.summary, experience, doc.skills.join(", ")].filter((part) => part && part.trim()).join("\n\n");
}

/** Templated, deterministic — no LLM required. Mirrors the shape of other offline fallbacks in
 * this codebase (e.g. cv-analysis.service.ts, roadmap.routes.ts) rather than returning nothing.
 * The market-ranked skills/roles below are NOT part of the fallback: they're computed the same way
 * either side of the llmAvailable() branch, since no LLM was ever involved in producing them. */
function offlineLinkedInOptimize(profile: Profile, language: AppLocale, context: LinkedInMarketContext): LinkedInOptimizeResult {
  const copy = OFFLINE_COPY[language];
  const role = context.targetRoles[0] || profile.domain?.trim() || copy.defaultRole;
  // Offline, the market ranking is the only "intelligence" available — so the headline leads with
  // the skills the tracked vacancies actually ask for rather than the profile's arbitrary order.
  const topSkills = (context.rankedSkills.length ? context.rankedSkills : profile.skills).slice(0, 3);
  const headline = topSkills.length ? `${role} | ${topSkills.join(" · ")}` : role;
  const skillsList = (context.rankedSkills.length ? context.rankedSkills : profile.skills).slice(0, 6).join(", ");
  return {
    headline: capAtWord(headline, LINKEDIN_HEADLINE_MAX),
    about: capAtWord(copy.about(role, skillsList), LINKEDIN_ABOUT_MAX),
    skills: context.rankedSkills,
    targetRoles: context.targetRoles,
    audit: null,
    marketAware: context.marketAware,
    offline: true,
  };
}

/**
 * `language` is the language of the GENERATED profile, chosen explicitly by the user rather than
 * derived from anything — deliberately not `chat()`'s `outputLocale`, which follows the UI locale.
 * The two genuinely differ here: which language a LinkedIn profile should be written in depends on
 * the market the candidate is targeting, not on which language they read this app in, and unlike a
 * cover letter (which follows the vacancy's language) there's no posting text here to infer it
 * from. The route defaults it to the UI locale as the best available first guess.
 */
export async function optimizeLinkedInProfile(
  userId: UserId,
  profile: Profile,
  language: AppLocale,
  context: LinkedInMarketContext,
  input: { doc: CvDoc | null; current: { headline: string; about: string } | null },
): Promise<LinkedInOptimizeResult> {
  // The audit scores what the candidate ALREADY has, so it's independent of whether the rewrite
  // below came from the LLM or the offline template — computed once, up front, either way.
  const audit = input.current ? auditLinkedInProfile(input.current, context) : null;
  if (!llmAvailable()) return { ...offlineLinkedInOptimize(profile, language, context), audit };
  const role = context.targetRoles[0] || profile.domain?.trim() || "specialist";
  const out = await chatJson(
    userId,
    `You are a career coach who writes concise, effective LinkedIn profiles. Write the profile in ${LANGUAGE_NAME[language]}. Respond ONLY with valid JSON.`,
    `Role: ${role}. Skills: ${context.rankedSkills.join(", ") || profile.skills.join(", ") || "—"}.\n` +
      // The whole point of doing this inside a job tracker rather than a generic chat: the profile
      // is aimed at the postings this candidate is actually applying to, not at their job title in
      // the abstract. Omitted entirely when the tracker is empty, so the model isn't told to
      // optimize for "—".
      (context.targetRoles.length ? `Roles this candidate is actually applying to: ${context.targetRoles.join(", ")}.\n` : "") +
      (context.headlineKeywords.length
        ? `Keywords those postings ask for and this candidate genuinely has — work the most relevant ones in naturally, never as a keyword list: ${context.headlineKeywords.join(", ")}.\n`
        : "") +
      (input.current?.headline || input.current?.about
        ? `${quoteUntrustedText("THE CANDIDATE'S CURRENT LINKEDIN PROFILE (rewrite it — keep what's specific and true, cut filler)", `${input.current.headline}\n\n${input.current.about}`.slice(0, 3000))}\n`
        : "") +
      `CV text (may be empty, use if present): ${cvSourceText(profile, input.doc).slice(0, 3000)}\n\n` +
      `Write:\n` +
      `1. A LinkedIn headline — role + top strengths, at most ${LINKEDIN_HEADLINE_MAX} characters (LinkedIn's hard limit), no hashtags, no emoji spam.\n` +
      `2. A LinkedIn "About" section — 3-5 short paragraphs, first-person, focused on impact/skills/what you're looking for, no buzzword filler, at most ${LINKEDIN_ABOUT_MAX} characters (LinkedIn's hard limit).\n` +
      `Format strictly: {"headline":"...","about":"..."}`,
    LinkedInOptimizeSchema,
    // No cache, for the same reason writing.routes.ts's cover letter doesn't cache: "Generate"
    // doubles as this feature's only regenerate affordance, and a content-hashed cache key made
    // from an unchanged profile meant every re-click returned the byte-identical profile back —
    // the button looked broken and the temperature below bought nothing.
    { maxTokens: 700, temperature: 0.6, tier: "smart", feature: "linkedin-optimize" },
  );
  if (!out) return { ...offlineLinkedInOptimize(profile, language, context), audit };
  return {
    ...out,
    skills: context.rankedSkills,
    targetRoles: context.targetRoles,
    audit,
    marketAware: context.marketAware,
    offline: false,
  };
}
