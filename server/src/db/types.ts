// Domain row shapes. Postgres jsonb columns (stack/questions/v) come back from Drizzle already
// parsed into their native JS type — unlike the old SQLite TEXT-as-JSON columns, nothing here
// needs a JSON.parse() step at the call site.
import type { Track } from "../shared/tracks.js";

export interface Profile {
  skills: string[];
  cvText: string;
  domain?: string;
  /** Explicit content-track override — when unset, effectiveTrack() (shared/tracks.ts)
   * auto-detects from domain/cvText instead. */
  track?: Track;
}

export interface VacancyRow {
  id: number;
  company: string;
  position: string;
  level: string;
  salary: string;
  /** Free-text location as written on the posting. `null` — the posting doesn't state one (see
   * db/schema/app.ts's own comment on why this is nullable rather than level/salary's "" convention). */
  location: string | null;
  /** Free-text work mode ("office" | "hybrid" | "remote" expected, not enum-enforced). `null` when unstated. */
  workMode: string | null;
  /** Free-text employment type (e.g. "Full-time", "Contract"). `null` when unstated. */
  employmentType: string | null;
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  nextAction: string;
  notes: string;
  stack: string[];
  created: string;
  companyId: number | null;
  favorite: boolean;
  coverLetter: string;
  coverLetterDetails: string;
}

export interface SrsRow {
  cardId: string;
  intervalDays: number;
  due: string;
  reps: number;
  /** FSRS difficulty (1..10). NULL — the card has never been graded by the new scheduler. */
  difficulty: number | null;
  /** FSRS stability in days. NULL — the card has never been graded by the new scheduler. */
  stability: number | null;
  /** Date of the last review (ISO), needed to compute elapsed days for FSRS. NULL — a new card. */
  lastReview: string | null;
}
