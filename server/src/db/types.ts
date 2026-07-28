// Domain row shapes. Postgres jsonb columns (stack/questions/v) come back from Drizzle already
// parsed into their native JS type — unlike the old SQLite TEXT-as-JSON columns, nothing here
// needs a JSON.parse() step at the call site.

export interface Profile {
  skills: string[];
  cvText: string;
  domain?: string;
}

export interface VacancyRow {
  id: number;
  company: string;
  position: string;
  level: string;
  url: string;
  status: string;
  fit: string;
  applied: string;
  next: string;
  notes: string;
  stack: string[];
  created: string;
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
