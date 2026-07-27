import express from "express";
import { getProfile } from "../../db/index.js";
import { extractTechs } from "../../shared/tech-dict.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";

const r = express.Router();

// ---------- LLM: cover letter / rewrite ----------
r.post(
  "/llm/cover-letter",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const { vacancyText, company } = req.body || {};
    const profile = getProfile();
    if (!llmAvailable()) {
      return res.json({
        text: `Доброго дня!\n\nМене зацікавила ваша вакансія${company ? " в " + company : ""}. Маю 7 років досвіду Full-Stack (Vue, Node.js, NestJS) та практику AI-інтеграції. Готовий детальніше обговорити, чим можу бути корисним.\n\nЗ повагою, Michael`,
        offline: true,
      });
    }
    const vt = String(vacancyText || "");
    const techs = extractTechs(vt).map((t) => t.name);
    const matched = techs.filter((t) => profile.skills.includes(t));
    const text = await chat(
      "Ти пишеш короткі персоналізовані cover letter українською. По суті, без кліше й води, теплий професійний тон. Не вигадуй фактів, яких немає в резюме.",
      `Резюме кандидата:\n${profile.cvText}\n\n` +
        `Вакансія${company ? ` (${company})` : ""}:\n${vt.slice(0, 3000)}\n\n` +
        `Технології вакансії, які кандидат уже має: ${matched.join(", ") || "—"}.\n` +
        `Напиши cover letter (4–6 речень): чіпляючий вступ → 2–3 релевантні збіги досвіду під вимоги → коротке закриття з готовністю поспілкуватись.`,
      { maxTokens: 500, temperature: 0.7, cache: true, tier: "smart" },
    );
    res.json({ text: text || "" });
  }),
);
r.post(
  "/llm/rewrite",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const { text, tone } = req.body || {};
    if (!llmAvailable()) return res.json({ text, offline: true });
    const out = await chat(
      "Ти редактор резюме. Переписуй лаконічно, з дієсловами дії, англійською.",
      `Перепиши цей пункт досвіду${tone ? " у тоні: " + tone : ""}: ${text}`,
      { maxTokens: 200, cache: true },
    );
    res.json({ text: out || text });
  }),
);

export default r;
