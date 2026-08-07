// Hunter.io domain-search — the simplest of the three keyed providers: a single GET returns
// already-resolved emails directly, no separate "reveal" step needed (unlike Apollo).
import { env } from "../../../../config/env.js";
import { fetchJsonAuthed } from "../enrichment-http.js";
import type { EnrichedPerson, EnrichmentProvider, EnrichmentQuery } from "../enrichment-providers.js";

interface HunterEmail {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
  confidence?: number;
  verification?: { status?: string };
}
interface HunterResponse {
  data?: { emails?: HunterEmail[] };
}

export const HUNTER: EnrichmentProvider = {
  name: "Hunter.io",
  requires: "domain",
  creditsPerCall: 1,
  isAvailable: () => !!env.enrichment.hunterApiKey,
  async search(q: EnrichmentQuery): Promise<EnrichedPerson[]> {
    const apiKey = env.enrichment.hunterApiKey;
    if (!apiKey || !q.domain) return [];
    const url =
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(q.domain)}` +
      `&department=hr&limit=${q.limit}&api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetchJsonAuthed<HunterResponse>("Hunter.io", url);
    const emails = res?.data?.emails ?? [];
    return emails.map((e) => ({
      name: [e.first_name, e.last_name].filter(Boolean).join(" "),
      title: e.position || "",
      email: e.value || "",
      emailStatus: e.verification?.status === "valid" ? "verified" : "unverified",
      linkedinUrl: e.linkedin || "",
      companyName: q.companyName,
      source: "Hunter.io",
      confidence: typeof e.confidence === "number" ? e.confidence : 0,
      revealId: "",
    }));
  },
};
