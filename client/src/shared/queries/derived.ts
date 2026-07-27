import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

// Аналітика/roadmap/learn/plan21 і навіть профіль рахуються на бекенді з тих самих
// вакансій+CV, тож будь-яка зміна стеку вакансій чи профілю має інвалідувати їх усі
// разом (раніше це робив reloadDerived() усередині store.tsx).
const DERIVED_KEYS = [queryKeys.analytics, queryKeys.learn, queryKeys.roadmap, queryKeys.profile, queryKeys.plan21];
const ALL_KEYS = [queryKeys.vacancies, ...DERIVED_KEYS, queryKeys.study, queryKeys.companies, queryKeys.projects];

export function useInvalidateDerived(): () => Promise<void[]> {
  const qc = useQueryClient();
  return () => Promise.all(DERIVED_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
}

/** Повний перезбір усього кешу — аналог колишнього reload() (масовий імпорт/парсинг усіх вакансій). */
export function useInvalidateAll(): () => Promise<void[]> {
  const qc = useQueryClient();
  return () => Promise.all(ALL_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
}
