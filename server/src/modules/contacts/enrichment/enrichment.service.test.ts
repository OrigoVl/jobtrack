// Unit tests for the orchestration layer — enrichment-cache.js/telemetry.repo.js/config/env.js are
// mocked wholesale (same approach as billing.service.test.ts), and the provider registry is
// replaced with two synthetic keyed providers, letting every test control exactly what each one
// returns without touching a real network or DB.
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

vi.mock("./enrichment-providers.js", () => {
  const providers: EnrichmentProvider[] = [FAKE_A, FAKE_B];
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

  it("does not check the budget at all when the daily cap is disabled (0)", async () => {
    const env = (await import("../../../config/env.js")).env as { enrichment: { dailyLookups: number } };
    env.enrichment.dailyLookups = 0;
    const telemetry = await import("../../../telemetry/telemetry.repo.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(telemetry.countProductEventsToday).not.toHaveBeenCalled();
    env.enrichment.dailyLookups = 25;
  });

  it("fires one product event per provider that actually ran a live search", async () => {
    fakeASearch.mockResolvedValue([person()]);
    fakeBSearch.mockResolvedValue([]);
    const telemetry = await import("../../../telemetry/telemetry.repo.js");

    const { enrichContacts } = await import("./enrichment.service.js");
    await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    // Both, including the one that came back empty: the call was made and billed either way.
    expect(telemetry.insertProductEvent).toHaveBeenCalledTimes(2);
  });

  it("runs no provider at all once the daily budget is exhausted", async () => {
    // Every provider is paid now that the keyless fallback is gone, so a spent budget means the
    // whole call is a no-op rather than "the free one still answers".
    const telemetry = await import("../../../telemetry/telemetry.repo.js");
    vi.mocked(telemetry.countProductEventsToday).mockResolvedValue(25);

    const { enrichContacts } = await import("./enrichment.service.js");
    const result = await enrichContacts(BOOTSTRAP_USER_ID, BASE_QUERY);

    expect(fakeASearch).not.toHaveBeenCalled();
    expect(fakeBSearch).not.toHaveBeenCalled();
    expect(result.budgetExhausted).toBe(true);
    expect(result.results).toEqual([]);
    expect(result.providers).toEqual([]);
  });

  it("sets offline:true when no provider contributed a result", async () => {
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
