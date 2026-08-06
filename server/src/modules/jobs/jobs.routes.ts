import express from "express";
import { getProfile } from "../../db/index.js";
import { authed } from "../../core/http.js";
import type { RawJob } from "./job-search.service.js";
import { fetchAllSourcesDetailed } from "./job-sources.js";
import { filterWeakMatches, jobDocument, rankByTfidf } from "./job-ranking.js";
import { dedupeBySimhash } from "./job-dedupe.js";
import { insertProductEvent } from "../../telemetry/telemetry.repo.js";
import { demandMap } from "../../shared/demand.js";

const r = express.Router();

interface JobWithMatch extends RawJob {
  matchCount: number;
}

// ---------- job search across aggregators (Remotive + Arbeitnow + RemoteOK + Jobicy + WeWorkRemotely + DOU + Djinni, no keys needed) ----------
r.get(
  "/jobs/search",
  authed(async (userId, req, res) => {
    const profile = await getProfile(userId);
    const region = String(req.query.region || "all");
    const rawQuery = String(req.query.q || "").trim();
    // Skills/domain are empty for a brand-new account (db/seed-vacancies.ts's EMPTY_PROFILE) —
    // falling all the way through to "" used to mean every aggregator got queried with an empty
    // search term (returning that source's whole unfiltered firehose). Falling back to the
    // candidate's OWN recency-weighted vacancy demand (shared/demand.ts) first is a real signal
    // when they've tracked anything at all; only when THAT is also empty is there truly nothing
    // to search for.
    let q = rawQuery || profile.skills.slice(0, 3).join(" ") || profile.domain || "";
    if (!q) {
      const demand = await demandMap(userId);
      q = Object.entries(demand)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tech]) => tech)
        .join(" ");
    }
    if (!q) {
      // No query, no skills/domain, no tracked vacancies — nothing to search for. Returning here
      // avoids querying every external aggregator with an empty term (which returns each
      // source's unfiltered firehose, not "no results") and lets the client show a "tell us what
      // you're looking for" prompt instead of a misleadingly empty results list.
      res.json({ query: "", count: 0, jobs: [], offline: false, needsQuery: true });
      return;
    }
    // One array per source, in modules/jobs/job-sources.ts's registry order — needed as separate
    // arrays only for the `offline` flag below; everything else operates on the flattened list.
    const bySource = await fetchAllSourcesDetailed(q, region);
    const known = new Set(profile.skills.map((s) => s.toLowerCase()));
    const seen = new Set<string>();
    const dedupe = (arr: RawJob[]): RawJob[] => arr.filter((j) => j.url && !seen.has(j.url) && seen.add(j.url));
    // 1) exact dedup by URL (the same link twice in one feed) — fast, cheap. A single dedupe()
    //    over the already-registry-ordered flattened list is equivalent to the previous
    //    per-source dedupe() calls (both walk the same shared `seen` Set in the same order) —
    //    the first occurrence of a duplicate URL still wins.
    // 2) SimHash dedup by text (company+position) — the same vacancy across several
    //    aggregators under DIFFERENT URLs — plain URL comparison would catch it three times.
    const all = dedupeBySimhash(dedupe(bySource.flat()));
    // matchCount (a plain tag count) stays in the response for the "★ N match" badge in the UI —
    // clearer to the user than an abstract score. But SORTING is now by TF-IDF, not matchCount:
    // DOU never returns tags (RawJob.tags is always []), so on plain matchCount DOU vacancies
    // couldn't be ranked by relevance at all — TF-IDF also builds the document from POSITION,
    // and weighs rare terms higher than frequent ones (see job-ranking.ts).
    const withMatchCount = all.map((j) => ({ ...j, matchCount: j.tags.filter((t) => known.has(String(t).toLowerCase())).length }));
    const ranked = rankByTfidf(withMatchCount, all.map(jobDocument), profile.skills);
    // Drop vacancies whose relevance is far below this search's own best match (e.g. a "Remote
    // Office Assistant" surfacing on a fullstack query with only an incidental keyword overlap) —
    // see filterWeakMatches() for the relative-threshold/fallback logic.
    const relevant = filterWeakMatches(ranked);
    // _score is only for sorting; the client doesn't need it (the UI shows the matchCount badge, not the raw score).
    const jobs: JobWithMatch[] = relevant.slice(0, 200).map(({ _score, ...job }) => job);
    const offline = bySource.every((arr) => arr.length === 0);
    // Fire-and-forget — see telemetry.repo.ts. The gap this closes: before Phase 5, nothing
    // recorded what candidates actually search for, so the admin's product-analytics view
    // (Phase 6) had no search data to show at all.
    void insertProductEvent(userId, "job_search", { query: q, region, resultCount: jobs.length, offline });
    res.json({ query: q, count: jobs.length, jobs, offline });
  }),
);

export default r;
