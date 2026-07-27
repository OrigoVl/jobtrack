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
    const dedupe = (arr: RawJob[]): RawJob[] => arr.filter((j) => j.url && !seen.has(j.url) && seen.add(j.url));
    // 1) точний дедуп за URL (той самий лінк двічі в одному фіді) — швидко, дешево.
    // 2) SimHash-дедуп за текстом (company+position) — та сама вакансія на кількох
    //    агрегаторах під РІЗНИМИ URL (DOU/Remotive/Arbeitnow) — на голому URL-порівнянні
    //    ловилась би тричі. Порядок конкатенації [dou, remotive, arbeitnow] визначає, яке
    //    джерело "виграє" при дублі (лишається перше входження) — довільна, але стабільна політика.
    const all = dedupeBySimhash([...dedupe(dou), ...dedupe(remotive), ...dedupe(arbeitnow)]);
    // matchCount (простий рахунок тегів) лишається у відповіді для бейджа "★ N збіг" в UI —
    // зрозуміліше юзеру за абстрактний score. Але СОРТУВАННЯ тепер за TF-IDF, не за matchCount:
    // DOU ніколи не віддає теги (RawJob.tags завжди []), тож на голому matchCount DOU-вакансії
    // взагалі не могли ранжуватись за релевантністю — TF-IDF рахує документ з POSITION теж,
    // і важить рідкісні терміни вище за часті (див. job-ranking.ts).
    const withMatchCount = all.map((j) => ({ ...j, matchCount: j.tags.filter((t) => known.has(String(t).toLowerCase())).length }));
    const ranked = rankByTfidf(withMatchCount, all.map(jobDocument), profile.skills);
    // _score — лише для сортування; не потрібен клієнту (UI показує matchCount-бейдж, не raw score).
    const jobs: JobWithMatch[] = ranked.slice(0, 200).map(({ _score, ...job }) => job);
    res.json({ query: q, count: jobs.length, jobs, offline: !dou.length && !remotive.length && !arbeitnow.length });
  }),
);

export default r;
