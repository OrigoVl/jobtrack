// Regression test for logging around external aggregators (Remotive/Arbeitnow/DOU): any
// non-2xx response, network error, or invalid JSON used to be silently turned into an empty
// result (fetchRemotive/fetchArbeitnow/fetchDou returned []), with no log of the cause.
// If a source starts blocking/failing, /jobs/search would just silently return fewer vacancies —
// these tests pin down the contract "always log the failure reason before returning null/[]".
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock("../../core/logger.js", () => ({ contextLogger: () => mockLog }));

import {
  fetchRemotive,
  fetchRemoteOk,
  fetchDjinni,
  fetchJobicy,
  fetchWeWorkRemotely,
  fetchArbeitnow,
  fetchWorkingNomads,
} from "./job-search.service.js";

describe("fetchRemoteOk()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("filters out the non-job legal-notice object (the array's first element, no id)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { legal: "some notice, not a job" },
          { id: "1", company: "Acme", position: "Backend Dev", url: "https://x/1", tags: ["node"] },
        ]),
    });
    const jobs = await fetchRemoteOk("");
    expect(jobs).toEqual([expect.objectContaining({ company: "Acme", position: "Backend Dev", url: "https://x/1", source: "RemoteOK" })]);
  });

  it("filters by query terms against position/tags when a query is given", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "1", company: "A", position: "React Developer", url: "https://x/1", tags: [] },
          { id: "2", company: "B", position: "Data Analyst", url: "https://x/2", tags: ["sql"] },
        ]),
    });
    const jobs = await fetchRemoteOk("react");
    expect(jobs.map((j) => j.url)).toEqual(["https://x/1"]);
  });
});

describe("fetchDjinni()", () => {
  const fetchMock = vi.fn();
  const rssItem = (title: string, link: string, category = "", description = "") =>
    `<item><title>${title}</title><link>${link}</link><description>${description}</description><category>${category}</category></item>`;

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses items from the RSS feed, leaving company as '—' (not reliably extractable)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(`<rss><channel>${rssItem("Lead Backend Engineer", "https://djinni.co/jobs/1/", "Golang")}</channel></rss>`),
    });
    const jobs = await fetchDjinni("");
    expect(jobs).toEqual([
      expect.objectContaining({ company: "—", position: "Lead Backend Engineer", url: "https://djinni.co/jobs/1/", source: "Djinni" }),
    ]);
    // "Golang" resolves through normalizeTag()'s TECHS dictionary match to the canonical "Go".
    expect(jobs[0]!.tags).toContain("Go");
  });

  it("derives extra tags from the description text via extractTechs, beyond the RSS category", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<rss><channel>${rssItem("SRE Engineer", "https://djinni.co/jobs/2/", "DevOps", "&lt;p&gt;Experience with Kubernetes and Docker required.&lt;/p&gt;")}</channel></rss>`,
        ),
    });
    const jobs = await fetchDjinni("");
    // "DevOps" doesn't match any TECHS regex, so normalizeTag() title-cases it as-is ("Devops") —
    // Kubernetes/Docker DO match, extracted from the description text via extractTechs().
    expect(jobs[0]!.tags).toEqual(expect.arrayContaining(["Devops", "Kubernetes", "Docker"]));
  });

  it("has no native search param — filters client-side by matching the query against position/tags", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<rss><channel>${rssItem("React Developer", "https://djinni.co/jobs/3/", "React")}${rssItem("Sales Manager", "https://djinni.co/jobs/4/", "Sales")}</channel></rss>`,
        ),
    });
    const jobs = await fetchDjinni("react");
    expect(jobs.map((j) => j.url)).toEqual(["https://djinni.co/jobs/3/"]);
  });
});

describe("fetchJobicy()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("parses jobs and normalizes HTML-entity-encoded tag strings (e.g. '&amp;')", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          jobs: [
            {
              url: "https://jobicy.com/jobs/1",
              jobTitle: "Customer Success Manager",
              companyName: "GitLab",
              jobGeo: "Australia",
              jobIndustry: ["Customer Support &amp; Success"],
              jobType: ["Full-Time"],
              pubDate: "2026-08-04T03:20:02+00:00",
            },
          ],
        }),
    });
    const jobs = await fetchJobicy("");
    expect(jobs).toEqual([
      expect.objectContaining({ company: "GitLab", position: "Customer Success Manager", location: "Australia", source: "Jobicy" }),
    ]);
    expect(jobs[0]!.tags).toEqual(["Customer Support & Success", "Full-Time"]);
    expect(jobs[0]!.postedAt).toBe("2026-08-04T03:20:02.000Z");
  });

  it("has no confirmed search param — filters client-side by matching the query against position/tags", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          jobs: [
            { url: "https://x/1", jobTitle: "React Developer", companyName: "A", jobIndustry: [], jobType: [] },
            { url: "https://x/2", jobTitle: "Sales Manager", companyName: "B", jobIndustry: [], jobType: [] },
          ],
        }),
    });
    const jobs = await fetchJobicy("react");
    expect(jobs.map((j) => j.url)).toEqual(["https://x/1"]);
  });
});

