// Cloud text-to-speech (OpenAI `gpt-4o-mini-tts`) for the voice mock-interview feature — replaces
// the fully-robotic browser Web Speech API voice with a natural-sounding neural voice. A small,
// focused OpenAI-specific client, mirroring embeddings.ts's shape: separate from the main
// chat/chatJson code in client.ts.
//
// Deliberately NOT gated by llmAvailable() (client.ts) — that check is provider-selection-aware
// and can be true even when only ANTHROPIC_API_KEY is set (LLM_PROVIDER="anthropic"). TTS
// specifically requires the OpenAI key regardless of which provider LLM_PROVIDER currently
// points at, since Anthropic has no TTS product — see ttsAvailable() below.
import { contextLogger } from "../core/logger.js";
import { env } from "../config/env.js";
import type { UserId } from "../db/user-id.js";
import { insertLlmUsage, getUserCostUsdSince } from "../telemetry/telemetry.repo.js";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_VOICE = "cedar";
const TTS_INSTRUCTIONS =
  "Speak calmly and naturally, like a professional but warm interviewer conducting a real " +
  "one-on-one job interview. Natural pacing — not rushed, not slow. Sound like a real person, " +
  "not a narrator.";
// gpt-4o-mini-tts is priced per INPUT CHARACTER ($12 / 1,000,000 characters), not per token —
// a different billing unit than pricing.ts's per-1M-TOKEN table, so it's computed inline here
// rather than forced through estimateCostUsd() (see synthesizeSpeech below).
const USD_PER_CHAR = 12 / 1_000_000;
// The same "fast" tier timeout budget as llm/client.ts's fast-tier chat calls (embeddings.ts
// reuses the same constant for the same reason) — a spoken interview line shouldn't wait longer
// than a fast LLM extraction would.
const TIMEOUT_MS = env.llm.timeoutMsFast;

export function ttsAvailable(): boolean {
  return !!env.llm.openaiApiKey;
}

/**
 * Synthesizes `text` into an mp3 Buffer via OpenAI's `/v1/audio/speech`, or returns `null` if
 * TTS is unavailable, the input is empty, the user is already over the daily cost cap, or the
 * API call fails for any reason — NEVER throws (graceful, like chat()/embed()). The caller
 * (mock.routes.ts) falls back to the browser's Web Speech API whenever this returns `null`.
 */
export async function synthesizeSpeech(userId: UserId, text: string): Promise<Buffer | null> {
  if (!ttsAvailable()) return null;
  const input = text.trim();
  if (!input) return null;

  // Reuse the same per-user daily $ cap that chat() (llm/client.ts) enforces — TTS spend counts
  // toward the SAME cap (they share llm_usage/costUsd), so a user already over budget on chat
  // calls also stops getting cloud TTS, falling back to the free browser voice instead of
  // adding an unbounded extra cost on top of an already-tripped cap.
  if (env.llm.dailyCostCapUsd > 0) {
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const spentToday = await getUserCostUsdSince(userId, startOfDayUtc);
    // null means the telemetry read itself failed — fail OPEN (allow the call), same reasoning
    // as llm/client.ts's own cap check.
    if (spentToday !== null && spentToday >= env.llm.dailyCostCapUsd) {
      contextLogger().warn(
        { userId, spentToday, capUsd: env.llm.dailyCostCapUsd },
        "User's daily LLM cost cap reached, skipping cloud TTS for this line",
      );
      return null;
    }
  }

  const costUsd = input.length * USD_PER_CHAR;
  const started = Date.now();
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${env.llm.openaiApiKey}` },
      body: JSON.stringify({
        model: TTS_MODEL,
        input,
        voice: TTS_VOICE,
        instructions: TTS_INSTRUCTIONS,
        response_format: "mp3",
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      contextLogger().error({ status: r.status, body: body.slice(0, 500), model: TTS_MODEL }, "TTS API error response");
      recordTtsUsage(userId, 0, Date.now() - started, "error");
      return null;
    }
    const audio = Buffer.from(await r.arrayBuffer());
    recordTtsUsage(userId, costUsd, Date.now() - started, "success");
    return audio;
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    contextLogger().error({ err: e, model: TTS_MODEL }, timedOut ? "TTS request timeout" : "TTS request error");
    recordTtsUsage(userId, 0, Date.now() - started, "error");
    return null;
  }
}

// Fire-and-forget, same as llm/client.ts's recordLlmUsage/embeddings.ts's recordEmbeddingUsage —
// this reuses the existing llm_usage telemetry path exactly (no parallel cost-tracking table),
// so TTS spend automatically shows up in the admin's byModel/byTier/byFeature dashboards and
// counts toward the existing per-user daily cost cap. `tier: null` — TTS has no fast/smart tier
// concept. `inputTokens`/`outputTokens` are left at 0 (this call isn't token-billed at all); the
// real $ amount is passed via `costUsd`, which telemetry.repo.ts's insertLlmUsage() uses verbatim
// instead of deriving it from a token count when provided.
function recordTtsUsage(userId: UserId, costUsd: number, latencyMs: number, outcome: "success" | "error"): void {
  void insertLlmUsage({
    userId,
    feature: "voice-tts",
    provider: "openai",
    model: TTS_MODEL,
    tier: null,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd,
    cacheHit: false,
    latencyMs,
    outcome,
  });
}
