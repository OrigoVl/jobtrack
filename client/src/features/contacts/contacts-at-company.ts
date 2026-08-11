import type { Company, Contact, Vacancy } from "../../shared/types";

/** Company names are typed by hand in several places (the vacancy's own freeform `company`, a
 * Company row's `name`), so matching them needs more than `===`: case, surrounding whitespace and
 * a trailing legal suffix are all noise for "is this the same employer". Deliberately conservative
 * beyond that — no fuzzy/edit-distance matching, because a wrong match here would tell someone
 * they have an inside contact they don't actually have. */
const LEGAL_SUFFIX_RE = /[\s,]+(llc|ltd|inc|corp|corporation|gmbh|s\.?a\.?|b\.?v\.?|тов|фоп|пп)\.?$/i;

export function normalizeCompanyName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(LEGAL_SUFFIX_RE, "")
    .trim();
}

/**
 * Contacts the user already has at this vacancy's employer, excluding the ones already linked to
 * this vacancy (those render as the linked-contacts row right above). A contact linked to a
 * DIFFERENT vacancy at the same company is exactly the interesting case — the recruiter from a
 * previous application there — so those are kept.
 *
 * Two ways a contact counts as "at this company", in order of confidence:
 *   1. Both sides point at the same Company row (`companyId`) — structural, no guessing involved.
 *   2. The vacancy has no linked Company row, so its freeform `company` text is compared against
 *      the name of the Company row the contact points at.
 *
 * A contact with no `companyId` at all can never match: `contacts` has no free-text company field,
 * so there is genuinely nothing to compare against.
 */
export function contactsAtCompany(contacts: Contact[], vacancy: Vacancy, companies: Company[]): Contact[] {
  const vacancyCompanyName = normalizeCompanyName(vacancy.company);
  const companyNameById = new Map(companies.map((c) => [c.id, normalizeCompanyName(c.name)]));

  return contacts.filter((contact) => {
    if (contact.vacancyId === vacancy.id) return false;
    if (contact.companyId == null) return false;
    if (vacancy.companyId != null) return contact.companyId === vacancy.companyId;
    if (!vacancyCompanyName) return false;
    return companyNameById.get(contact.companyId) === vacancyCompanyName;
  });
}
