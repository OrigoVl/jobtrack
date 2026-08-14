import express from "express";
import {
  getProfile,
  getDrillProgress,
  setDrillStatus,
  getKvJson,
  setKvJson,
  getSrsStateByCard,
  getSrsRow,
  recordSrsGrade,
  getStudyStreak,
  recordStudyActivity,
} from "../../db/index.js";
import { catFor } from "../knowledge/knowledge-base.js";
import { llmAvailable } from "../../llm/index.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { CARDS } from "./content.js";
import { slugify } from "../../shared/slug.js";
import { genDrills, allDrills, genCards, allCards, trackFor } from "./content-store.js";
import { type FsrsRating } from "./fsrs.js";
import { effectiveTrack } from "../../shared/tracks.js";
import {
  appendDrillArchive,
  drillArchiveEntryFromDrill,
  removeDrillArchiveEntry,
  updateDrillArchiveEntry,
  type DrillArchiveEditableFields,
  type DrillArchiveEntry,
} from "./study-archive.js";
import {
  requestDrillHints,
  buildAvoidList,
  requestGeneratedDrills,
  dedupeGeneratedDrills,
  requestGeneratedCards,
  dedupeGeneratedCards,
  computeSrsGrade,
} from "./study.service.js";

const r = express.Router();
const DRILL_ARCHIVE_KEY = "drillArchive";

// ---------- study: SRS + drills ----------
r.get(
  "/study/content",
  authed(async (userId, _req, res) => {
    const track = await trackFor(userId);
    res.json({ cards: CARDS, drills: await allDrills(userId, track), drillProgress: await getDrillProgress(userId) });
  }),
);
r.put(
  "/study/drill",
  authed(async (userId, req, res) => {
    const id = String(req.body?.id || "");
    const status = String(req.body?.status || "todo");
    const track = await trackFor(userId);
    if (!(await allDrills(userId, track)).some((d) => d.id === id)) throw new HttpError(400, `Unknown task: "${id}"`);
    if (status !== "solved" && status !== "todo") throw new HttpError(400, `Unknown status: "${status}"`);
    const progress = await setDrillStatus(userId, id, status);
    // Only solving counts as a study action for the streak — unmarking a task back to "todo"
    // isn't something to reward.
    if (status === "solved") {
      await recordStudyActivity(userId);
      const drill = (await allDrills(userId, track)).find((d) => d.id === id)!;
      const history = (await getKvJson<DrillArchiveEntry[]>(userId, DRILL_ARCHIVE_KEY)) || [];
      const entry = drillArchiveEntryFromDrill(drill, new Date().toISOString());
      await setKvJson(userId, DRILL_ARCHIVE_KEY, appendDrillArchive(history, entry));
    }
    res.json({ ok: true, progress });
  }),
);

r.get(
  "/study/archive",
  authed(async (userId, _req, res) => {
    res.json((await getKvJson<DrillArchiveEntry[]>(userId, DRILL_ARCHIVE_KEY)) || []);
  }),
);

r.put(
  "/study/archive/:id",
  authed(async (userId, req, res) => {
    const id = String(req.params.id);
    const patch: Partial<DrillArchiveEditableFields> = {};
    if (typeof req.body?.q === "string") patch.q = req.body.q;
    if (typeof req.body?.sol === "string") patch.sol = req.body.sol;
    if (typeof req.body?.exp === "string") patch.exp = req.body.exp;
    const history = (await getKvJson<DrillArchiveEntry[]>(userId, DRILL_ARCHIVE_KEY)) || [];
    const updated = updateDrillArchiveEntry(history, id, patch);
    if (!updated) throw new HttpError(404, `Unknown archive entry: "${id}"`);
    await setKvJson(userId, DRILL_ARCHIVE_KEY, updated);
    res.json(updated.find((e) => e.id === id));
  }),
);

r.delete(
  "/study/archive/:id",
  authed(async (userId, req, res) => {
    const id = String(req.params.id);
    const history = (await getKvJson<DrillArchiveEntry[]>(userId, DRILL_ARCHIVE_KEY)) || [];
    await setKvJson(userId, DRILL_ARCHIVE_KEY, removeDrillArchiveEntry(history, id));
    res.json({ ok: true });
  }),
);

// progressive hints for a task (LLM, cached) — don't reveal the solution right away
r.post(
  "/study/drill-hint",
  aiLimiter,
  authed(async (userId, req, res) => {
    const id = String(req.body?.id || "");
    const track = await trackFor(userId);
    const drill = (await allDrills(userId, track)).find((d) => d.id === id);
    if (!drill) throw new HttpError(400, `Unknown task: "${id}"`);
    const result = await requestDrillHints(userId, drill);
    res.json(result.offline ? { offline: true, hints: [] } : { hints: result.hints });
  }),
);

