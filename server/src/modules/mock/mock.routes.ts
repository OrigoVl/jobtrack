import express from "express";
import { z } from "zod";
import { getProfile } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { synthesizeSpeech } from "../../llm/tts.js";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { getVacancy } from "../vacancies/vacancies.repo.js";
import { parseInterviewTurnInput } from "../../shared/validation.js";
import { runInterviewTurn } from "./mock-interview.service.js";

const SpeakInput = z.object({ text: z.string().min(1) });

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
  authed(async (userId, req, res) => {
    const question = String(req.body?.question || "").slice(0, 2000);
    const answer = String(req.body?.answer || "").trim();
    const reference = String(req.body?.reference || "").slice(0, 2000);
    if (answer.length < 2) throw new HttpError(400, "Empty answer");
    if (!llmAvailable())
      return res.json({ offline: true, score: null, verdict: "AI offline — set a key in server/.env to evaluate answers." });
    const role = (await getProfile(userId)).domain || "professional";
    const out = await chatJson(
      userId,
      `You are a friendly but demanding interviewer for the role "${role}". You evaluate the candidate's answer honestly. Respond with ONLY valid JSON.`,
      `Question: ${question}\n` +
        `Reference answer: ${reference || "—"}\n` +
        `Candidate's answer: ${answer.slice(0, 2000)}\n\n` +
        `Evaluate the answer. Return JSON strictly: {"score":<0-100>,"verdict":"1 sentence summary","good":["what's good, 1-3"],"missed":["what was missed/inaccurate, 1-3"],"tip":"1 concrete tip"}`,
      MockEvalSchema,
      { maxTokens: 500, temperature: 0.3, cache: true, tier: "smart", feature: "mock-interview", outputLocale: "app" },
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

// ---------- Live voice mock interview: stateless turn endpoint (see mock-interview.service.ts) ----------
r.post(
  "/mock/interview",
  aiLimiter,
  authed(async (userId, req, res) => {
    const input = parseInterviewTurnInput(req.body);
    const vacancy = input.vacancyId != null ? await getVacancy(userId, input.vacancyId) : undefined;
    // A vacancy id that doesn't resolve is a real error on the FIRST turn (the id came from the
    // user's own freshly-fetched list) but must not kill a session already in progress if the
    // vacancy gets deleted mid-sitting — degrade to a general interview instead of 400ing.
    if (input.vacancyId != null && !vacancy && input.transcript.length === 0) {
      throw new HttpError(400, `Unknown vacancy: ${input.vacancyId}`);
    }
    const profile = await getProfile(userId);
    res.json(await runInterviewTurn(userId, vacancy ?? null, profile, input));
  }),
);

// ---------- Live voice mock interview: cloud text-to-speech for the interviewer's lines ----------
// Falls back to the client's browser Web Speech API whenever this responds 204 (TTS unavailable/
// over the daily cost cap/API failure) — see synthesizeSpeech's own doc comment for why it
// returns null instead of throwing in every one of those cases.
r.post(
  "/mock/speak",
  aiLimiter,
  authed(async (userId, req, res) => {
    const input = SpeakInput.parse(req.body);
    const audio = await synthesizeSpeech(userId, input.text);
    if (!audio) return res.status(204).end();
    res.setHeader("Content-Type", "audio/mpeg");
    res.status(200).send(audio);
  }),
);

export default r;
