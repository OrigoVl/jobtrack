// Orchestrates a single contact-enrichment lookup across the provider registry
// (enrichment-providers.ts) — mirrors modules/jobs/job-sources.ts's fan-out shape (Promise.all
// over a registry, dedupe by a stable key, first-registry-order wins), plus per-provider caching
// (db/enrichment-cache.ts) and a daily paid-lookup budget (product_events) so a burst of calls
// can't blow through paid API credits.
import { hashString } from "../../../shared/hash.js";
import { toDomain } from "../../../shared/domain.js";
import { env } from "../../../config/env.js";
import { getEnrichmentCache, setEnrichmentCache } from "../../../db/enrichment-cache.js";
import { countProductEventsToday, insertProductEvent } from "../../../telemetry/telemetry.repo.js";
import type { UserId } from "../../../db/user-id.js";
import {
  ENRICHMENT_PROVIDERS,
  activeProviders,
  type EnrichedPerson,
  type EnrichmentProvider,
  type EnrichmentQuery,
} from "./enrichment-providers.js";
import { PATTERN_GUESS } from "./providers/pattern-guess.js";

export interface EnrichmentResult {
  query: { companyName: string; domain: string; titles: string[] };
  results: EnrichedPerson[];
  providers: { name: string; used: boolean; cached: boolean; count: number }[];
  /** true when NO keyed provider actually contributed a result this call (only pattern-guess did) —
   * either because no provider is configured, or every configured provider returned nothing. */
  offline: boolean;
  /** true when today's per-user paid-lookup cap (env.enrichment.dailyLookups) blocked the keyed
   * providers from even being tried this call — pattern-guess still ran. */
  budgetExhausted: boolean;
}

const PAID_LOOKUP_EVENT = "contact_enrich_paid";
const MAX_TITLES = 5;

/** Dedupe identity for one result row, most-to-least specific: LinkedIn profile → email →
 * name|title. A LinkedIn *search* deep link (what pattern-guess returns when it has no profile to
 * point at) describes a QUERY, not a person, so it can't act as an identity — every guessed
 * address for the same person carries the identical search URL, and keying on it collapsed all of
 * them into a single row. It stays as the last-resort key so the keyless "company only" fallback
 * row, which has nothing else, still survives the walk. */
function identityKey(person: EnrichedPerson): string {
  const profileUrl = person.linkedinUrl.includes("/search/") ? "" : person.linkedinUrl;
  const nameTitle = person.name || person.title ? `${person.name}|${person.title}` : "";
  return (profileUrl || person.email || nameTitle || person.linkedinUrl).toLowerCase();
}

function normalizeQuery(q: EnrichmentQuery): EnrichmentQuery {
  return {
    companyName: (q.companyName || "").trim().slice(0, 200),
    domain: toDomain(q.domain || ""),
    titles: Array.from(new Set((q.titles || []).map((t) => t.trim()).filter(Boolean))).slice(0, MAX_TITLES),
    personName: (q.personName || "").trim().slice(0, 200),
    limit: Math.max(1, Math.min(25, Math.floor(q.limit || 10))),
  };
}

function cacheKeyFor(provider: EnrichmentProvider, q: EnrichmentQuery): string {
  return hashString(
    `enrich:v1|${provider.name}|${q.domain}|${q.companyName}|${q.titles.slice().sort().join(",")}|${q.personName}|${q.limit}`,
  );
}

export async function enrichContacts(userId: UserId, rawQuery: EnrichmentQuery): Promise<EnrichmentResult> {
  const q = normalizeQuery(rawQuery);

  const dailyCap = env.enrichment.dailyLookups;
  let budgetExhausted = false;
  if (dailyCap > 0) {
    const usedToday = await countProductEventsToday(userId, PAID_LOOKUP_EVENT);
    budgetExhausted = usedToday >= dailyCap;
  }

  const candidates = activeProviders(q);
  // Budget exhausted → skip every keyed provider entirely this call (still run pattern-guess, the
  // zero-cost fallback).
  const providersToRun = budgetExhausted ? candidates.filter((p) => p === PATTERN_GUESS) : candidates;

  const cacheKeyByProvider = new Map<EnrichmentProvider, string>(providersToRun.map((p) => [p, cacheKeyFor(p, q)]));

  const cacheLookups = await Promise.all(
    providersToRun.map(async (p) => [p, await getEnrichmentCache<EnrichedPerson[]>(cacheKeyByProvider.get(p)!)] as const),
  );
  const cachedByProvider = new Map(cacheLookups);

  const toFetch = providersToRun.filter((p) => cachedByProvider.get(p) == null);
  const fetchedResults = await Promise.all(toFetch.map((p) => p.search(q)));
  const fetchedByProvider = new Map(toFetch.map((p, i) => [p, fetchedResults[i] ?? []]));

  // Cache every non-empty freshly-fetched KEYED-provider result — never cache an empty array (a
  // transient provider outage/rate-limit shouldn't get "frozen" as a 7-day-long false miss), and
  // never cache pattern-guess (deterministic and free to recompute — caching it would only add DB
  // load for no benefit).
  await Promise.all(
    toFetch
      .filter((p) => p !== PATTERN_GUESS)
      .map(async (p) => {
        const result = fetchedByProvider.get(p) ?? [];
        if (result.length > 0) await setEnrichmentCache(cacheKeyByProvider.get(p)!, result);
      }),
  );

  // One product event per KEYED provider that actually made a live call this request — not per
  // cache hit, not for pattern-guess. This is exactly what countProductEventsToday() above counts
  // toward the daily budget.
  await Promise.all(
    toFetch
      .filter((p) => p !== PATTERN_GUESS)
      .map((p) => insertProductEvent(userId, PAID_LOOKUP_EVENT, { provider: p.name, domain: q.domain, companyName: q.companyName })),
  );

  function resultsFor(p: EnrichmentProvider): EnrichedPerson[] {
    return cachedByProvider.get(p) ?? fetchedByProvider.get(p) ?? [];
  }

  const providerSummaries = providersToRun.map((p) => {
    const results = resultsFor(p);
    return { name: p.name, used: results.length > 0, cached: cachedByProvider.get(p) != null, count: results.length };
  });

  // Dedupe across providers in REGISTRY order (not providersToRun's own order) — same "first
  // occurrence wins" rule as job-sources.ts's fetchAllSourcesDetailed, walking the canonical list
  // so the winner is always determined by ENRICHMENT_PROVIDERS' declared order. See identityKey()
  // for what counts as "the same person".
  const seen = new Set<string>();
  const merged: EnrichedPerson[] = [];
  for (const p of ENRICHMENT_PROVIDERS) {
    if (!providersToRun.includes(p)) continue;
    for (const person of resultsFor(p)) {
      const key = identityKey(person);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(person);
    }
  }
  merged.sort((a, b) => b.confidence - a.confidence);
  const results = merged.slice(0, q.limit);

  const offline = !providerSummaries.some((s) => s.name !== PATTERN_GUESS.name && s.count > 0);

  return {
    query: { companyName: q.companyName, domain: q.domain, titles: q.titles },
    results,
    providers: providerSummaries,
    offline,
    budgetExhausted,
  };
}
