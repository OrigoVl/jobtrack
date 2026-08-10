import express from "express";
import { z } from "zod";
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
import { chatJson, llmAvailable } from "../../llm/index.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { CARDS } from "./content.js";
import { slugify } from "../../shared/slug.js";
import { genDrills, allDrills, genCards, allCards, trackFor } from "./content-store.js";
import { scheduleFsrs, type FsrsRating } from "./fsrs.js";
import { effectiveTrack } from "../../shared/tracks.js";
import {
  appendDrillArchive,
  drillArchiveEntryFromDrill,
  removeDrillArchiveEntry,
  updateDrillArchiveEntry,
  type DrillArchiveEditableFields,
  type DrillArchiveEntry,
} from "./study-archive.js";

const r = express.Router();
const DRILL_ARCHIVE_KEY = "drillArchive";

const HintsSchema = z.object({ hints: z.array(z.string()) });
// `.catch("med")` on lvl (not a strict enum failure) — the model sometimes returns something
// outside easy|med|hard; the old manual check also silently normalized it to "med" instead of
// discarding the task entirely.
const GenDrillsSchema = z.object({
  drills: z.array(
    z.object({
      q: z.string().min(1),
      lvl: z.enum(["easy", "med", "hard"]).catch("med"),
      sol: z.string().min(1),
      exp: z.string().catch(""),
    }),
  ),
});
const GenCardsSchema = z.object({ cards: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })) });

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
    if (!llmAvailable()) return res.json({ offline: true, hints: [] });
    const out = await chatJson(
      userId,
      "You are a mentor. You give progressive hints for a task WITHOUT revealing the full solution right away. Respond ONLY with valid JSON.",
      `Task (${drill.cat}, ${drill.lvl}): ${drill.q}\n` +
        `Give 3 hints from the subtlest to the strongest (direction of thought → approach/structure → almost the solution, but without ready-made code). Format: {"hints":["...","...","..."]}`,
      HintsSchema,
      { maxTokens: 400, temperature: 0.3, cache: true, feature: "study-hint", outputLocale: "app" },
    );
    if (!out) return res.json({ offline: true, hints: [] });
    res.json({ hints: out.hints.slice(0, 3) });
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
    if (!llmAvailable()) return res.json({ offline: true, added: 0, drills: await allDrills(userId, track) });
    const cat = catFor(tech) || tech;
    const role = profile.domain || "specialist";
    // Read the pool BEFORE generating, not just after: the questions the candidate already has go
    // INTO the prompt as an exclusion list. That's what makes "generate more" actually generate
    // more — the loop below drops any task whose `q` is already present, so without telling the
    // model what to avoid, a second click on the same tech reliably added 0. It also keeps the
    // cache honest: the cache key hashes the whole prompt, so a pool that has grown produces a new
    // key, while a click that genuinely changed nothing still gets served the cached answer.
    const existingQ = new Set((await allDrills(userId, track)).map((d) => d.q));
    // Capped on both axes — a task statement can run long, and 40 full ones would cost more input
    // tokens than the 3 tasks being asked for. The opening clause is enough to recognize the topic.
    const avoid = [...existingQ].slice(0, 40).map((q) => q.slice(0, 120));
    const out = await chatJson(
      userId,
      "You are the author of practical interview tasks. Respond ONLY with valid JSON (code/identifiers/library names in fields may stay in English as is conventional for technical writing).",
      `The candidate (${role}) knows: ${profile.skills.join(", ") || "—"}. Needs to brush up on "${tech}".\n` +
        `Generate 3 new practical interview-level tasks specifically for "${tech}", of varying difficulty.\n` +
        (avoid.length
          ? `The candidate ALREADY has the tasks below — every task you return must cover different ground, ` +
            `not a reworded version of one of these:\n${avoid.map((q) => `- ${q}`).join("\n")}\n`
          : "") +
        `Format strictly: {"drills":[{"q":"task statement","lvl":"easy|med|hard","sol":"short sample solution","exp":"1-2 sentence explanation"}]}`,
      GenDrillsSchema,
      // cache: true — llm/client.ts's cache key hashes the full prompt, which now includes the
      // exclusion list above, so a repeat click after new tasks were added is a genuine cache MISS
      // (different pool → different prompt) while a retry after a transient failure, or a click
      // that added nothing, still hits — the dedupe benefit without the "generate more does
      // nothing forever" behavior that a pool-independent key produced.
      { maxTokens: 1200, temperature: 0.6, cache: true, tier: "smart", feature: "study-generate-drills", outputLocale: "app" },
    );
    if (!out) return res.json({ offline: true, added: 0, drills: await allDrills(userId, track) });
    const items = out.drills;
    const gen = await genDrills(userId);
    let added = 0;
    for (const it of items.slice(0, 3)) {
      if (existingQ.has(it.q)) continue;
      gen.push({
        id: `gen-${slugify(tech)}-${Date.now().toString(36)}-${added}`,
        cat,
        lvl: it.lvl,
        q: it.q,
        sol: it.sol,
        exp: it.exp,
        generated: true,
        tech,
      });
      existingQ.add(it.q);
      added++;
    }
    await setKvJson(userId, "genDrills", gen);
    res.json({ added, drills: await allDrills(userId, track) });
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
    // Same exclusion-list reasoning as /study/generate above — the loop below drops any card whose
    // question already exists, so the model has to be told which ones those are.
    const existingQ = new Set((await allCards(userId, track)).map((c) => c.q));
    const avoid = [...existingQ].slice(0, 40).map((q) => q.slice(0, 120));
    const out = await chatJson(
      userId,
      "You are the author of flashcards for interview prep. Respond ONLY with valid JSON.",
      `Role/topic: "${topic}" (candidate — ${role}).\n` +
        `Generate 5 flashcards, "question → concise accurate answer", at interview level.\n` +
        (avoid.length
          ? `The candidate ALREADY has the questions below — every card you return must ask about ` +
            `something else, not a reworded version of one of these:\n${avoid.map((q) => `- ${q}`).join("\n")}\n`
          : "") +
        `Format strictly: {"cards":[{"q":"question","a":"answer in 2-4 sentences"}]}`,
      GenCardsSchema,
      // cache: true — same reasoning as study-generate-drills above: the exclusion list is part of
      // the hashed prompt, so a grown pool misses the cache while a retry still hits.
      { maxTokens: 900, temperature: 0.5, cache: true, tier: "fast", feature: "study-generate-cards", outputLocale: "app" },
    );
    const items = out?.cards ?? [];
    const gen = await genCards(userId);
    let added = 0;
    for (const it of items.slice(0, 5)) {
      if (existingQ.has(it.q)) continue;
      gen.push({ id: `genc-${slugify(topic)}-${Date.now().toString(36)}-${added}`, cat: topic, q: it.q, a: it.a, generated: true });
      existingQ.add(it.q);
      added++;
    }
    await setKvJson(userId, "genCards", gen);
    res.json({ added });
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
    const prev =
      existing?.difficulty != null && existing?.stability != null
        ? { difficulty: existing.difficulty, stability: existing.stability }
        : null;
    // How many days have passed since the last review — the key input into the FSRS
    // retrievability formula; for a new card (prev===null), elapsedDays is ignored inside scheduleFsrs.
    const elapsedDays = existing?.lastReview
      ? Math.max(0, Math.round((now.getTime() - new Date(existing.lastReview).getTime()) / 86400000))
      : 0;
    const { difficulty, stability, intervalDays } = scheduleFsrs(prev, elapsedDays, rating);
    const reps = (existing?.reps || 0) + 1;
    const due = new Date(now.getTime() + intervalDays * 86400000).toISOString().slice(0, 10);
    const lastReview = now.toISOString();
    await recordSrsGrade(userId, cardId, { difficulty, stability, interval: intervalDays, due, reps, lastReview });
    const streak = await recordStudyActivity(userId);
    res.json({ ok: true, due, interval: intervalDays, difficulty, stability, streak });
  }),
);

export default r;
