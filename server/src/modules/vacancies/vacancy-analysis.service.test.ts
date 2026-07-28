// tryAutoEnrichStack() — best-effort auto-enrichment of a vacancy's stack from its link (called
// automatically when creating/updating a vacancy from a URL and on import — see vacancies.routes.ts).
// Key contract: it NEVER throws or blocks the caller — a host blocked by SSRF protection, a
// network error, or an empty page must all silently return null. We test the SSRF block
// (internal/local addresses) here separately from assertSafeVacancyUrl (validation.test.ts),
// because it's specifically tryAutoEnrichStack that guarantees "no network call".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

vi.mock("../../db/index.js", () => ({
  getProfile: vi.fn(async () => ({ skills: ["React"], cvText: "", domain: "" })),
  getKvJson: vi.fn(async () => null),
  setKvJson: vi.fn(async () => undefined),
}));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chat: vi.fn(),
}));
// quickAnalyze() (called by tryAutoEnrichStack) weighs fit by market demand — demand.ts hits
// the real SQLite db directly (not the ../../db/index.js mock above, which only stubs the
// three named exports this suite needs), so it's mocked separately here to keep this suite
// about URL fetching/SSRF/logging, not about demand-weighted fit scoring (covered in
// vacancy-text.test.ts instead).
vi.mock("../../shared/demand.js", () => ({ demandMap: vi.fn(async () => ({})) }));
const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { tryAutoEnrichStack } from "./vacancy-analysis.service.js";

describe("tryAutoEnrichStack()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockLog.debug.mockReset();
    mockLog.warn.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for an empty url without any network call", async () => {
    expect(await tryAutoEnrichStack(BOOTSTRAP_USER_ID, "")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null for a private/internal url without any network call (SSRF guard)", async () => {
    const result = await tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://169.254.169.254/latest/meta-data/");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // An SSRF block is an expected, deliberately "quiet" case: only debug, not warn/error (no noise).
    expect(mockLog.debug).toHaveBeenCalledOnce();
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it("fetches and analyzes the page text for a dou.ua vacancy url", async () => {
    const html = `<html><body>${"Looking for a Senior React TypeScript developer, Docker will be a plus. ".repeat(5)}</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });

    const result = await tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/acme/vacancies/1/");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result?.techs).toEqual(expect.arrayContaining(["React", "TypeScript", "Docker"]));
    expect(result?.match).toContain("React");
  });

  // The most important test for this change: a non-dou.ua host used to be blocked by the
  // allowlist before the network request even happened (assertSafeVacancyUrl) — now an
  // arbitrary public host (here: a stand-in for LinkedIn) passes the SSRF check successfully
  // and is analyzed the same way as jobs.dou.ua.
  it("fetches and analyzes the page text for an arbitrary public (non-dou.ua) vacancy url", async () => {
    const html = `<html><body>${"Looking for a Senior React TypeScript engineer, Docker is a plus. ".repeat(5)}</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });

    const result = await tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).not.toBeNull();
    expect(result?.techs).toEqual(expect.arrayContaining(["React", "TypeScript", "Docker"]));
  });

  it("returns null (without throwing) when the page request fails — and logs a warning with the url/status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/acme/vacancies/2/")).resolves.toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://jobs.dou.ua/companies/acme/vacancies/2/" }),
      expect.stringContaining("failed"),
    );
  });

  it("returns null (without throwing) when fetch rejects (network error/timeout) — and logs a warning", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    await expect(tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/acme/vacancies/3/")).resolves.toBeNull();
    expect(mockLog.warn).toHaveBeenCalledOnce();
  });

  it("returns null for a too-short/empty page — and logs a warning explaining why", async () => {
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve("<html><body>404</body></html>") });
    expect(await tryAutoEnrichStack(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/acme/vacancies/4/")).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ textLength: expect.any(Number) }),
      expect.stringContaining("too short"),
    );
  });
});
