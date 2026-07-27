// Типи рядків SQLite-таблиць та доменних об'єктів, що зберігаються у kv-сховищі.

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
  /** @deprecated Залишок SM-2-планувальника — новий код (FSRS) не читає/не пише це поле. */
  ease: number;
  interval: number;
  due: string;
  reps: number;
  /** FSRS difficulty (1..10). NULL — картку ще ніколи не оцінювали новим планувальником. */
  difficulty: number | null;
  /** FSRS stability у днях. NULL — картку ще ніколи не оцінювали новим планувальником. */
  stability: number | null;
  /** Дата останнього огляду (ISO), потрібна щоб рахувати elapsed days для FSRS. NULL — нова картка. */
  lastReview: string | null;
}
