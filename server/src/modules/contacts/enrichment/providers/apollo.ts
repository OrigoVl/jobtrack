// Apollo.io mixed-people search + reveal. Apollo's search endpoint returns a LOCKED placeholder
// for personal emails (not a real address) — a second, separately-billed "match" call is needed
// to get the real one, so this provider is the only one implementing `reveal()`.
import { env } from "../../../../config/env.js";
import { fetchJsonAuthed } from "../enrichment-http.js";
import type { EnrichedPerson, EnrichmentProvider, EnrichmentQuery } from "../enrichment-providers.js";

interface ApolloPerson {
  id?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  organization?: { name?: string };
}
interface ApolloSearchResponse {
  people?: ApolloPerson[];
}
interface ApolloMatchResponse {
  person?: { email?: string; email_status?: string };
}

const REAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Apollo's search response uses a non-address placeholder (something containing
 * "email_not_unlocked"/"not_unlocked") for a locked email — treat anything that doesn't look like
 * a real address, or is explicitly flagged non-"verified", as locked. */
function isLocked(person: Pick<ApolloPerson, "email" | "email_status">): boolean {
  const email = person.email ?? "";
  if (!email || !REAL_EMAIL_RE.test(email) || email.toLowerCase().includes("not_unlocked")) return true;
  return !!person.email_status && person.email_status !== "verified";
}

export const APOLLO: EnrichmentProvider = {
  name: "Apollo.io",
  // Assumption, not confirmed pricing: Apollo's search itself is typically free/cheap — the real
  // cost is in reveal() below. Revisit if Apollo starts metering search calls directly.
  creditsPerCall: 0,
  requires: "domain",
  isAvailable: () => !!env.enrichment.apolloApiKey,
  async search(q: EnrichmentQuery): Promise<EnrichedPerson[]> {
    const apiKey = env.enrichment.apolloApiKey;
    if (!apiKey || !q.domain) return [];
    const res = await fetchJsonAuthed<ApolloSearchResponse>("Apollo.io", "https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: JSON.stringify({ q_organization_domains_list: [q.domain], person_titles: q.titles, page: 1, per_page: q.limit }),
    });
    const people = res?.people ?? [];
    return people.map((p) => {
      const locked = isLocked(p);
      return {
        name: p.name || "",
        title: p.title || "",
        email: locked ? "" : p.email!,
        emailStatus: locked ? "locked" : "verified",
        linkedinUrl: p.linkedin_url || "",
        companyName: p.organization?.name || q.companyName,
        source: "Apollo.io",
        confidence: locked ? 40 : 70,
        revealId: locked ? p.id || "" : "",
      };
    });
  },
  async reveal(revealId: string): Promise<{ email: string; emailStatus: EnrichedPerson["emailStatus"] }> {
    const apiKey = env.enrichment.apolloApiKey;
    if (!apiKey || !revealId) return { email: "", emailStatus: "locked" };
    const res = await fetchJsonAuthed<ApolloMatchResponse>("Apollo.io", "https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: JSON.stringify({ id: revealId, reveal_personal_emails: true }),
    });
    const email = res?.person?.email ?? "";
    return email && REAL_EMAIL_RE.test(email) ? { email, emailStatus: "verified" } : { email: "", emailStatus: "locked" };
  },
};
