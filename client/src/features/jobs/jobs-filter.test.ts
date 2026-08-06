import { describe, expect, it } from "vitest";
import { filterAndSortJobs } from "./jobs-filter";
import type { JobResult } from "../../shared/types";

function job(overrides: Partial<JobResult> = {}): JobResult {
  return {
    company: "Acme",
    position: "Engineer",
    url: "https://x/1",
    location: "Remote",
    tags: [],
    source: "Remotive",
    matchCount: 0,
    postedAt: null,
    ...overrides,
  };
}

describe("filterAndSortJobs", () => {
  it("keeps everything by default (no hidden sources, hideAdded off)", () => {
    const jobs = [job({ url: "https://x/1" }), job({ url: "https://x/2" })];
    const out = filterAndSortJobs(jobs, { hiddenSources: [], hideAdded: false, trackedUrls: new Set(), sortBy: "relevance" });
    expect(out).toEqual(jobs);
  });

  it("filters out jobs from a hidden source", () => {
    const jobs = [job({ url: "https://x/1", source: "DOU" }), job({ url: "https://x/2", source: "Djinni" })];
    const out = filterAndSortJobs(jobs, { hiddenSources: ["DOU"], hideAdded: false, trackedUrls: new Set(), sortBy: "relevance" });
    expect(out.map((j) => j.url)).toEqual(["https://x/2"]);
  });

  it("hides jobs whose URL is already tracked when hideAdded is on", () => {
    const jobs = [job({ url: "https://x/1" }), job({ url: "https://x/2" })];
    const out = filterAndSortJobs(jobs, {
      hiddenSources: [],
      hideAdded: true,
      trackedUrls: new Set(["https://x/1"]),
      sortBy: "relevance",
    });
    expect(out.map((j) => j.url)).toEqual(["https://x/2"]);
  });

  it("keeps the server's own order (TF-IDF relevance) when sortBy is 'relevance'", () => {
    const jobs = [
      job({ url: "https://x/2", postedAt: "2026-08-01T00:00:00.000Z" }),
      job({ url: "https://x/1", postedAt: "2026-08-03T00:00:00.000Z" }),
    ];
    const out = filterAndSortJobs(jobs, { hiddenSources: [], hideAdded: false, trackedUrls: new Set(), sortBy: "relevance" });
    expect(out.map((j) => j.url)).toEqual(["https://x/2", "https://x/1"]);
  });

  it("sorts by postedAt descending when sortBy is 'newest'", () => {
    const jobs = [
      job({ url: "https://x/old", postedAt: "2026-08-01T00:00:00.000Z" }),
      job({ url: "https://x/new", postedAt: "2026-08-03T00:00:00.000Z" }),
    ];
    const out = filterAndSortJobs(jobs, { hiddenSources: [], hideAdded: false, trackedUrls: new Set(), sortBy: "newest" });
    expect(out.map((j) => j.url)).toEqual(["https://x/new", "https://x/old"]);
  });

  it("pushes jobs with an unknown (null) postedAt to the bottom when sorting by newest", () => {
    const jobs = [job({ url: "https://x/unknown", postedAt: null }), job({ url: "https://x/known", postedAt: "2026-08-01T00:00:00.000Z" })];
    const out = filterAndSortJobs(jobs, { hiddenSources: [], hideAdded: false, trackedUrls: new Set(), sortBy: "newest" });
    expect(out.map((j) => j.url)).toEqual(["https://x/known", "https://x/unknown"]);
  });
});
