// Domain helpers on top of the generic kv table: candidate profile, checklist progress
// (drills/pet projects/21-day plan/roadmap), and SRS flashcard state.
import db from "./client.js";
import type { Profile, SrsRow } from "./types.js";

export function getProfile(): Profile {
  return JSON.parse((db.prepare("SELECT v FROM kv WHERE k='profile'").get() as { v: string }).v);
}
export function setProfile(p: Profile): void {
  db.prepare("INSERT INTO kv (k,v) VALUES ('profile',?) ON CONFLICT(k) DO UPDATE SET v=?").run(JSON.stringify(p), JSON.stringify(p));
}

export function getKvJson<T = unknown>(key: string): T | null {
  const row = db.prepare("SELECT v FROM kv WHERE k=?").get(key) as { v: string } | undefined;
  return row ? JSON.parse(row.v) : null;
}
export function setKvJson(key: string, value: unknown): void {
  const v = JSON.stringify(value);
  db.prepare("INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?").run(key, v, v);
}

// ---- generic key-value object storage (for checklist progress) ----
function getKvObj(key: string): Record<string, unknown> {
  return getKvJson<Record<string, unknown>>(key) || {};
}
function setKvObj(key: string, obj: Record<string, unknown>): void {
  setKvJson(key, obj);
}

export function getDrillProgress(): Record<string, "solved"> {
  return getKvObj("drillProgress") as Record<string, "solved">;
}
export function setDrillStatus(id: string, status: "solved" | "todo"): Record<string, "solved"> {
  const progress = getDrillProgress();
  if (status === "solved") progress[id] = "solved";
  else delete progress[id];
  setKvObj("drillProgress", progress);
  return progress;
}

export function getChecklistProgress(key: string): Record<string, boolean> {
  return getKvObj(key) as Record<string, boolean>;
}
export function toggleChecklistItem(key: string, itemId: string, done: boolean): Record<string, boolean> {
  const progress = getChecklistProgress(key);
  if (done) progress[itemId] = true;
  else delete progress[itemId];
  setKvObj(key, progress);
  return progress;
}

export function getRoadmapProgress(): Record<string, string> {
  return getKvObj("roadmapProgress") as Record<string, string>;
}
export function setRoadmapStatus(tech: string, status: string): Record<string, string> {
  // Unlike setDrillStatus/toggleChecklistItem, we CANNOT delete the entry on the "default"
  // value ("todo") here: GET /roadmap treats the default as isKnown ? "done" : "todo"
  // (roadmap.routes.ts), so deleting an explicit "todo" for a skill already known (from
  // CV/profile) would immediately roll it back to "done" on the next GET right after the
  // PUT — the status would never actually persist, and clicking around the "known → not
  // started" cycle on a known skill wouldn't visually stick.
  const progress = getRoadmapProgress();
  progress[tech] = status;
  setKvObj("roadmapProgress", progress);
  return progress;
}

// Map of cardId -> SRS row (ease/interval/due/reps), for computing "due today" and stats.
export function getSrsStateByCard(): Record<string, SrsRow> {
  return Object.fromEntries((db.prepare("SELECT * FROM srs").all() as unknown as SrsRow[]).map((s) => [s.cardId, s]));
}
