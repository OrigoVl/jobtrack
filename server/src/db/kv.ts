// Domain helpers on top of the generic kv table: candidate profile, checklist progress
// (drills/pet projects/21-day plan/roadmap), and SRS flashcard state.
//
// Every function takes `userId` as its first argument (see server/src/db/user-id.ts), but the
// CURRENT SQLite-backed query bodies don't actually filter by it: the physical `kv`/`srs` tables
// have no user_id column yet, and there is exactly one user (the phase-2 bootstrap constant)
// until better-auth lands in phase 3. Real per-tenant scoping starts working once this file's
// implementation is swapped to the Postgres schema (server/src/db/schema/app.ts, which already
// has a composite `(user_id, k)` key on `user_kv`) — no caller has to change for that swap, only
// the bodies below do.
import db from "./client.js";
import type { UserId } from "./user-id.js";
import type { Profile, SrsRow } from "./types.js";

export async function getProfile(_userId: UserId): Promise<Profile> {
  return JSON.parse((db.prepare("SELECT v FROM kv WHERE k='profile'").get() as { v: string }).v);
}
export async function setProfile(_userId: UserId, p: Profile): Promise<void> {
  db.prepare("INSERT INTO kv (k,v) VALUES ('profile',?) ON CONFLICT(k) DO UPDATE SET v=?").run(JSON.stringify(p), JSON.stringify(p));
}

export async function getKvJson<T = unknown>(_userId: UserId, key: string): Promise<T | null> {
  const row = db.prepare("SELECT v FROM kv WHERE k=?").get(key) as { v: string } | undefined;
  return row ? JSON.parse(row.v) : null;
}
export async function setKvJson(_userId: UserId, key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  db.prepare("INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?").run(key, v, v);
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

// Map of cardId -> SRS row (ease/interval/due/reps), for computing "due today" and stats.
export async function getSrsStateByCard(_userId: UserId): Promise<Record<string, SrsRow>> {
  return Object.fromEntries((db.prepare("SELECT * FROM srs").all() as unknown as SrsRow[]).map((s) => [s.cardId, s]));
}

export async function getSrsRow(_userId: UserId, cardId: string): Promise<SrsRow | undefined> {
  return db.prepare("SELECT * FROM srs WHERE cardId=?").get(cardId) as SrsRow | undefined;
}

export interface SrsGradeFields {
  difficulty: number;
  stability: number;
  interval: number;
  due: string;
  reps: number;
  lastReview: string;
}

// ON CONFLICT(cardId) is a global uniqueness rule today — fine with one tenant, but once this
// moves to Postgres it MUST become ON CONFLICT (user_id, cardId) (see the composite PK on `srs`
// in schema/app.ts), or one user's grading would silently overwrite another user's SRS state
// for a card with the same id.
export async function recordSrsGrade(_userId: UserId, cardId: string, fields: SrsGradeFields): Promise<void> {
  db.prepare(
    `INSERT INTO srs (cardId, difficulty, stability, interval, due, reps, lastReview) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(cardId) DO UPDATE SET difficulty=excluded.difficulty, stability=excluded.stability,
       interval=excluded.interval, due=excluded.due, reps=excluded.reps, lastReview=excluded.lastReview`,
  ).run(cardId, fields.difficulty, fields.stability, fields.interval, fields.due, fields.reps, fields.lastReview);
}
