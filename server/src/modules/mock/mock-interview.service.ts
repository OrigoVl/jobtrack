// Pure business logic for the live voice mock interview — split out of mock.routes.ts (which stays
// thin: parse request -> delegate -> respond), same reasoning as cv-tailor.service.ts. The route is
// stateless: the CLIENT owns the whole conversation and resends it (transcript) on every turn, so
// there is no session id and no new DB table — a live interview is one sitting, not a resumable
// thread.
import { z } from "zod";
import { chatJson, llmAvailable } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Profile, VacancyRow } from "../../db/types.js";
import type { InterviewTurnInput } from "../../shared/validation.js";

export const MIN_TURNS = 3;
export const MAX_TURNS = 10;

export interface InterviewReview {
  score: number;
  verdict: string;
  good: string[];
  missed: string[];
  tip: string;
}

export interface InterviewTurnResult {
  offline?: boolean;
  /** true only for a transient failure (chatJson returned null mid-interview) — the client should
   * keep the transcript and let the user retry the exact same call, not restart the interview. */
  retryable?: boolean;
  done: boolean;
  question: string;
  review: InterviewReview | null;
  turnNumber: number;
  maxTurns: number;
}

/** Same field set as cv-builder.tsx's client-side vacancyJobText — rebuilt server-side since this
 * is the first place in the app a vacancy is fed into a prompt purely by id (every other LLM call
 * site composes the vacancy text on the client and sends it as a string). */
export function buildVacancyContext(vacancy: VacancyRow | null, profile: Profile): string {
  if (!vacancy) {
    const domain = profile.domain || "software";
    const skills = profile.skills.length ? ` Candidate's known skills: ${profile.skills.join(", ")}.` : "";
    return `A general professional interview for a ${domain} role.${skills}`;
  }
  return [
    `${vacancy.position}${vacancy.company ? ` @ ${vacancy.company}` : ""}`,
    vacancy.level ? `Level: ${vacancy.level}` : "",
    vacancy.stack.length ? `Stack: ${vacancy.stack.join(", ")}` : "",
    vacancy.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderTranscript(transcript: { q: string; a: string }[]): string {
  if (transcript.length === 0) return "(nothing yet — this is the opening question)";
  return transcript.map((t, i) => `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a}`).join("\n\n");
}

export function buildAskPrompt(context: string, transcript: { q: string; a: string }[]): string {
  return (
    `Vacancy/candidate context:\n${context}\n\n` +
    `Interview transcript so far:\n${renderTranscript(transcript)}\n\n` +
    `Ask the next question. Return JSON strictly: {"question":"<the next interview question>"}`
  );
}

export function buildReviewPrompt(context: string, transcript: { q: string; a: string }[]): string {
  return (
    `Vacancy/candidate context:\n${context}\n\n` +
    `Full interview transcript:\n${renderTranscript(transcript)}\n\n` +
    `Return JSON strictly: {"score":<0-100>,"verdict":"1-2 sentence overall verdict",` +
    `"good":["what the candidate did well, 1-3"],"missed":["what was weak/missing, 1-3"],"tip":"1 concrete tip for next time"}`
  );
}

export function clampReview(raw: { score: number; verdict: string; good: string[]; missed: string[]; tip: string }): InterviewReview {
  return { ...raw, score: Math.max(0, Math.min(100, Math.round(raw.score))) };
}

const ASK_SYSTEM =
  "You are conducting a live mock interview. Ask ONE clear, focused question at a time — technical " +
  "or behavioral, appropriate to the seniority implied by the context. Briefly acknowledge the " +
  "candidate's last answer before asking the next question. Respond with ONLY valid JSON.";
const REVIEW_SYSTEM =
  "The interview is over. Give a holistic final assessment of the candidate's performance across " +
  "the whole conversation. Respond with ONLY valid JSON.";

const AskSchema = z.object({ question: z.string().catch("") });
const ReviewSchema = z.object({
  score: z.coerce.number().catch(0),
  verdict: z.string().catch(""),
  good: z.array(z.string()).catch([]),
  missed: z.array(z.string()).catch([]),
  tip: z.string().catch(""),
});

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function runInterviewTurn(
  userId: UserId,
  vacancy: VacancyRow | null,
  profile: Profile,
  input: InterviewTurnInput,
): Promise<InterviewTurnResult> {
  const maxTurns = clamp(input.maxTurns, MIN_TURNS, MAX_TURNS);
  const turnNumber = input.transcript.length + 1;
  if (!llmAvailable()) return { offline: true, done: true, question: "", review: null, turnNumber, maxTurns };
  const context = buildVacancyContext(vacancy, profile);

  if (input.transcript.length < maxTurns) {
    // "fast" tier + no cache: many small calls per interview, and the opening-question prompt
    // (empty transcript) is byte-identical across every user interviewing for "no vacancy" or the
    // same vacancy — caching would serve the same opening question to everyone forever and mute
    // `temperature`. Mid-interview turns are effectively never identical anyway (the whole
    // transcript is part of the prompt), so caching would buy nothing there either.
    const out = await chatJson(userId, ASK_SYSTEM, buildAskPrompt(context, input.transcript), AskSchema, {
      maxTokens: 400,
      temperature: 0.6,
      tier: "fast",
      feature: "voice-interview",
      outputLocale: "app",
    });
    if (!out) return { offline: true, retryable: true, done: false, question: "", review: null, turnNumber, maxTurns };
    return { done: false, question: out.question, review: null, turnNumber, maxTurns };
  }

  // Review mode: transcript.length >= maxTurns — every question has been answered. "smart" tier
  // for the one holistic assessment (quality matters more here than in any single "ask" call).
  const out = await chatJson(userId, REVIEW_SYSTEM, buildReviewPrompt(context, input.transcript), ReviewSchema, {
    maxTokens: 900,
    temperature: 0.3,
    tier: "smart",
    feature: "voice-interview",
    outputLocale: "app",
  });
  if (!out) return { offline: true, retryable: true, done: false, question: "", review: null, turnNumber, maxTurns };
  return { done: true, question: "", review: clampReview(out), turnNumber, maxTurns };
}
