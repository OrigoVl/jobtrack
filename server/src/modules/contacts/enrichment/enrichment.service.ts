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

export interface EnrichmentResult {
  query: { companyName: string; domain: string; titles: string[] };
  results: EnrichedPerson[];
  providers: { name: string; used: boolean; cached: boolean; count: number }[];
  /** true when no provider contributed a result this call — either none is configured (the
   * default: this app ships with no enrichment key), or every configured one returned nothing. */
  offline: boolean;
  /** true when today's per-user paid-lookup cap (env.enrichment.dailyLookups) blocked every
   * provider from being tried this call. */
  budgetExhausted: boolean;
}

const PAID_LOOKUP_EVENT = "contact_enrich_paid";
const MAX_TITLES = 5;

/** Dedupe identity for one result row, most-to-least specific: LinkedIn profile → email →
 * name|title. A LinkedIn *search* deep link describes a QUERY, not a person, so it never counts as
 * an identity until nothing else can speak — several rows can legitimately share one search URL,
 * and keying on it collapsed them into a single row back when the keyless fallback emitted those. */
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

  // Every remaining provider is a paid, keyed one — the keyless pattern-guess fallback was removed
  // along with the rest of the guessing (posting-contacts.ts is the exact-only replacement), so a
  // spent budget now means nothing runs at all rather than "the free one still does".
  const providersToRun = budgetExhausted ? [] : activeProviders(q);

  const cacheKeyByProvider = new Map<EnrichmentProvider, string>(providersToRun.map((p) => [p, cacheKeyFor(p, q)]));

  const cacheLookups = await Promise.all(
    providersToRun.map(async (p) => [p, await getEnrichmentCache<EnrichedPerson[]>(cacheKeyByProvider.get(p)!)] as const),
  );
  const cachedByProvider = new Map(cacheLookups);

  const toFetch = providersToRun.filter((p) => cachedByProvider.get(p) == null);
  const fetchedResults = await Promise.all(toFetch.map((p) => p.search(q)));
  const fetchedByProvider = new Map(toFetch.map((p, i) => [p, fetchedResults[i] ?? []]));

  // Cache every non-empty freshly-fetched result — never an empty array, so a transient provider
  // outage/rate-limit doesn't get "frozen" as a 7-day-long false miss.
  await Promise.all(
    toFetch.map(async (p) => {
      const result = fetchedByProvider.get(p) ?? [];
      if (result.length > 0) await setEnrichmentCache(cacheKeyByProvider.get(p)!, result);
    }),
  );

  // One product event per provider that actually made a live call this request — not per cache
  // hit. This is exactly what countProductEventsToday() above counts toward the daily budget.
  await Promise.all(
    toFetch.map((p) => insertProductEvent(userId, PAID_LOOKUP_EVENT, { provider: p.name, domain: q.domain, companyName: q.companyName })),
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

  const offline = !providerSummaries.some((s) => s.count > 0);

  return {
    query: { companyName: q.companyName, domain: q.domain, titles: q.titles },
    results,
    providers: providerSummaries,
    offline,
    budgetExhausted,
  };
}
