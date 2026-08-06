// Unit tests for the registry itself — job-search.service.js's real fetchers are mocked
// wholesale so these test region filtering/ordering/flattening, not network I/O.
import { describe, expect, it, vi } from "vitest";
import type { RawJob } from "./job-search.service.js";

function job(source: string, position = "Engineer"): RawJob {
  return { company: "Acme", position, url: `https://example.test/${source}`, location: "Remote", tags: [], source, postedAt: null };
}

vi.mock("./job-search.service.js", () => ({
  fetchDou: vi.fn(async () => [job("DOU")]),
  fetchDjinni: vi.fn(async () => [job("Djinni")]),
  fetchRemotive: vi.fn(async () => [job("Remotive")]),
  fetchArbeitnow: vi.fn(async () => [job("Arbeitnow")]),
  fetchRemoteOk: vi.fn(async () => [job("RemoteOK")]),
  fetchJobicy: vi.fn(async () => [job("Jobicy")]),
  fetchWeWorkRemotely: vi.fn(async () => [job("WeWorkRemotely")]),
  fetchWorkingNomads: vi.fn(async () => [job("WorkingNomads")]),
}));

describe("JOB_SOURCES", () => {
  it("has exactly the two UA sources and five remote sources, each with a query-taking fetch()", async () => {
    const { JOB_SOURCES } = await import("./job-sources.js");
    expect(JOB_SOURCES.filter((s) => s.regions.includes("ua")).map((s) => s.name)).toEqual(["DOU", "Djinni"]);
    expect(JOB_SOURCES.filter((s) => s.regions.includes("remote")).map((s) => s.name)).toEqual([
      "Remotive",
      "Arbeitnow",
      "RemoteOK",
      "Jobicy",
      "WeWorkRemotely",
      "WorkingNomads",
    ]);
  });
});

describe("fetchAllSourcesDetailed()", () => {
  it("region=all calls every source and returns one array per source, in registry order", async () => {
    const { fetchAllSourcesDetailed } = await import("./job-sources.js");
    const detailed = await fetchAllSourcesDetailed("react", "all");
    expect(detailed.map((arr) => arr[0]?.source)).toEqual([
      "DOU",
      "Djinni",
      "Remotive",
      "Arbeitnow",
      "RemoteOK",
      "Jobicy",
      "WeWorkRemotely",
      "WorkingNomads",
    ]);
  });

  it("region=ua calls only the UA sources — the rest are never invoked at all", async () => {
    const jss = await import("./job-search.service.js");
    vi.clearAllMocks();
    const { fetchAllSourcesDetailed } = await import("./job-sources.js");
    const detailed = await fetchAllSourcesDetailed("react", "ua");
    expect(detailed.flat().map((j) => j.source)).toEqual(["DOU", "Djinni"]);
    expect(jss.fetchRemotive).not.toHaveBeenCalled();
    expect(jss.fetchWeWorkRemotely).not.toHaveBeenCalled();
  });

  it("region=remote calls only the remote sources — DOU/Djinni are never invoked at all", async () => {
    const jss = await import("./job-search.service.js");
    vi.clearAllMocks();
    const { fetchAllSourcesDetailed } = await import("./job-sources.js");
    const detailed = await fetchAllSourcesDetailed("react", "remote");
    expect(detailed.flat().map((j) => j.source)).toEqual([
      "Remotive",
      "Arbeitnow",
      "RemoteOK",
      "Jobicy",
      "WeWorkRemotely",
      "WorkingNomads",
    ]);
    expect(jss.fetchDou).not.toHaveBeenCalled();
    expect(jss.fetchDjinni).not.toHaveBeenCalled();
  });

  it("passes the query through to every active source's fetch()", async () => {
    const jss = await import("./job-search.service.js");
    vi.clearAllMocks();
    const { fetchAllSourcesDetailed } = await import("./job-sources.js");
    await fetchAllSourcesDetailed("rust developer", "ua");
    expect(jss.fetchDou).toHaveBeenCalledWith("rust developer");
    expect(jss.fetchDjinni).toHaveBeenCalledWith("rust developer");
  });
});

describe("fetchAllSources()", () => {
  it("flattens every source's postings into one array, in registry order", async () => {
    const { fetchAllSources } = await import("./job-sources.js");
    const jobs = await fetchAllSources("react", "all");
    expect(jobs.map((j) => j.source)).toEqual([
      "DOU",
      "Djinni",
      "Remotive",
      "Arbeitnow",
      "RemoteOK",
      "Jobicy",
      "WeWorkRemotely",
      "WorkingNomads",
    ]);
  });
});
