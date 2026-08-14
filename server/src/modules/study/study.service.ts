// Business logic split out of study.routes.ts (which stays thin: parse request -> delegate ->
// respond), same reasoning as mock-interview.service.ts/design.service.ts: prompt-building,
// chatJson calls, dedup-against-existing-pool logic, and FSRS scheduling live here so they're
// unit-testable without Express.
import { z } from "zod";
import { chatJson, llmAvailable } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { SrsRow } from "../../db/types.js";
import type { DrillItem } from "./content.js";
import { scheduleFsrs, type FsrsRating } from "./fsrs.js";

// ---------- progressive hints for a task ----------

const HintsSchema = z.object({ hints: z.array(z.string()) });

export interface DrillHintsResult {
  offline: boolean;
  hints: string[];
}

export function buildDrillHintPrompt(drill: Pick<DrillItem, "cat" | "lvl" | "q">): string {
  return (
    `Task (${drill.cat}, ${drill.lvl}): ${drill.q}\n` +
    `Give 3 hints from the subtlest to the strongest (direction of thought → approach/structure → almost the solution, but without ready-made code). Format: {"hints":["...","...","..."]}`
  );
}

const HINT_SYSTEM =
  "You are a mentor. You give progressive hints for a task WITHOUT revealing the full solution right away. Respond ONLY with valid JSON.";

export async function requestDrillHints(userId: UserId, drill: Pick<DrillItem, "cat" | "lvl" | "q">): Promise<DrillHintsResult> {
  if (!llmAvailable()) return { offline: true, hints: [] };
  const out = await chatJson(userId, HINT_SYSTEM, buildDrillHintPrompt(drill), HintsSchema, {
    maxTokens: 400,
    temperature: 0.3,
    cache: true,
    feature: "study-hint",
    outputLocale: "app",
  });
  if (!out) return { offline: true, hints: [] };
  return { offline: false, hints: out.hints.slice(0, 3) };
}

// ---------- generate personal tasks for a gap technology (supplements the static pool) ----------

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

export type GeneratedDrillInput = z.infer<typeof GenDrillsSchema>["drills"][number];

export interface NewDrillEntry {
  cat: string;
  lvl: GeneratedDrillInput["lvl"];
  q: string;
  sol: string;
  exp: string;
  generated: true;
  tech: string;
}

const GEN_DRILLS_SYSTEM =
  "You are the author of practical interview tasks. Respond ONLY with valid JSON (code/identifiers/library names in fields may stay in English as is conventional for technical writing).";

/** Capped on both axes — a task/card statement can run long, and 40 full ones would cost more
 * input tokens than the handful being asked for. The opening clause is enough to recognize the
 * topic. Shared by both the drills and cards generators below. */
export function buildAvoidList(existingQ: Set<string>, max = 40, sliceLen = 120): string[] {
  return [...existingQ].slice(0, max).map((q) => q.slice(0, sliceLen));
}

export function buildGenerateDrillsPrompt(role: string, skills: string[], tech: string, avoid: string[]): string {
  return (
    `The candidate (${role}) knows: ${skills.join(", ") || "—"}. Needs to brush up on "${tech}".\n` +
    `Generate 3 new practical interview-level tasks specifically for "${tech}", of varying difficulty.\n` +
    (avoid.length
      ? `The candidate ALREADY has the tasks below — every task you return must cover different ground, ` +
        `not a reworded version of one of these:\n${avoid.map((q) => `- ${q}`).join("\n")}\n`
      : "") +
    `Format strictly: {"drills":[{"q":"task statement","lvl":"easy|med|hard","sol":"short sample solution","exp":"1-2 sentence explanation"}]}`
  );
}

/** Reads the existing pool BEFORE generating, not just after: the questions the candidate already
 * has go INTO the prompt as an exclusion list (via `avoid`, built from `buildAvoidList`). That's
 * what makes "generate more" actually generate more — `dedupeGeneratedDrills` below drops any
 * task whose `q` is already present, so without telling the model what to avoid, a second click on
 * the same tech reliably added 0. It also keeps the cache honest: the cache key hashes the whole
 * prompt, so a pool that has grown produces a new key, while a click that genuinely changed
 * nothing still gets served the cached answer. */
export async function requestGeneratedDrills(
  userId: UserId,
  role: string,
  skills: string[],
  tech: string,
  avoid: string[],
): Promise<{ offline: boolean; items: GeneratedDrillInput[] }> {
  if (!llmAvailable()) return { offline: true, items: [] };
  const out = await chatJson(userId, GEN_DRILLS_SYSTEM, buildGenerateDrillsPrompt(role, skills, tech, avoid), GenDrillsSchema, {
    // cache: true — llm/client.ts's cache key hashes the full prompt, which includes the
    // exclusion list above, so a repeat click after new tasks were added is a genuine cache MISS
    // (different pool → different prompt) while a retry after a transient failure, or a click
    // that added nothing, still hits — the dedupe benefit without the "generate more does
    // nothing forever" behavior that a pool-independent key produced.
    maxTokens: 1200,
    temperature: 0.6,
    cache: true,
    tier: "smart",
    feature: "study-generate-drills",
    outputLocale: "app",
  });
  if (!out) return { offline: true, items: [] };
  return { offline: false, items: out.drills };
}

