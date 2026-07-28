import express from "express";
import { z } from "zod";
import { getProfile } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";

const r = express.Router();

const MockEvalSchema = z.object({
  score: z.number(),
  verdict: z.string().catch(""),
  good: z.array(z.string()).catch([]),
  missed: z.array(z.string()).catch([]),
  tip: z.string().catch(""),
});

// ---------- Mock interview: LLM evaluation of the candidate's answer ----------
r.post(
  "/mock/evaluate",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const question = String(req.body?.question || "").slice(0, 2000);
    const answer = String(req.body?.answer || "").trim();
    const reference = String(req.body?.reference || "").slice(0, 2000);
    if (answer.length < 2) throw new HttpError(400, "Empty answer");
    if (!llmAvailable())
      return res.json({ offline: true, score: null, verdict: "AI offline — set a key in server/.env to evaluate answers." });
    const role = getProfile().domain || "professional";
    const out = await chatJson(
      `You are a friendly but demanding interviewer for the role "${role}". You evaluate the candidate's answer honestly. Respond with ONLY valid JSON in English.`,
      `Question: ${question}\n` +
        `Reference answer: ${reference || "—"}\n` +
        `Candidate's answer: ${answer.slice(0, 2000)}\n\n` +
        `Evaluate the answer. Return JSON strictly: {"score":<0-100>,"verdict":"1 sentence summary","good":["what's good, 1-3"],"missed":["what was missed/inaccurate, 1-3"],"tip":"1 concrete tip"}`,
      MockEvalSchema,
      { maxTokens: 500, temperature: 0.3, cache: true, tier: "smart" },
    );
    if (!out) {
      // offline:true — the LLM call didn't produce a valid evaluation even after chatJson's
      // repair-retry (provider error/timeout/malformed JSON), so this is the same "not a real
      // AI result" state as llmAvailable()===false above.
      return res.json({ offline: true, score: null, verdict: "Couldn't evaluate — try again." });
    }
    res.json({
      score: Math.max(0, Math.min(100, Math.round(out.score))),
      verdict: out.verdict,
      good: out.good,
      missed: out.missed,
      tip: out.tip,
    });
  }),
);

export default r;