// generate personal tasks specifically for a gap technology (supplements the static pool)
r.post(
  "/study/generate",
  aiLimiter,
  authed(async (userId, req, res) => {
    const tech = String(req.body?.tech || "")
      .trim()
      .slice(0, 60);
    if (!tech) throw new HttpError(400, "No technology specified");
    const profile = await getProfile(userId);
    const track = effectiveTrack(profile);
    const cat = catFor(tech) || tech;
    const role = profile.domain || "specialist";
    // Read the pool BEFORE generating, not just after — see study.service.ts's
    // requestGeneratedDrills for why the exclusion list matters both for real dedup and for the
    // cache key.
    const existingQ = new Set((await allDrills(userId, track)).map((d) => d.q));
    const avoid = buildAvoidList(existingQ);
    const { offline, items } = await requestGeneratedDrills(userId, role, profile.skills, tech, avoid);
    if (offline) return res.json({ offline: true, added: 0, drills: await allDrills(userId, track) });
    const newEntries = dedupeGeneratedDrills(items, existingQ, cat, tech);
    const gen = await genDrills(userId);
    newEntries.forEach((entry, i) => gen.push({ id: `gen-${slugify(tech)}-${Date.now().toString(36)}-${i}`, ...entry }));
    await setKvJson(userId, "genDrills", gen);
    res.json({ added: newEntries.length, drills: await allDrills(userId, track) });
  }),
);

// generate personal flashcards for a domain/topic (supplements the static SRS pool)
r.post(
  "/study/generate-cards",
  aiLimiter,
  authed(async (userId, req, res) => {
    const profile = await getProfile(userId);
    const track = effectiveTrack(profile);
    const role = profile.domain || "specialist";
    const topic =
      String(req.body?.topic || "")
        .trim()
        .slice(0, 60) || role;
    if (!topic) throw new HttpError(400, "No topic specified");
    if (!llmAvailable()) return res.json({ offline: true, added: 0 });
    // Same exclusion-list reasoning as /study/generate above — dedupeGeneratedCards drops any card
    // whose question already exists, so the model has to be told which ones those are.
    const existingQ = new Set((await allCards(userId, track)).map((c) => c.q));
    const avoid = buildAvoidList(existingQ);
    const { items } = await requestGeneratedCards(userId, role, topic, avoid);
    const newEntries = dedupeGeneratedCards(items, existingQ, topic);
    const gen = await genCards(userId);
    newEntries.forEach((entry, i) => gen.push({ id: `genc-${slugify(topic)}-${Date.now().toString(36)}-${i}`, ...entry }));
    await setKvJson(userId, "genCards", gen);
    res.json({ added: newEntries.length });
  }),
);
r.get(
  "/study/due",
  authed(async (userId, _req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const track = await trackFor(userId);
    const cards = await allCards(userId, track);
    const state = await getSrsStateByCard(userId);
    const due = cards.filter((c) => {
      const s = state[c.id];
      return !s || s.due <= today;
    });
    res.json({
      due,
      total: cards.length,
      learned: Object.values(state).filter((s) => s.reps > 0).length,
      streak: await getStudyStreak(userId),
    });
  }),
);
r.post(
  "/study/grade",
  authed(async (userId, req, res) => {
    const { cardId, grade } = req.body || {};
    const track = await trackFor(userId);
    if (typeof cardId !== "string" || !(await allCards(userId, track)).some((c) => c.id === cardId))
      throw new HttpError(400, "Unknown card");
    // 1=Again (forgot), 2=Hard, 3=Good, 4=Easy — a 4-point FSRS scale instead of the old
    // binary one (0/1), so the algorithm can distinguish "barely remembered" from "recalled
    // instantly" — this is the main advantage of FSRS over SM-2 with its binary rating.
    if (grade !== 1 && grade !== 2 && grade !== 3 && grade !== 4) {
      throw new HttpError(400, "grade must be 1-4 (FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy)");
    }
    const rating = grade as FsrsRating;
    const now = new Date();
    const existing = await getSrsRow(userId, cardId);
    const { difficulty, stability, intervalDays, due, reps, lastReview } = computeSrsGrade(existing, rating, now);
    await recordSrsGrade(userId, cardId, { difficulty, stability, interval: intervalDays, due, reps, lastReview });
    const streak = await recordStudyActivity(userId);
    res.json({ ok: true, due, interval: intervalDays, difficulty, stability, streak });
  }),
);

export default r;
