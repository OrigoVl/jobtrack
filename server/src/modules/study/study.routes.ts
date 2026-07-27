import express from "express";
import db, { getProfile, getDrillProgress, setDrillStatus, setKvJson, getSrsStateByCard } from "../../db/index.js";
import { catFor } from "../knowledge/knowledge-base.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { CARDS } from "./content.js";
import { slugify } from "../../shared/slug.js";
import { genDrills, allDrills, genCards, allCards } from "./content-store.js";
import { scheduleFsrs, type FsrsRating } from "./fsrs.js";
import type { SrsRow } from "../../db/types.js";

const r = express.Router();

// ---------- study: SRS + drills ----------
r.get("/study/content", (_q, res) => res.json({ cards: CARDS, drills: allDrills(), drillProgress: getDrillProgress() }));
r.put("/study/drill", (req, res) => {
  const id = String(req.body?.id || "");
  const status = String(req.body?.status || "todo");
  if (!allDrills().some((d) => d.id === id)) throw new HttpError(400, `Невідома задача: "${id}"`);
  if (status !== "solved" && status !== "todo") throw new HttpError(400, `Невідомий статус: "${status}"`);
  res.json({ ok: true, progress: setDrillStatus(id, status) });
});

// прогресивні підказки до задачі (LLM, кеш) — не розкриваємо розв'язок одразу
r.post(
  "/study/drill-hint",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.body?.id || "");
    const drill = allDrills().find((d) => d.id === id);
    if (!drill) throw new HttpError(400, `Невідома задача: "${id}"`);
    if (!llmAvailable()) return res.json({ offline: true, hints: [] });
    const out = await chat(
      "Ти ментор. Даєш прогресивні підказки до завдання, НЕ розкриваючи повного розв'язку одразу. Відповідай ЛИШЕ валідним JSON українською.",
      `Завдання (${drill.cat}, ${drill.lvl}): ${drill.q}\n` +
        `Дай 3 підказки від найтоншої до найсильнішої (напрям думки → підхід/структура → майже розв'язок, але без готового коду). Формат: {"hints":["...","...","..."]}`,
      { json: true, maxTokens: 400, temperature: 0.3, cache: true },
    );
    const hints: string[] = Array.isArray(out?.hints)
      ? out.hints.filter((x: unknown): x is string => typeof x === "string").slice(0, 3)
      : [];
    res.json({ hints });
  }),
);

// генерація персональних задач саме під технологію-прогалину (доповнює статичний пул)
r.post(
  "/study/generate",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const tech = String(req.body?.tech || "")
      .trim()
      .slice(0, 60);
    if (!tech) throw new HttpError(400, "Не вказано технологію");
    if (!llmAvailable()) return res.json({ offline: true, added: 0, drills: allDrills() });
    const cat = catFor(tech) || tech;
    const profile = getProfile();
    const role = profile.domain || "фахівець";
    const out = await chat(
      "Ти автор практичних співбесідних завдань. Відповідай ЛИШЕ валідним JSON українською (код/приклади у полях — за потреби англійською).",
      `Кандидат (${role}) знає: ${profile.skills.join(", ") || "—"}. Треба підтягнути «${tech}».\n` +
        `Згенеруй 3 нові практичні завдання рівня співбесіди саме під «${tech}», різної складності.\n` +
        `Формат строго: {"drills":[{"q":"умова завдання","lvl":"easy|med|hard","sol":"коротке зразкове рішення","exp":"1-2 речення пояснення"}]}`,
      { json: true, maxTokens: 1200, temperature: 0.6, tier: "smart" },
    );
    interface GenDrillCandidate {
      q?: unknown;
      lvl?: unknown;
      sol?: unknown;
      exp?: unknown;
    }
    const items: GenDrillCandidate[] = Array.isArray(out?.drills) ? out.drills : [];
    const gen = genDrills();
    const existingQ = new Set(allDrills().map((d) => d.q));
    let added = 0;
    for (const it of items.slice(0, 3)) {
      if (!it || typeof it.q !== "string" || typeof it.sol !== "string" || existingQ.has(it.q)) continue;
      const lvl = ["easy", "med", "hard"].includes(it.lvl as string) ? (it.lvl as string) : "med";
      gen.push({
        id: `gen-${slugify(tech)}-${Date.now().toString(36)}-${added}`,
        cat,
        lvl,
        q: it.q,
        sol: it.sol,
        exp: typeof it.exp === "string" ? it.exp : "",
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

// генерація персональних флеш-карток під домен/тему (доповнює статичний пул SRS)
r.post(
  "/study/generate-cards",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const profile = getProfile();
    const role = profile.domain || "фахівець";
    const topic =
      String(req.body?.topic || "")
        .trim()
        .slice(0, 60) || role;
    if (!topic) throw new HttpError(400, "Не вказано тему");
    if (!llmAvailable()) return res.json({ offline: true, added: 0 });
    const out = await chat(
      "Ти автор флеш-карток для підготовки до співбесід. Відповідай ЛИШЕ валідним JSON українською.",
      `Роль/тема: «${topic}» (кандидат — ${role}).\n` +
        `Згенеруй 5 флеш-карток «питання → стисла точна відповідь» рівня співбесіди.\n` +
        `Формат строго: {"cards":[{"q":"питання","a":"відповідь на 2-4 речення"}]}`,
      { json: true, maxTokens: 900, temperature: 0.5, tier: "smart" },
    );
    interface GenCardCandidate {
      q?: unknown;
      a?: unknown;
    }
    const items: GenCardCandidate[] = Array.isArray(out?.cards) ? out.cards : [];
    const gen = genCards();
    const existingQ = new Set(allCards().map((c) => c.q));
    let added = 0;
    for (const it of items.slice(0, 5)) {
      if (!it || typeof it.q !== "string" || typeof it.a !== "string" || existingQ.has(it.q)) continue;
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
  if (typeof cardId !== "string" || !allCards().some((c) => c.id === cardId)) throw new HttpError(400, "Невідома картка");
  // 1=Знову (не пам'ятаю), 2=Важко, 3=Добре, 4=Легко — 4-точкова шкала FSRS замість старої
  // бінарної (0/1), щоб алгоритм міг розрізняти "ледь згадав" від "згадав миттєво" —
  // це і є основний виграш FSRS над SM-2 з бінарною оцінкою.
  if (grade !== 1 && grade !== 2 && grade !== 3 && grade !== 4) {
    throw new HttpError(400, "grade має бути 1-4 (FSRS: 1=Знову, 2=Важко, 3=Добре, 4=Легко)");
  }
  const rating = grade as FsrsRating;
  const now = new Date();
  const existing = db.prepare("SELECT * FROM srs WHERE cardId=?").get(cardId) as SrsRow | undefined;
  const prev = existing?.difficulty != null && existing?.stability != null
    ? { difficulty: existing.difficulty, stability: existing.stability }
    : null;
  // Скільки днів минуло від останнього огляду — ключовий вхід у формулу retrievability
  // FSRS; для нової картки (prev===null) elapsedDays ігнорується всередині scheduleFsrs.
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
