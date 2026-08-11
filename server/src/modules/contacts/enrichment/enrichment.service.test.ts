// Unit tests for the orchestration layer — enrichment-cache.js/telemetry.repo.js/config/env.js are
// mocked wholesale (same approach as billing.service.test.ts), and the provider registry itself
// is replaced with two synthetic "keyed" providers plus the REAL PATTERN_GUESS (imported for real,
// not mocked, so enrichContacts()'s `p === PATTERN_GUESS` identity check still holds) — this lets
// every test control exactly what each provider returns without touching a real network or DB.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../../db/user-id.js";
import type { EnrichedPerson, EnrichmentProvider } from "./enrichment-providers.js";

const { fakeASearch, fakeBSearch, FAKE_A, FAKE_B } = vi.hoisted(() => {
  const fakeASearch = vi.fn();
  const fakeBSearch = vi.fn();
  const FAKE_A = { name: "Fake A", requires: "domain" as const, creditsPerCall: 1, isAvailable: () => true, search: fakeASearch };
  const FAKE_B = { name: "Fake B", requires: "domain" as const, creditsPerCall: 1, isAvailable: () => true, search: fakeBSearch };
  return { fakeASearch, fakeBSearch, FAKE_A, FAKE_B };
});

vi.mock("../../../config/env.js", () => ({
  env: { enrichment: { dailyLookups: 25 } },
}));

vi.mock("../../../db/enrichment-cache.js", () => ({
  getEnrichmentCache: vi.fn(async () => null),
  setEnrichmentCache: vi.fn(async () => undefined),
}));

vi.mock("../../../telemetry/telemetry.repo.js", () => ({
  countProductEventsToday: vi.fn(async () => 0),
  insertProductEvent: vi.fn(async () => undefined),
}));

vi.mock("./enrichment-providers.js", async () => {
  const { PATTERN_GUESS } = await import("./providers/pattern-guess.js");
  const providers: EnrichmentProvider[] = [FAKE_A, FAKE_B, PATTERN_GUESS];
  return {
    ENRICHMENT_PROVIDERS: providers,
    activeProviders: (q: { domain: string }) => providers.filter((p) => p.isAvailable() && (p.requires === "companyName" || !!q.domain)),
  };
});

function person(overrides: Partial<EnrichedPerson> = {}): EnrichedPerson {
  return {
    name: "Jane Doe",
    title: "Recruiter",
    email: "jane@acme.com",
    emailStatus: "verified",
    linkedinUrl: "https://linkedin.com/in/janedoe",
    companyName: "Acme",
    source: "Fake",
    confidence: 50,
    revealId: "",
    ...overrides,
  };
}

const BASE_QUERY = { companyName: "Acme", domain: "acme.com", titles: ["recruiter"], personName: "", limit: 10 };

