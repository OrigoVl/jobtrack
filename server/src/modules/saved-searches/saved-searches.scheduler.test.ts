import { describe, expect, it } from "vitest";
import { diffNewJobs, isFirstRun, rankJobsByFit } from "./saved-searches.scheduler.js";
import type { RawJob } from "../jobs/job-search.service.js";

function job(url: string, overrides: Partial<RawJob> = {}): RawJob {
  return { company: "Acme", position: "Engineer", url, location: "Remote", tags: [], source: "Remotive", ...overrides };
}

describe("diffNewJobs", () => {
  it("treats every job as new when nothing has been seen before", () => {
    const jobs = [job("https://a.test/1"), job("https://a.test/2")];
    const { newJobs } = diffNewJobs(jobs, []);
    expect(newJobs.map((j) => j.url)).toEqual(["https://a.test/1", "https://a.test/2"]);
  });

  it("only reports jobs not already in lastSeenUrls", () => {
    const jobs = [job("https://a.test/1"), job("https://a.test/2"), job("https://a.test/3")];
    const { newJobs } = diffNewJobs(jobs, ["https://a.test/1", "https://a.test/3"]);
    expect(newJobs.map((j) => j.url)).toEqual(["https://a.test/2"]);
  });

  it("ignores jobs with no url (can't be tracked/deduped)", () => {
    const jobs = [job(""), job("https://a.test/1")];
    const { newJobs } = diffNewJobs(jobs, []);
    expect(newJobs.map((j) => j.url)).toEqual(["https://a.test/1"]);
  });

  it("nextSeenUrls includes both the fresh fetch and everything previously seen, deduped", () => {
    const jobs = [job("https://a.test/1"), job("https://a.test/2")];
    const { nextSeenUrls } = diffNewJobs(jobs, ["https://a.test/2", "https://old.test/9"]);
    expect(new Set(nextSeenUrls)).toEqual(new Set(["https://a.test/1", "https://a.test/2", "https://old.test/9"]));
  });

  it("caps nextSeenUrls at MAX_TRACKED_URLS so a row can't grow unbounded", () => {
    const lastSeenUrls = Array.from({ length: 500 }, (_, i) => `https://old.test/${i}`);
    const jobs = [job("https://a.test/new")];
    const { nextSeenUrls } = diffNewJobs(jobs, lastSeenUrls);
    expect(nextSeenUrls.length).toBeLessThanOrEqual(500);
  });
});

describe("isFirstRun", () => {
  it("is true when there's no seen history and no prior notification", () => {
    expect(isFirstRun({ lastSeenUrls: [], lastNotifiedAt: null })).toBe(true);
  });

  it("is false once there's seen history, even with no notification yet (nothing new was ever found)", () => {
    expect(isFirstRun({ lastSeenUrls: ["https://a.test/1"], lastNotifiedAt: null })).toBe(false);
  });

  it("is false once a notification has gone out", () => {
    expect(isFirstRun({ lastSeenUrls: [], lastNotifiedAt: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });
});

describe("rankJobsByFit", () => {
  const skills = ["React", "TypeScript"];

  it("ranks a posting whose extracted tech matches the profile as a strong (high) fit", () => {
    const ranked = rankJobsByFit([job("https://a.test/1", { position: "Senior React Developer" })], skills);
    expect(ranked[0]!.fit).toBe("high");
  });

  it("ranks a posting whose extracted tech is NOT in the profile lower than a matching one", () => {
    const ranked = rankJobsByFit(
      [job("https://a.test/py", { position: "Python Backend Engineer" }), job("https://a.test/react", { position: "React Developer" })],
      skills,
    );
    expect(ranked.map((j) => j.url)).toEqual(["https://a.test/react", "https://a.test/py"]);
    expect(ranked[0]!.fit).toBe("high");
  });

  it("treats a posting with no extractable tech at all as low fit, not high", () => {
    // computeFit([], []) alone would return "high" ("no known requirements — no basis to lower
    // the score"), which is correct for an already-tracked vacancy but wrong for ranking a raw
    // search result: a non-technical posting must not falsely outrank a real skill match.
    const ranked = rankJobsByFit([job("https://a.test/pm", { position: "Product Manager", tags: [] })], skills);
    expect(ranked[0]!.fit).toBe("low");
  });

  it("also matches tech mentioned only in the source's own tags, not just the position title", () => {
    const ranked = rankJobsByFit([job("https://a.test/1", { position: "Engineer", tags: ["react", "typescript"] })], skills);
    expect(ranked[0]!.fit).toBe("high");
  });

  it("keeps the original relative order among postings tied on fit (stable sort)", () => {
    const ranked = rankJobsByFit(
      [job("https://a.test/first", { position: "Product Manager" }), job("https://a.test/second", { position: "Sales Lead" })],
      skills,
    );
    expect(ranked.map((j) => j.url)).toEqual(["https://a.test/first", "https://a.test/second"]);
  });
});
