// Types for SQLite table rows and domain objects stored in the kv store.

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
  stack: string;
  created: string;
}

export interface CompanyRow {
  id: number;
  name: string;
  notes: string;
  questions: string;
}

export interface SrsRow {
  cardId: string;
  /** @deprecated Leftover from the SM-2 scheduler — the new code (FSRS) doesn't read/write this field. */
  ease: number;
  interval: number;
  due: string;
  reps: number;
  /** FSRS difficulty (1..10). NULL — the card has never been graded by the new scheduler. */
  difficulty: number | null;
  /** FSRS stability in days. NULL — the card has never been graded by the new scheduler. */
  stability: number | null;
  /** Date of the last review (ISO), needed to compute elapsed days for FSRS. NULL — a new card. */
  lastReview: string | null;
}
