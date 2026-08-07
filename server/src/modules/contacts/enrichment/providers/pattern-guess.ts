// The keyless fallback — always available, never costs a credit, always runs LAST in the registry
// (enrichment-providers.ts) so a real provider's result always wins a duplicate over a guess.
import { guessEmails } from "../email-patterns.js";
import type { EnrichedPerson, EnrichmentProvider, EnrichmentQuery } from "../enrichment-providers.js";

function linkedinSearchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export const PATTERN_GUESS: EnrichmentProvider = {
  name: "Pattern guess",
  requires: "companyName",
  creditsPerCall: 0,
  isAvailable: () => true,
  async search(q: EnrichmentQuery): Promise<EnrichedPerson[]> {
    if (q.personName) {
      const guesses = guessEmails(q.personName, q.domain).slice(0, 3);
      const linkedinUrl = linkedinSearchUrl(`${q.personName} ${q.companyName}`.trim());
      return guesses.map((g) => ({
        name: q.personName,
        title: "",
        email: g.email,
        emailStatus: "guessed",
        linkedinUrl,
        companyName: q.companyName,
        source: "Pattern guess",
        confidence: g.confidence,
        revealId: "",
      }));
    }
    // No target person and/or no domain to guess against — still return a single, zero-cost row
    // so the feature is useful even with the bare minimum input (just a company name).
    return [
      {
        name: "",
        title: "",
        email: "",
        emailStatus: "guessed",
        linkedinUrl: linkedinSearchUrl(`recruiter ${q.companyName}`.trim()),
        companyName: q.companyName,
        source: "Pattern guess",
        confidence: 10,
        revealId: "",
      },
    ];
  },
};