describe("fetchWorkingNomads()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("splits the comma-separated `tags` string and folds category_name in as an extra tag", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            url: "https://www.workingnomads.com/job/go/1/",
            title: "Senior Python Developer",
            company_name: "Proxify",
            category_name: "Development",
            tags: "python,postgresql,aws",
            location: "CET (+/- 3 hours)",
            pub_date: "2026-08-05T14:36:36-04:00",
          },
        ]),
    });
    const jobs = await fetchWorkingNomads("");
    expect(jobs).toEqual([expect.objectContaining({ company: "Proxify", position: "Senior Python Developer", source: "WorkingNomads" })]);
    expect(jobs[0]!.tags).toEqual(expect.arrayContaining(["Development", "Python", "PostgreSQL", "AWS"]));
    expect(jobs[0]!.postedAt).toBe(new Date("2026-08-05T14:36:36-04:00").toISOString());
  });

  it("has no native search param — filters client-side by matching the query against position/tags", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { url: "https://x/1", title: "React Developer", company_name: "A", tags: "react" },
          { url: "https://x/2", title: "Sales Manager", company_name: "B", tags: "sales" },
        ]),
    });
    const jobs = await fetchWorkingNomads("react");
    expect(jobs.map((j) => j.url)).toEqual(["https://x/1"]);
  });

  it("defaults location to 'Remote' when absent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ url: "https://x/1", title: "Engineer", company_name: "A", tags: "" }]),
    });
    const jobs = await fetchWorkingNomads("");
    expect(jobs[0]!.location).toBe("Remote");
  });
});

describe("fetchWeWorkRemotely()", () => {
  const fetchMock = vi.fn();
  const rssItem = (title: string, link: string, region = "", category = "", pubDate = "Tue, 04 Aug 2026 15:19:32 +0000") =>
    `<item><title>${title}</title><region>${region}</region><category>${category}</category><description></description><pubDate>${pubDate}</pubDate><link>${link}</link></item>`;

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("splits the 'Company: Position' title format and falls back to 'Remote' with no region", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<rss><channel>${rssItem("Uptalent.io: Remote Interior Designer", "https://weworkremotely.com/jobs/1")}</channel></rss>`,
        ),
    });
    const jobs = await fetchWeWorkRemotely("");
    expect(jobs).toEqual([
      expect.objectContaining({
        company: "Uptalent.io",
        position: "Remote Interior Designer",
        url: "https://weworkremotely.com/jobs/1",
        location: "Remote",
        source: "WeWorkRemotely",
        postedAt: "2026-08-04T15:19:32.000Z",
      }),
    ]);
  });

  it("uses the RSS <region> as location when present", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<rss><channel>${rssItem("Acme: Backend Engineer", "https://weworkremotely.com/jobs/2", "Distrito Nacional")}</channel></rss>`,
        ),
    });
    const jobs = await fetchWeWorkRemotely("");
    expect(jobs[0]!.location).toBe("Distrito Nacional");
  });

  it("filters client-side by matching the query against position/tags", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<rss><channel>${rssItem("Acme: React Developer", "https://weworkremotely.com/jobs/3", "", "React")}${rssItem("Acme: Sales Manager", "https://weworkremotely.com/jobs/4", "", "Sales")}</channel></rss>`,
        ),
    });
    const jobs = await fetchWeWorkRemotely("react");
    expect(jobs.map((j) => j.url)).toEqual(["https://weworkremotely.com/jobs/3"]);
  });
});

describe("postedAt normalization across sources", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("converts Arbeitnow's Unix-epoch-SECONDS created_at into an ISO instant", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ company_name: "A", title: "Dev", url: "https://x/1", tags: [], created_at: 1785857424 }] }),
    });
    const jobs = await fetchArbeitnow("");
    expect(jobs[0]!.postedAt).toBe(new Date(1785857424 * 1000).toISOString());
  });

  it("is null when the source provides no date at all", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [{ company_name: "Acme", title: "Dev", url: "https://x", tags: [] }] }),
    });
    const jobs = await fetchRemotive("");
    expect(jobs[0]!.postedAt).toBeNull();
  });
});

describe("fetchRemotive() logs the reason before falling back to an empty list", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    mockLog.warn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("logs a warning with the status when the aggregator responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }), expect.stringContaining("non-2xx"));
  });

  it("logs a warning when the network request itself fails", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledOnce();
  });

  it("logs a warning when the response is 2xx but the body is not valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Unexpected token <")),
    });
    const jobs = await fetchRemotive("react");
    expect(jobs).toEqual([]);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("invalid JSON"));
  });

  it("returns parsed jobs without logging anything when the aggregator responds normally", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [{ company_name: "Acme", title: "Dev", url: "https://x", tags: ["React"] }] }),
    });
    const jobs = await fetchRemotive("react");
    expect(jobs).toHaveLength(1);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });
});
