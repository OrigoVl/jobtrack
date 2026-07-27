import express from "express";
import { getProfile } from "../../db/index.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";

const r = express.Router();

// ---------- Мок-інтерв'ю: LLM-оцінка відповіді кандидата ----------
r.post(
  "/mock/evaluate",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const question = String(req.body?.question || "").slice(0, 2000);
    const answer = String(req.body?.answer || "").trim();
    const reference = String(req.body?.reference || "").slice(0, 2000);
    if (answer.length < 2) throw new HttpError(400, "Порожня відповідь");
    if (!llmAvailable())
      return res.json({ offline: true, score: null, verdict: "AI офлайн — увімкни ключ у server/.env для оцінки відповідей." });
    const role = getProfile().domain || "фахівець";
    const out = await chat(
      `Ти доброзичливий, але вимогливий інтерв'юер для ролі «${role}». Оцінюєш відповідь кандидата чесно. Відповідай ЛИШЕ валідним JSON українською.`,
      `Питання: ${question}\n` +
        `Еталон-орієнтир: ${reference || "—"}\n` +
        `Відповідь кандидата: ${answer.slice(0, 2000)}\n\n` +
        `Оціни відповідь. Поверни JSON строго: {"score":<0-100>,"verdict":"1 речення підсумку","good":["що добре, 1-3"],"missed":["що пропущено/неточно, 1-3"],"tip":"1 конкретна порада"}`,
      { json: true, maxTokens: 500, temperature: 0.3, cache: true, tier: "smart" },
    );
    if (!out || typeof out.score !== "number") {
      // offline:true — LLM-виклик не дав валідної оцінки (помилка провайдера/таймаут/неправильний
      // JSON), тож це такий самий "не справжній AI-результат" стан, як і llmAvailable()===false вище.
      return res.json({ offline: true, score: null, verdict: "Не вдалося оцінити — спробуй ще раз." });
    }
    res.json({
      score: Math.max(0, Math.min(100, Math.round(out.score))),
      verdict: typeof out.verdict === "string" ? out.verdict : "",
      good: Array.isArray(out.good) ? out.good.filter((x: unknown): x is string => typeof x === "string") : [],
      missed: Array.isArray(out.missed) ? out.missed.filter((x: unknown): x is string => typeof x === "string") : [],
      tip: typeof out.tip === "string" ? out.tip : "",
    });
  }),
);

export default r;
