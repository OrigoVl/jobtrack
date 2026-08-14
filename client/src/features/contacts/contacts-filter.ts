import type { Contact } from "../../shared/types";

export type ContactSortKey = "default" | "name" | "company" | "lastContact";

/**
 * The two fields a contact is most often looked up by — the company and the vacancy — aren't on
 * the row itself, only as ids, so the caller resolves them. That's precisely the search the card
 * grid couldn't answer ("the N-iX recruiter, whatever her name was"), which is why they're part
 * of the haystack rather than the component filtering on `name` alone.
 */
export interface ContactLookups {
  companyName: (id: number | null) => string;
  vacancyLabel: (id: number | null) => string;
}

/** Everything one contact is searchable by, lowercased once per row per keystroke. */
export function contactHaystack(c: Contact, lookups: ContactLookups): string {
  return [c.name, c.role, lookups.companyName(c.companyId), lookups.vacancyLabel(c.vacancyId), c.email, c.notes].join(" ").toLowerCase();
}

/** Filters + sorts client-side — same reasoning as vacancies-filter.ts: the whole list is already
 * loaded, so there's nothing to round-trip for. `sortBy: "default"` keeps the server's own order
 * instead of reshuffling before the user has touched a column header. */
export function filterAndSortContacts(
  contacts: Contact[],
  { search, sortBy, sortDir }: { search: string; sortBy: ContactSortKey; sortDir: "asc" | "desc" },
  lookups: ContactLookups,
): Contact[] {
  const q = search.trim().toLowerCase();
  const filtered = q ? contacts.filter((c) => contactHaystack(c, lookups).includes(q)) : contacts;
  if (sortBy === "default") return filtered;
  const dir = sortDir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "company":
        return dir * lookups.companyName(a.companyId).localeCompare(lookups.companyName(b.companyId));
      case "lastContact": {
        // Never-contacted rows stay at the bottom in BOTH directions. They aren't "the oldest
        // contact" — nobody has written to them at all (the same distinction stale-contacts.ts
        // draws), so letting "" sort as the smallest string would bury every real date under them.
        if (!a.lastContactAt || !b.lastContactAt) return (a.lastContactAt ? 0 : 1) - (b.lastContactAt ? 0 : 1);
        return dir * a.lastContactAt.localeCompare(b.lastContactAt);
      }
    }
  });
}
