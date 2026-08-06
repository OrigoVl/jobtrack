// Domain helpers on top of the generic per-user `user_kv` table: candidate profile, checklist
// progress (drills/pet projects/21-day plan/roadmap), and SRS flashcard state (`srs` table).
// Every function is scoped by `userId` — see server/src/db/user-id.ts.
import { and, eq } from "drizzle-orm";
import db from "./client.js";
import { userKv, srs } from "./schema/index.js";
import type { UserId } from "./user-id.js";
import type { Profile, SrsRow } from "./types.js";

export async function getProfile(userId: UserId): Promise<Profile> {
  const [row] = await db
    .select({ v: userKv.v })
    .from(userKv)
    .where(and(eq(userKv.userId, userId), eq(userKv.k, "profile")));
  return row!.v as Profile;
}
export async function setProfile(userId: UserId, p: Profile): Promise<void> {
  await db
    .insert(userKv)
    .values({ userId, k: "profile", v: p })
    .onConflictDoUpdate({ target: [userKv.userId, userKv.k], set: { v: p, updatedAt: new Date() } });
}

export async function getKvJson<T = unknown>(userId: UserId, key: string): Promise<T | null> {
  const [row] = await db
    .select({ v: userKv.v })
    .from(userKv)
    .where(and(eq(userKv.userId, userId), eq(userKv.k, key)));
  return row ? (row.v as T) : null;
}
export async function setKvJson(userId: UserId, key: string, value: unknown): Promise<void> {
  await db
    .insert(userKv)
    .values({ userId, k: key, v: value })
    .onConflictDoUpdate({ target: [userKv.userId, userKv.k], set: { v: value, updatedAt: new Date() } });
}

// ---- generic key-value object storage (for checklist progress) ----
async function getKvObj(userId: UserId, key: string): Promise<Record<string, unknown>> {
  return (await getKvJson<Record<string, unknown>>(userId, key)) || {};
}
async function setKvObj(userId: UserId, key: string, obj: Record<string, unknown>): Promise<void> {
  await setKvJson(userId, key, obj);
}

export async function getDrillProgress(userId: UserId): Promise<Record<string, "solved">> {
  return (await getKvObj(userId, "drillProgress")) as Record<string, "solved">;
}
export async function setDrillStatus(userId: UserId, id: string, status: "solved" | "todo"): Promise<Record<string, "solved">> {
  const progress = await getDrillProgress(userId);
  if (status === "solved") progress[id] = "solved";
  else delete progress[id];
  await setKvObj(userId, "drillProgress", progress);
  return progress;
}

export async function getChecklistProgress(userId: UserId, key: string): Promise<Record<string, boolean>> {
  return (await getKvObj(userId, key)) as Record<string, boolean>;
}
export async function toggleChecklistItem(userId: UserId, key: string, itemId: string, done: boolean): Promise<Record<string, boolean>> {
  const progress = await getChecklistProgress(userId, key);
  if (done) progress[itemId] = true;
  else delete progress[itemId];
  await setKvObj(userId, key, progress);
  return progress;
}

export async function getRoadmapProgress(userId: UserId): Promise<Record<string, string>> {
  return (await getKvObj(userId, "roadmapProgress")) as Record<string, string>;
}
export async function setRoadmapStatus(userId: UserId, tech: string, status: string): Promise<Record<string, string>> {
  // Unlike setDrillStatus/toggleChecklistItem, we CANNOT delete the entry on the "default"
  // value ("todo") here: GET /roadmap treats the default as isKnown ? "done" : "todo"
  // (roadmap.routes.ts), so deleting an explicit "todo" for a skill already known (from
  // CV/profile) would immediately roll it back to "done" on the next GET right after the
  // PUT — the status would never actually persist, and clicking around the "known → not
  // started" cycle on a known skill wouldn't visually stick.
  const progress = await getRoadmapProgress(userId);
  progress[tech] = status;
  await setKvObj(userId, "roadmapProgress", progress);
  return progress;
}

export async function getSkillLevels(userId: UserId): Promise<Record<string, number>> {
  return (await getKvObj(userId, "skillLevels")) as Record<string, number>;
}
/** Unlike setRoadmapStatus above, `level: null` DOES delete the entry: there the default is
 * derived from the CV (isKnown ? "done" : "todo"), so deleting an explicit value could roll back
 * to a different default on the next GET. Here "no entry" IS the intended default — "trust the
 * computed level" — so clearing an override must actually remove it, not just set some sentinel. */
export async function setSkillLevel(userId: UserId, tech: string, level: number | null): Promise<Record<string, number>> {
  const levels = await getSkillLevels(userId);
  if (level == null) delete levels[tech];
  else levels[tech] = level;
  await setKvObj(userId, "skillLevels", levels);
  return levels;
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string;
}
const EMPTY_STREAK: StreakState = { current: 0, longest: 0, lastActiveDate: "" };

export async function getStudyStreak(userId: UserId): Promise<StreakState> {
  return (await getKvJson<StreakState>(userId, "studyStreak")) || EMPTY_STREAK;
}

/** Records a study/practice action (a flashcard grade or a solved drill) as "done today" —
 * advances the streak by one if the last active day was yesterday, resets to 1 after a gap, and
 * is a no-op if today was already recorded (grading 10 cards in one sitting counts once). */
export async function recordStudyActivity(userId: UserId): Promise<StreakState> {
  const today = new Date().toISOString().slice(0, 10);
  const state = await getStudyStreak(userId);
  if (state.lastActiveDate === today) return state;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const current = state.lastActiveDate === yesterday ? state.current + 1 : 1;
  const next: StreakState = { current, longest: Math.max(state.longest, current), lastActiveDate: today };
  await setKvJson(userId, "studyStreak", next);
  return next;
}

// Map of cardId -> SRS row (interval/due/reps/FSRS state), for computing "due today" and stats.
export async function getSrsStateByCard(userId: UserId): Promise<Record<string, SrsRow>> {
  const rows = await db.select().from(srs).where(eq(srs.userId, userId));
  return Object.fromEntries(rows.map((s) => [s.cardId, toSrsRow(s)]));
}

export async function getSrsRow(userId: UserId, cardId: string): Promise<SrsRow | undefined> {
  const [row] = await db
    .select()
    .from(srs)
    .where(and(eq(srs.userId, userId), eq(srs.cardId, cardId)));
  return row ? toSrsRow(row) : undefined;
}

function toSrsRow(row: typeof srs.$inferSelect): SrsRow {
  return {
    cardId: row.cardId,
    intervalDays: row.intervalDays,
    due: row.due,
    reps: row.reps,
    difficulty: row.difficulty,
    stability: row.stability,
    lastReview: row.lastReview,
  };
}

export interface SrsGradeFields {
  difficulty: number;
  stability: number;
  interval: number;
  due: string;
  reps: number;
  lastReview: string;
}

export async function recordSrsGrade(userId: UserId, cardId: string, fields: SrsGradeFields): Promise<void> {
  await db
    .insert(srs)
    .values({
      userId,
      cardId,
      difficulty: fields.difficulty,
      stability: fields.stability,
      intervalDays: fields.interval,
      due: fields.due,
      reps: fields.reps,
      lastReview: fields.lastReview,
    })
    .onConflictDoUpdate({
      target: [srs.userId, srs.cardId],
      set: {
        difficulty: fields.difficulty,
        stability: fields.stability,
        intervalDays: fields.interval,
        due: fields.due,
        reps: fields.reps,
        lastReview: fields.lastReview,
      },
    });
}
