// Snov.io OAuth2 client-credentials + domain email search. The access token is cached in a
// module-level singleton (not re-fetched on every search call) and refreshed only when within 60s
// of expiry — Snov's token TTL is long enough (typically ~1h) that fetching a fresh one per call
// would be wasteful and slower for no benefit.
import { env } from "../../../../config/env.js";
import { fetchJsonAuthed } from "../enrichment-http.js";
import type { EnrichedPerson, EnrichmentProvider, EnrichmentQuery } from "../enrichment-providers.js";

interface SnovTokenResponse {
  access_token?: string;
  expires_in?: number;
}
interface SnovEmailEntry {
  email?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  status?: string;
}
interface SnovDomainSearchResponse {
  emails?: SnovEmailEntry[];
  result?: SnovEmailEntry[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const snov = env.enrichment.snov;
  if (!snov) return null;
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.token;
  const res = await fetchJsonAuthed<SnovTokenResponse>("Snov.io", "https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    body: JSON.stringify({ grant_type: "client_credentials", client_id: snov.clientId, client_secret: snov.clientSecret }),
  });
  if (!res?.access_token) return null;
  const ttlMs = (res.expires_in ?? 3600) * 1000;
  cachedToken = { token: res.access_token, expiresAt: Date.now() + ttlMs };
  return cachedToken.token;
}

export const SNOV: EnrichmentProvider = {
  name: "Snov.io",
  requires: "domain",
  creditsPerCall: 1,
  isAvailable: () => !!env.enrichment.snov,
  async search(q: EnrichmentQuery): Promise<EnrichedPerson[]> {
    if (!env.enrichment.snov || !q.domain) return [];
    const token = await getAccessToken();
    if (!token) return [];
    // fetchJsonAuthed's own 8s timeout caps the total wait here — if Snov's domain-search ever
    // needs async polling in practice, this single call timing out (returning null) is the
    // ceiling; the overall Promise.all in enrichment.service.ts is never blocked significantly
    // longer than the other providers by this one.
    const res = await fetchJsonAuthed<SnovDomainSearchResponse>("Snov.io", "https://api.snov.io/v2/domain-emails-with-info", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain: q.domain, type: "personal", limit: q.limit }),
    });
    const entries = res?.emails ?? res?.result ?? [];
    return entries.map((e) => ({
      name: [e.firstName, e.lastName].filter(Boolean).join(" "),
      title: e.position || "",
      email: e.email || "",
      emailStatus: e.status === "valid" ? "verified" : "unverified",
      linkedinUrl: "",
      companyName: q.companyName,
      source: "Snov.io",
      confidence: e.status === "valid" ? 65 : 45,
      revealId: "",
    }));
  },
};