/** Drops any generated item whose question is already in the pool, and caps at `limit` — note the
 * cap is applied BEFORE the dedup filter (matching the model's own ordering), so a generation
 * whose first `limit` items happen to collide can legitimately add fewer than `limit` new
 * entries even when later items in the full response weren't duplicates. Pure — id assignment
 * (which needs Date.now()) stays in the route, same split as design.service.ts's
 * appendDesignHistory / design.routes.ts's history-entry construction. */
export function dedupeGeneratedDrills(
  items: GeneratedDrillInput[],
  existingQ: Set<string>,
  cat: string,
  tech: string,
  limit = 3,
): NewDrillEntry[] {
  const seen = new Set(existingQ);
  const added: NewDrillEntry[] = [];
  for (const it of items.slice(0, limit)) {
    if (seen.has(it.q)) continue;
    added.push({ cat, lvl: it.lvl, q: it.q, sol: it.sol, exp: it.exp, generated: true, tech });
    seen.add(it.q);
  }
  return added;
}

// ---------- generate personal flashcards for a domain/topic (supplements the static SRS pool) ----------

const GenCardsSchema = z.object({ cards: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })) });
export type GeneratedCardInput = z.infer<typeof GenCardsSchema>["cards"][number];

export interface NewCardEntry {
  cat: string;
  q: string;
  a: string;
  generated: true;
}

const GEN_CARDS_SYSTEM = "You are the author of flashcards for interview prep. Respond ONLY with valid JSON.";

export function buildGenerateCardsPrompt(role: string, topic: string, avoid: string[]): string {
  return (
    `Role/topic: "${topic}" (candidate — ${role}).\n` +
    `Generate 5 flashcards, "question → concise accurate answer", at interview level.\n` +
    (avoid.length
      ? `The candidate ALREADY has the questions below — every card you return must ask about ` +
        `something else, not a reworded version of one of these:\n${avoid.map((q) => `- ${q}`).join("\n")}\n`
      : "") +
    `Format strictly: {"cards":[{"q":"question","a":"answer in 2-4 sentences"}]}`
  );
}

/** Same exclusion-list reasoning as requestGeneratedDrills above — `dedupeGeneratedCards` drops
 * any card whose question already exists, so the model has to be told which ones those are. */
export async function requestGeneratedCards(
  userId: UserId,
  role: string,
  topic: string,
  avoid: string[],
): Promise<{ offline: boolean; items: GeneratedCardInput[] }> {
  if (!llmAvailable()) return { offline: true, items: [] };
  const out = await chatJson(userId, GEN_CARDS_SYSTEM, buildGenerateCardsPrompt(role, topic, avoid), GenCardsSchema, {
    // cache: true — same reasoning as study-generate-drills above: the exclusion list is part of
    // the hashed prompt, so a grown pool misses the cache while a retry still hits.
    maxTokens: 900,
    temperature: 0.5,
    cache: true,
    tier: "fast",
    feature: "study-generate-cards",
    outputLocale: "app",
  });
  if (!out) return { offline: true, items: [] };
  return { offline: false, items: out.cards };
}

/** Same "cap before dedup" ordering caveat as dedupeGeneratedDrills above. */
export function dedupeGeneratedCards(items: GeneratedCardInput[], existingQ: Set<string>, cat: string, limit = 5): NewCardEntry[] {
  const seen = new Set(existingQ);
  const added: NewCardEntry[] = [];
  for (const it of items.slice(0, limit)) {
    if (seen.has(it.q)) continue;
    added.push({ cat, q: it.q, a: it.a, generated: true });
    seen.add(it.q);
  }
  return added;
}

// ---------- FSRS grading ----------

export interface SrsGradeResult {
  difficulty: number;
  stability: number;
  intervalDays: number;
  due: string;
  reps: number;
  lastReview: string;
}

/** Wraps fsrs.ts's scheduleFsrs() with the request-level bookkeeping (elapsed-days computation
 * from the previous review, rep counting, and turning the resulting interval into a due date) —
 * pure given `now`, so a fixed clock makes it fully deterministic in tests. */
export function computeSrsGrade(existing: SrsRow | undefined, rating: FsrsRating, now: Date): SrsGradeResult {
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
  return { difficulty, stability, intervalDays, due, reps, lastReview };
}
