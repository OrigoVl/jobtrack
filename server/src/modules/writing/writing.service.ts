import type { Profile } from "../../db/types.js";
import type { AppLocale } from "../../shared/locale.js";

/** Copy for the offline (no-LLM) cover letter, one variant per app locale. The letter is
 * assembled from the caller's own profile, so unlike the LLM path — which follows the VACANCY's
 * language (see writing.routes.ts) — there's no posting text to take a language cue from here:
 * the UI locale is the only signal available, and a Ukrainian-UI user getting an English
 * template back reads as the feature being broken rather than as a deliberate choice. */
const COPY: Record<
  AppLocale,
  {
    greeting: string;
    intro: (role: string, company: string) => string;
    withSkills: (skills: string, domain: string) => string;
    withDomain: (domain: string) => string;
    withoutBackground: string;
    closing: string;
    signOff: string;
  }
> = {
  en: {
    greeting: "Hello!",
    // `role` is empty when the profile has no domain set — "your vacancy" rather than the
    // "your the role vacancy" this used to produce from a "the role" placeholder.
    intro: (role, company) => `I'm interested in your ${role ? `${role} ` : ""}vacancy${company ? ` at ${company}` : ""}.`,
    withSkills: (skills, domain) => `I have hands-on experience with ${skills}${domain ? ` as a ${domain} professional` : ""}.`,
    withDomain: (domain) => `I bring a background in ${domain}.`,
    withoutBackground: "I'd welcome the opportunity to bring my background to this role.",
    closing: "I'd be glad to discuss in more detail how I can help.",
    signOff: "Best regards",
  },
  uk: {
    greeting: "Вітаю!",
    intro: (role, company) => `Мене зацікавила ваша вакансія${role ? ` ${role}` : ""}${company ? ` у компанії ${company}` : ""}.`,
    // Deliberately gender-neutral throughout — the profile has no gender to agree with, and a
    // masculine default ("буду радий", "корисним") would misgender half the users.
    withSkills: (skills, domain) => `Маю практичний досвід роботи з ${skills}${domain ? ` у сфері ${domain}` : ""}.`,
    withDomain: (domain) => `Маю досвід у сфері ${domain}.`,
    withoutBackground: "Хочу застосувати свій досвід саме на цій позиції.",
    closing: "Із задоволенням обговорю деталі та розповім більше про свій досвід.",
    signOff: "З повагою",
  },
};

/** The deterministic cover letter served when no LLM is configured — built from the profile
 * alone, so it's the same shape as the LLM path's output (intro → background → closing) minus
 * anything that would need the vacancy text. `extraDetails` is the candidate's own freeform
 * guidance: there's no model here to act on it, so it's appended verbatim as a paragraph they
 * can edit into place rather than silently dropped. */
export function buildOfflineCoverLetter(
  profile: Profile,
  company: string,
  extraDetails: string,
  matchedSkills: string[],
  locale: AppLocale,
): string {
  const copy = COPY[locale];
  const domain = profile.domain || "";
  const highlights = (matchedSkills.length ? matchedSkills : profile.skills).slice(0, 5);
  const background = highlights.length
    ? copy.withSkills(highlights.join(", "), domain)
    : domain
      ? copy.withDomain(domain)
      : copy.withoutBackground;
  return (
    `${copy.greeting}\n\n${copy.intro(domain, company)} ${background} ${copy.closing}` +
    (extraDetails ? `\n\n${extraDetails}` : "") +
    `\n\n${copy.signOff}`
  );
}
