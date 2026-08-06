import type { JobResult } from "../../shared/types";

export type JobSortKey = "relevance" | "newest";

// Every source job-search.service.ts's RawJob.source can be set to (server/src/modules/jobs/
// job-search.service.ts). Kept as a fixed list — not derived from the current result set — so the
// "Sources" filter always shows every integrated aggregator, even one that returned zero matches
// for this particular query (so a user isn't left wondering whether it's supported at all).
export const ALL_JOB_SOURCES = ["DOU", "Djinni", "Remotive", "Arbeitnow", "RemoteOK", "Jobicy", "WeWorkRemotely", "WorkingNomads"] as const;

/** Filters + sorts the already-fetched result set client-side — the server already ranked by
 * TF-IDF relevance (job-ranking.ts), so `sortBy: "relevance"` just keeps that order as-is;
 * "newest" re-sorts by `postedAt` instead, with unknown dates (postedAt === null, e.g. a source
 * that doesn't expose one) pushed to the bottom rather than floating arbitrarily to either end. */
export function filterAndSortJobs(
  jobs: JobResult[],
  {
    hiddenSources,
    hideAdded,
    trackedUrls,
    sortBy,
  }: { hiddenSources: string[]; hideAdded: boolean; trackedUrls: Set<string>; sortBy: JobSortKey },
): JobResult[] {
  const filtered = jobs.filter((j) => {
    if (hiddenSources.includes(j.source)) return false;
    if (hideAdded && trackedUrls.has(j.url)) return false;
    return true;
  });
  if (sortBy === "relevance") return filtered;
  return [...filtered].sort((a, b) => {
    if (a.postedAt === b.postedAt) return 0;
    if (a.postedAt == null) return 1;
    if (b.postedAt == null) return -1;
    return a.postedAt > b.postedAt ? -1 : 1;
  });
}
