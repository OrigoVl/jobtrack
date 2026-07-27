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
  ease: number;
  interval: number;
  due: string;
  reps: number;
}