describe("enrichContacts()", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    fakeASearch.mockResolvedValue([]);
    fakeBSearch.mockResolvedValue([]);
    // vi.clearAllMocks() only resets call history, not a custom mockImplementation() set by an
    // earlier test — reassign the default (miss/zero) implementations explicitly so every test
    // starts from the same clean slate.
    const cache = await import("../../../db/enrichment-cache.js");
    vi.mocked(cache.getEnrichmentCache).mockResolvedValue(null);
    vi.mocked(cache.setEnrichmentCache).mockResolvedValue(undefined);
    const telemetry = await import("../../../telemetry/telemetry.repo.js");
    vi.mocked(telemetry.countProductEventsToday).mockResolvedValue(0);
    vi.mocked(telemetry.insertProductEvent).mockResolvedValue(undefined);
  });

  it("dedupes across providers by (linkedinUrl||email||name|title), keeping the FIRST registry-order occurrence", async () => {
    fakeASearch.mockResolvedValue([person({ source: "Fake A", confidence: 60, linkedinUrl: "https://linkedin.com/in/dup" })]);
    fakeBSearch.mockResolvedValue([person({ source: "Fake B", confidence: 90, linkedinUrl: "https://linkedin.com/in/dup" })]);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    const dupResults = result.results.filter((r) => r.linkedinUrl === "https://linkedin.com/in/dup");
    expect(dupResults).toHaveLength(1);
    expect(dupResults[0]!.source).toBe("Fake A");
  });

  it("keeps every guessed address for one person — a LinkedIn SEARCH url is not an identity", async () => {
    // pattern-guess stamps the same search deep link on all three of its guesses; keying dedupe on
    // it collapsed them into a single row.
    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, { ...BASE_QUERY, personName: "Jane Doe" });

    const guessed = result.results.filter((r) => r.source === "Pattern guess");
    expect(guessed).toHaveLength(3);
    expect(new Set(guessed.map((r) => r.email)).size).toBe(3);
  });

  it("still keeps the keyless fallback row, whose search url is all the identity it has", async () => {
    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, { ...BASE_QUERY, domain: "" });

    expect(result.results.filter((r) => r.source === "Pattern guess")).toHaveLength(1);
  });

  it("sorts merged results by confidence descending and slices to the query limit", async () => {
    fakeASearch.mockResolvedValue([
      person({ email: "low@acme.com", linkedinUrl: "", confidence: 20 }),
      person({ email: "high@acme.com", linkedinUrl: "", confidence: 90 }),
    ]);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, { ...BASE_QUERY, limit: 1 });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.email).toBe("high@acme.com");
  });

  it("uses a per-provider cache hit instead of calling search(), and never fires a paid product event for it", async () => {
    const cache = await import("../../../db/enrichment-cache.js");
    // Only stub a cache hit for the FIRST cache lookup performed (Fake A, registry order) —
    // simplest way to give exactly one provider a hit without depending on internal key format.
    let call = 0;
    vi.mocked(cache.getEnrichmentCache).mockImplementation(async () => (call++ === 0 ? [person({ email: "cached@acme.com" })] : null));

    const telemetry = await import("../../../telemetry/telemetry.repo.js");
    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(fakeASearch).not.toHaveBeenCalled();
    const summaryA = result.providers.find((p) => p.name === "Fake A")!;
    expect(summaryA.cached).toBe(true);
    expect(summaryA.count).toBe(1);
    expect(telemetry.insertProductEvent).not.toHaveBeenCalledWith(
      BOOTSTRAP_USER_ID,
      "contact_enrich_paid",
      expect.objectContaining({ provider: "Fake A" }),
    );
  });

  it("never caches an empty search result", async () => {
    fakeASearch.mockResolvedValue([]);
    const cache = await import("../../../db/enrichment-cache.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(cache.setEnrichmentCache).not.toHaveBeenCalled();
  });

  it("caches a non-empty freshly-fetched keyed-provider result", async () => {
    fakeASearch.mockResolvedValue([person()]);
    const cache = await import("../../../db/enrichment-cache.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(cache.setEnrichmentCache).toHaveBeenCalledWith(expect.any(String), [person()]);
  });

  it("fires one product event per keyed provider that actually ran a live search, never for pattern-guess", async () => {
    fakeASearch.mockResolvedValue([person()]);
    fakeBSearch.mockResolvedValue([]);
    const telemetry = await import("../../../telemetry/telemetry.repo.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(telemetry.insertProductEvent).toHaveBeenCalledWith(
      BOOTSTRAP_USER_ID,
      "contact_enrich_paid",
      expect.objectContaining({ provider: "Fake A" }),
    );
    expect(telemetry.insertProductEvent).toHaveBeenCalledWith(
      BOOTSTRAP_USER_ID,
      "contact_enrich_paid",
      expect.objectContaining({ provider: "Fake B" }),
    );
    expect(telemetry.insertProductEvent).not.toHaveBeenCalledWith(
      BOOTSTRAP_USER_ID,
      "contact_enrich_paid",
      expect.objectContaining({ provider: "Pattern guess" }),
    );
  });

  it("skips every keyed provider (but still runs pattern-guess) once the daily budget is exhausted", async () => {
    const telemetry = await import("../../../telemetry/telemetry.repo.js");
    vi.mocked(telemetry.countProductEventsToday).mockResolvedValue(25);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(fakeASearch).not.toHaveBeenCalled();
    expect(fakeBSearch).not.toHaveBeenCalled();
    expect(result.budgetExhausted).toBe(true);
    expect(result.providers.map((p) => p.name)).toEqual(["Pattern guess"]);
    expect(result.results.length).toBeGreaterThan(0); // pattern-guess still contributes its keyless fallback row
  });

  it("does not check the budget at all when the daily cap is disabled (0)", async () => {
    const env = (await import("../../../config/env.js")).env as { enrichment: { dailyLookups: number } };
    env.enrichment.dailyLookups = 0;
    const telemetry = await import("../../../telemetry/telemetry.repo.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(telemetry.countProductEventsToday).not.toHaveBeenCalled();
    env.enrichment.dailyLookups = 25;
  });

  it("sets offline:true when only pattern-guess contributed a result", async () => {
    fakeASearch.mockResolvedValue([]);
    fakeBSearch.mockResolvedValue([]);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(result.offline).toBe(true);
  });

  it("sets offline:false when a keyed provider contributed a result", async () => {
    fakeASearch.mockResolvedValue([person()]);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(result.offline).toBe(false);
  });
});
