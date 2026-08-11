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
    const linkedinUrl = linkedinSearchUrl((q.personName ? `${q.personName} ${q.companyName}` : `recruiter ${q.companyName}`).trim());
    // Guessing an address needs BOTH a name and a domain — guessEmails() returns [] if either is
    // missing, which must NOT become an empty search result: a named person at an unknown domain
    // would then lose even the LinkedIn deep link the same query returns without a name.
    const guesses = guessEmails(q.personName, q.domain).slice(0, 3);
    if (guesses.length === 0) {
      // Nothing to guess against — still return a single, zero-cost row so the feature is useful
      // with the bare minimum input (just a company name, or a name without a known domain).
      return [
        {
          name: q.personName,
          title: "",
          email: "",
          emailStatus: "guessed",
          linkedinUrl,
          companyName: q.companyName,
          source: "Pattern guess",
          confidence: 10,
          revealId: "",
        },
      ];
    }
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
  },
};
