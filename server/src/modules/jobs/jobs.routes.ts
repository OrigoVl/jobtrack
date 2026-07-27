import express from "express";
import { getProfile } from "../../db/index.js";
import { asyncHandler } from "../../core/http.js";
import { fetchRemotive, fetchArbeitnow, fetchDou, interleave, type RawJob } from "./job-search.service.js";

const r = express.Router();

interface JobWithMatch extends RawJob {
  matchCount: number;
}

// ---------- пошук вакансій в агрегаторах (Remotive + Arbeitnow + DOU, без ключів) ----------
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
    const prep = (arr: RawJob[]): JobWithMatch[] =>
      arr
        .filter((j) => j.url && !seen.has(j.url) && seen.add(j.url))
        .map((j) => ({ ...j, matchCount: j.tags.filter((t) => known.has(String(t).toLowerCase())).length }))
        .sort((a, b) => b.matchCount - a.matchCount);
    const jobs = interleave([prep(dou), prep(remotive), prep(arbeitnow)], 200);
    res.json({ query: q, count: jobs.length, jobs, offline: !dou.length && !remotive.length && !arbeitnow.length });
  }),
);

export default r;
