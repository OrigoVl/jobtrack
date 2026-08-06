// A single registry of external job aggregators — introduced because the exact same 7-way
// `Promise.all` (one call per source, gated by region) used to be hand-duplicated in both
// jobs.routes.ts (GET /jobs/search) and saved-searches.scheduler.ts (the job-alert scheduler),
// meaning every new source had to be added in two places or the two paths would silently drift
// apart. This is the one place that list exists now.
import {
  fetchArbeitnow,
  fetchDjinni,
  fetchDou,
  fetchJobicy,
  fetchRemoteOk,
  fetchRemotive,
  fetchWeWorkRemotely,
  fetchWorkingNomads,
  type RawJob,
} from "./job-search.service.js";

export type JobRegion = "ua" | "remote";

export interface JobSource {
  name: string;
  regions: JobRegion[];
  fetch(query: string): Promise<RawJob[]>;
}

// Order is load-bearing, not cosmetic: both call sites dedupe postings by URL/SimHash against a
// single running Set as they walk this list, so the FIRST source to contribute a given posting
// is the one that "wins" a duplicate. This is the exact order the two hardcoded destructurings
// used before this file existed — preserved so consolidating them changes nothing observable.
export const JOB_SOURCES: JobSource[] = [
  { name: "DOU", regions: ["ua"], fetch: fetchDou },
  { name: "Djinni", regions: ["ua"], fetch: fetchDjinni },
  { name: "Remotive", regions: ["remote"], fetch: fetchRemotive },
  { name: "Arbeitnow", regions: ["remote"], fetch: fetchArbeitnow },
  { name: "RemoteOK", regions: ["remote"], fetch: fetchRemoteOk },
  { name: "Jobicy", regions: ["remote"], fetch: fetchJobicy },
  { name: "WeWorkRemotely", regions: ["remote"], fetch: fetchWeWorkRemotely },
  { name: "WorkingNomads", regions: ["remote"], fetch: fetchWorkingNomads },
];

function activeSources(region: string): JobSource[] {
  return JOB_SOURCES.filter((s) => region === "all" || s.regions.includes(region as JobRegion));
}

/** One array per active source, in registry order — callers that need to distinguish "every
 * source returned nothing" (offline/unreachable) from "no source matched this query" (see
 * jobs.routes.ts's `offline` flag) need the per-source split; fetchAllSources() below is for
 * callers that don't. */
export async function fetchAllSourcesDetailed(query: string, region: string): Promise<RawJob[][]> {
  return Promise.all(activeSources(region).map((s) => s.fetch(query)));
}

/** Concatenation of every active source's postings, in registry order — the single place both
 * /jobs/search and the saved-searches scheduler get their raw postings from now. */
export async function fetchAllSources(query: string, region: string): Promise<RawJob[]> {
  return (await fetchAllSourcesDetailed(query, region)).flat();
}
