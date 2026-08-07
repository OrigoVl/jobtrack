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
}));
// shared/skill-extraction.js's cache (called transitively via quickAnalyze -> extractSkills)
// reads/writes db/llm-cache.js directly, whose import chain would otherwise open a real
// Postgres connection pool (db/client.js) during this unit test.
vi.mock("../../db/llm-cache.js", () => ({
  getLlmCache: vi.fn(async () => null),
  setLlmCache: vi.fn(async () => undefined),
}));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chat: vi.fn(),
  chatJson: vi.fn(),
  quoteUntrustedText: vi.fn((label: string, text: string) => `[${label}]\n${text}`),
}));
// quickAnalyze() (called by tryAutoEnrichStack) weighs fit by market demand — demand.ts hits
// the real SQLite db directly (not the ../../db/index.js mock above, which only stubs the
// three named exports this suite needs), so it's mocked separately here to keep this suite
// about URL fetching/SSRF/logging, not about demand-weighted fit scoring (covered in
// vacancy-text.test.ts instead).
vi.mock("../../shared/demand.js", () => ({ demandMap: vi.fn(async () => ({})) }));
const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import { tryAutoEnrichStack, companyFromDouUrl, fetchVacancyDetails } from "./vacancy-analysis.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";

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

describe("companyFromDouUrl()", () => {
  it("title-cases a hyphenated company slug from a jobs.dou.ua vacancy url", () => {
    expect(companyFromDouUrl("https://jobs.dou.ua/companies/sharks-code/vacancies/123456/")).toBe("Sharks Code");
  });

  it("works without a trailing slash too", () => {
    expect(companyFromDouUrl("https://jobs.dou.ua/companies/acme/vacancies/1")).toBe("Acme");
  });

  it("returns null for a non-dou.ua url", () => {
    expect(companyFromDouUrl("https://www.linkedin.com/jobs/view/123456/")).toBeNull();
  });
});

// fetchVacancyDetails() — single-URL equivalent of the bulk import's per-link enrichment, powering
// the "+ Add vacancy" modal's "autofill from link" button. llmAvailable is mocked false in this
// suite (see the top-of-file mock), so extractTitleCompany always resolves null here — these
// tests only exercise the DOU-slug shortcut + quickAnalyze's stack/level/fit, not the LLM guess.
describe("fetchVacancyDetails()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pre-fills company from a dou.ua url's own slug even when the page can't be fetched", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/acme/vacancies/1/");
    // toMatchObject (not toEqual) — only asserts the fields this test is actually about; the
    // full VacancyDetails shape has grown other best-effort fields (salary/notes/company* facts)
    // since this test was written, all correctly "" / [] here since the page couldn't be fetched.
    expect(details).toMatchObject({ company: "Acme", position: "", level: "", stack: [], fit: "med" });
  });

  it("fills stack/level/fit from the fetched page for a non-dou.ua url, leaving company/position blank offline", async () => {
    const html = `<html><body>${"Looking for a Senior React TypeScript developer, Docker will be a plus. ".repeat(5)}</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.company).toBe("");
    expect(details.position).toBe("");
    expect(details.stack).toEqual(expect.arrayContaining(["React", "TypeScript", "Docker"]));
  });

  it("reads the salary straight off the page even offline, ignoring unrelated numbers", async () => {
    const html = `<html><body>${"Senior React developer wanted. ".repeat(10)} We have 1000+ engineers. Salary $2000-3000 per month.</body></html>`;
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(html) });
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.salary).toBe("$2000-3000");
    expect(details.notes).toBe("");
    expect(details.companyNotes).toBe("");
    expect(details.companyQuestions).toEqual([]);
  });
});

// The LLM-on half of the same function: the structured facts call and the prose summary call both
// run, and their results are merged onto the deterministic ones. Routed by prompt here because a
// single fetchVacancyDetails() makes three different chatJson() calls (skills, facts, summary).
describe("fetchVacancyDetails() with an LLM available", () => {
  const fetchMock = vi.fn();
  const PAGE = `<html><body><article>${"We build iGaming products with Vue.js 3, Nuxt (SSR), TypeScript, SCSS and Vite. ".repeat(4)}</article></body></html>`;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(PAGE) });
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockImplementation(async (_userId, system: string) => {
      if (system.includes("structured facts")) {
        return {
          company: "Guessed Group",
          position: "Front-end developer | Vue.js",
          level: "Senior",
          salary: "$1-2",
          location: "Kyiv",
          workMode: "hybrid",
          employmentType: "full-time",
          companyWebsite: "kinggroup.com",
        };
      }
      if (system.includes("job-search assistant")) {
        return {
          vacancyNotes: "Kyiv, hybrid.\nVue/Nuxt product team.",
          companyNotes: "iGaming product company.",
          questionsToAsk: ["How is the frontend team structured?"],
        };
      }
      return { skills: ["Vue.js", "SSRF", "React"] }; // extractSkills — includes a hallucination
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(llmAvailable).mockReturnValue(false);
    vi.mocked(chatJson).mockReset();
  });

  it("merges the prose summary into notes and the employer fields", async () => {
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.notes).toContain("Vue/Nuxt product team.");
    expect(details.companyNotes).toBe("iGaming product company.");
    expect(details.companyWebsite).toBe("kinggroup.com");
    expect(details.companyQuestions).toEqual(["How is the frontend team structured?"]);
    expect(details.position).toBe("Front-end developer | Vue.js");
  });

  it("sanitizes the LLM's skills — a hallucinated technology never reaches the stack", async () => {
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.stack).toContain("Vue");
    expect(details.stack).not.toContain("SSRF");
    expect(details.stack).not.toContain("React");
  });

  it("keeps a DOU url's slug-derived company rather than the LLM's guess", async () => {
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://jobs.dou.ua/companies/king-group/vacancies/1/");
    expect(details.company).toBe("King Group");
  });

  it("prefers the salary read verbatim off the page over the model's version", async () => {
    const withSalary = PAGE.replace("</article>", "Salary $2000-3000 per month.</article>");
    fetchMock.mockResolvedValue({ ok: true, text: () => Promise.resolve(withSalary) });
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.salary).toBe("$2000-3000");
  });

  it("falls back to the model's salary when the page states none in a parseable form", async () => {
    const details = await fetchVacancyDetails(BOOTSTRAP_USER_ID, "https://www.linkedin.com/jobs/view/123456/");
    expect(details.salary).toBe("$1-2");
  });
});
