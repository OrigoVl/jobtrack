import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

// Analytics/roadmap/learn/plan21 and even the profile are computed on the backend from the
// same vacancies+CV, so any change to the vacancy stack or profile must invalidate all of
// them together (previously this was done by reloadDerived() inside store.tsx).
const DERIVED_KEYS = [
  queryKeys.analytics,
  queryKeys.learn,
  queryKeys.roadmap,
  queryKeys.profile,
  queryKeys.plan21,
  queryKeys.applyProgress,
];
const ALL_KEYS = [queryKeys.vacancies, ...DERIVED_KEYS, queryKeys.study, queryKeys.companies, queryKeys.projects];

export function useInvalidateDerived(): () => Promise<void[]> {
  const qc = useQueryClient();
  return () => Promise.all(DERIVED_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
}

/** Full cache rebuild — analogous to the old reload() (bulk import/parsing of all vacancies). */
export function useInvalidateAll(): () => Promise<void[]> {
  const qc = useQueryClient();
  return () => Promise.all(ALL_KEYS.map((key) => qc.invalidateQueries({ queryKey: key })));
}
