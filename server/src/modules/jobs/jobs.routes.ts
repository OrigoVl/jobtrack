import express from "express";
import { getProfile } from "../../db/index.js";
import { asyncHandler } from "../../core/http.js";
import { fetchRemotive, fetchArbeitnow, fetchDou, type RawJob } from "./job-search.service.js";
import { jobDocument, rankByTfidf } from "./job-ranking.js";
import { dedupeBySimhash } from "./job-dedupe.js";

const r = express.Router();

interface JobWithMatch extends RawJob {
  matchCount: number;
}

// ---------- job search across aggregators (Remotive + Arbeitnow + DOU, no keys needed) ----------
r.get(
  "/jobs/search",
  asyncHandler(async (req, res) => {
    const profile = getProfile();
    const q = String(req.query.q || "").trim() || profile.skills.slice(0, 3).join(" ") || profile.domain || "";
    const region = String(req.query.region || "all");
    const wantUa = region === "all" || region === "ua";
    const wantRemote = region === "all" || region === "remote";
    const [dou, remotive, arbeitnow] = await Promise.all([
      wantUa ? fetchDou(q) : [],
      wantRemote ? fetchRemotive(q) : [],
      wantRemote ? fetchArbeitnow(q) : [],
    ]);
    const known = new Set(profile.skills.map((s) => s.toLowerCase()));
    const seen = new Set<string>();
    const dedupe = (arr: RawJob[]): RawJob[] => arr.filter((j) => j.url && !seen.has(j.url) && seen.add(j.url));
    // 1) exact dedup by URL (the same link twice in one feed) — fast, cheap.
    // 2) SimHash dedup by text (company+position) — the same vacancy across several
    //    aggregators under DIFFERENT URLs (DOU/Remotive/Arbeitnow) — plain URL comparison
    //    would catch it three times. The concatenation order [dou, remotive, arbeitnow]
    //    determines which source "wins" on a duplicate (the first occurrence is kept) —
    //    an arbitrary but stable policy.
    const all = dedupeBySimhash([...dedupe(dou), ...dedupe(remotive), ...dedupe(arbeitnow)]);
    // matchCount (a plain tag count) stays in the response for the "★ N match" badge in the UI —
    // clearer to the user than an abstract score. But SORTING is now by TF-IDF, not matchCount:
    // DOU never returns tags (RawJob.tags is always []), so on plain matchCount DOU vacancies
    // couldn't be ranked by relevance at all — TF-IDF also builds the document from POSITION,
    // and weighs rare terms higher than frequent ones (see job-ranking.ts).
    const withMatchCount = all.map((j) => ({ ...j, matchCount: j.tags.filter((t) => known.has(String(t).toLowerCase())).length }));
    const ranked = rankByTfidf(withMatchCount, all.map(jobDocument), profile.skills);
    // _score is only for sorting; the client doesn't need it (the UI shows the matchCount badge, not the raw score).
    const jobs: JobWithMatch[] = ranked.slice(0, 200).map(({ _score, ...job }) => job);
    res.json({ query: q, count: jobs.length, jobs, offline: !dou.length && !remotive.length && !arbeitnow.length });
  }),
);

export default r;
