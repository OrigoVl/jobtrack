import express from "express";
import { z } from "zod";
import db, { getProfile, getDrillProgress, setDrillStatus, setKvJson, getSrsStateByCard } from "../../db/index.js";
import { catFor } from "../knowledge/knowledge-base.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { CARDS } from "./content.js";
import { slugify } from "../../shared/slug.js";
import { genDrills, allDrills, genCards, allCards } from "./content-store.js";
import { scheduleFsrs, type FsrsRating } from "./fsrs.js";
import type { SrsRow } from "../../db/types.js";

const r = express.Router();

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
r.get("/study/content", (_q, res) => res.json({ cards: CARDS, drills: allDrills(), drillProgress: getDrillProgress() }));
r.put("/study/drill", (req, res) => {
  const id = String(req.body?.id || "");
  const status = String(req.body?.status || "todo");
  if (!allDrills().some((d) => d.id === id)) throw new HttpError(400, `Unknown task: "${id}"`);
  if (status !== "solved" && status !== "todo") throw new HttpError(400, `Unknown status: "${status}"`);
  res.json({ ok: true, progress: setDrillStatus(id, status) });
});

// progressive hints for a task (LLM, cached) — don't reveal the solution right away
r.post(
  "/study/drill-hint",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.body?.id || "");
    const drill = allDrills().find((d) => d.id === id);
    if (!drill) throw new HttpError(400, `Unknown task: "${id}"`);
    if (!llmAvailable()) return res.json({ offline: true, hints: [] });
    const out = await chatJson(
      "You are a mentor. You give progressive hints for a task WITHOUT revealing the full solution right away. Respond ONLY with valid JSON in English.",
      `Task (${drill.cat}, ${drill.lvl}): ${drill.q}\n` +
        `Give 3 hints from the subtlest to the strongest (direction of thought → approach/structure → almost the solution, but without ready-made code). Format: {"hints":["...","...","..."]}`,
      HintsSchema,
      { maxTokens: 400, temperature: 0.3, cache: true },
    );
    const hints: string[] = (out?.hints ?? []).slice(0, 3);
    res.json({ hints });
  }),
);

// generate personal tasks specifically for a gap technology (supplements the static pool)
r.post(
  "/study/generate",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const tech = String(req.body?.tech || "")
      .trim()
      .slice(0, 60);
    if (!tech) throw new HttpError(400, "No technology specified");
    if (!llmAvailable()) return res.json({ offline: true, added: 0, drills: allDrills() });
    const cat = catFor(tech) || tech;
    const profile = getProfile();
    const role = profile.domain || "specialist";
    const out = await chatJson(
      "You are the author of practical interview tasks. Respond ONLY with valid JSON in English (code/examples in fields can be in English as needed).",
      `The candidate (${role}) knows: ${profile.skills.join(", ") || "—"}. Needs to brush up on "${tech}".\n` +
        `Generate 3 new practical interview-level tasks specifically for "${tech}", of varying difficulty.\n` +
        `Format strictly: {"drills":[{"q":"task statement","lvl":"easy|med|hard","sol":"short sample solution","exp":"1-2 sentence explanation"}]}`,
      GenDrillsSchema,
      { maxTokens: 1200, temperature: 0.6, tier: "smart" },
    );
    const items = out?.drills ?? [];
    const gen = genDrills();
    const existingQ = new Set(allDrills().map((d) => d.q));
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
    setKvJson("genDrills", gen);
    res.json({ added, drills: allDrills() });
  }),
);

// generate personal flashcards for a domain/topic (supplements the static SRS pool)
r.post(
  "/study/generate-cards",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const profile = getProfile();
    const role = profile.domain || "specialist";
    const topic =
      String(req.body?.topic || "")
        .trim()
        .slice(0, 60) || role;
    if (!topic) throw new HttpError(400, "No topic specified");
    if (!llmAvailable()) return res.json({ offline: true, added: 0 });
    const out = await chatJson(
      "You are the author of flashcards for interview prep. Respond ONLY with valid JSON in English.",
      `Role/topic: "${topic}" (candidate — ${role}).\n` +
        `Generate 5 flashcards, "question → concise accurate answer", at interview level.\n` +
        `Format strictly: {"cards":[{"q":"question","a":"answer in 2-4 sentences"}]}`,
      GenCardsSchema,
      { maxTokens: 900, temperature: 0.5, tier: "smart" },
    );
    const items = out?.cards ?? [];
    const gen = genCards();
    const existingQ = new Set(allCards().map((c) => c.q));
    let added = 0;
    for (const it of items.slice(0, 5)) {
      if (existingQ.has(it.q)) continue;
      gen.push({ id: `genc-${slugify(topic)}-${Date.now().toString(36)}-${added}`, cat: topic, q: it.q, a: it.a, generated: true });
      existingQ.add(it.q);
      added++;
    }
    setKvJson("genCards", gen);
    res.json({ added });
  }),
);
r.get("/study/due", (_q, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const cards = allCards();
  const state = getSrsStateByCard();
  const due = cards.filter((c) => {
    const s = state[c.id];
    return !s || s.due <= today;
  });
  res.json({ due, total: cards.length, learned: Object.values(state).filter((s) => s.reps > 0).length });
});
r.post("/study/grade", (req, res) => {
  const { cardId, grade } = req.body || {};
  if (typeof cardId !== "string" || !allCards().some((c) => c.id === cardId)) throw new HttpError(400, "Unknown card");
  // 1=Again (forgot), 2=Hard, 3=Good, 4=Easy — a 4-point FSRS scale instead of the old
  // binary one (0/1), so the algorithm can distinguish "barely remembered" from "recalled
  // instantly" — this is the main advantage of FSRS over SM-2 with its binary rating.
  if (grade !== 1 && grade !== 2 && grade !== 3 && grade !== 4) {
    throw new HttpError(400, "grade must be 1-4 (FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy)");
  }
  const rating = grade as FsrsRating;
  const now = new Date();
  const existing = db.prepare("SELECT * FROM srs WHERE cardId=?").get(cardId) as SrsRow | undefined;
  const prev =
    existing?.difficulty != null && existing?.stability != null ? { difficulty: existing.difficulty, stability: existing.stability } : null;
  // How many days have passed since the last review — the key input into the FSRS
  // retrievability formula; for a new card (prev===null), elapsedDays is ignored inside scheduleFsrs.
  const elapsedDays = existing?.lastReview
    ? Math.max(0, Math.round((now.getTime() - new Date(existing.lastReview).getTime()) / 86400000))
    : 0;
  const { difficulty, stability, intervalDays } = scheduleFsrs(prev, elapsedDays, rating);
  const reps = (existing?.reps || 0) + 1;
  const due = new Date(now.getTime() + intervalDays * 86400000).toISOString().slice(0, 10);
  const lastReview = now.toISOString();
  db.prepare(
    `INSERT INTO srs (cardId, difficulty, stability, interval, due, reps, lastReview) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(cardId) DO UPDATE SET difficulty=excluded.difficulty, stability=excluded.stability,
       interval=excluded.interval, due=excluded.due, reps=excluded.reps, lastReview=excluded.lastReview`,
  ).run(cardId, difficulty, stability, intervalDays, due, reps, lastReview);
  res.json({ ok: true, due, interval: intervalDays, difficulty, stability });
});

export default r;
