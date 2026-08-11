// Registry of third-party contact-enrichment providers — mirrors modules/jobs/job-sources.ts's
// JOB_SOURCES pattern almost exactly: one place to add/remove a provider instead of hand-
// duplicating a `Promise.all` in every call site.
//
// OPERATOR-HELD KEYS: every provider below authenticates with a single API key/secret configured
// by the operator (server/.env), NOT a per-user "bring your own key" credential. This was an
// explicit, informed product decision — Hunter/Apollo/Snov license their people-data to the key
// holder, and jobtrack re-serving that data to its own end users under one shared operator key is
// a ToS/redistribution grey area (worst for Apollo/Snov, whose terms are stricter about
// redistribution than Hunter's). This was flagged to the product owner and accepted anyway;
// revisit if a provider starts actively enforcing this.
import { HUNTER } from "./providers/hunter.js";
import { APOLLO } from "./providers/apollo.js";
import { SNOV } from "./providers/snov.js";

export interface EnrichmentQuery {
  companyName: string;
  domain: string; // "" when unknown
  titles: string[]; // e.g. ["recruiter","talent acquisition","technical recruiter"] — default set if caller passes none
  personName: string; // "" unless doing a targeted person lookup
  limit: number; // clamp 1..25
}

export interface EnrichedPerson {
  name: string;
  title: string;
  email: string; // "" if not returned/locked
  emailStatus: "verified" | "unverified" | "guessed" | "locked";
  linkedinUrl: string;
  companyName: string;
  source: string; // provider.name, for UI attribution — never translated
  confidence: number; // 0..100
  revealId: string; // "" unless this row needs a paid reveal call (Apollo)
}

export interface EnrichmentProvider {
  name: string;
  requires: "domain" | "companyName";
  creditsPerCall: number;
  isAvailable(): boolean; // reads env.enrichment.* only
  search(q: EnrichmentQuery): Promise<EnrichedPerson[]>; // never throws
  /** Only implemented by providers with a locked-email reveal step (Apollo). */
  reveal?(revealId: string): Promise<{ email: string; emailStatus: EnrichedPerson["emailStatus"] }>;
}

// Order is load-bearing, not cosmetic (same reasoning as job-sources.ts's JOB_SOURCES): the dedupe
// walk in enrichment.service.ts keeps the FIRST provider to contribute a given person, so this
// order encodes which provider "wins" a duplicate.
//
// Every entry is a paid, keyed provider, so with no key configured — the default, and this app's
// deliberate standing choice — this registry contributes nothing at all. That is not a degraded
// mode to fix: exact contacts come from posting-contacts.ts, which reads what a posting itself
// states. The keyless email-pattern guesser that used to sit at the end of this list was removed
// along with the rest of the guessing.
export const ENRICHMENT_PROVIDERS: EnrichmentProvider[] = [HUNTER, APOLLO, SNOV];

export function activeProviders(q: EnrichmentQuery): EnrichmentProvider[] {
  return ENRICHMENT_PROVIDERS.filter((p) => p.isAvailable() && (p.requires === "companyName" || !!q.domain));
}
