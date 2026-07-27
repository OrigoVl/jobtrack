import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Plan21Data } from "../types";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";

export function usePlan21() {
  return useQuery({ queryKey: queryKeys.plan21, queryFn: api.plan21 });
}

interface Plan21Ctx {
  previous?: Plan21Data;
}

export function useSetPlanDay() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<{ ok: boolean }, Error, { dayId: string; done: boolean }, Plan21Ctx>({
    mutationFn: ({ dayId, done }) => api.setPlanDay(dayId, done),
    onMutate: async ({ dayId, done }) => {
      await qc.cancelQueries({ queryKey: queryKeys.plan21 });
      const previous = qc.getQueryData<Plan21Data>(queryKeys.plan21);
      qc.setQueryData<Plan21Data>(queryKeys.plan21, (cur) => (cur ? { ...cur, progress: { ...cur.progress, [dayId]: done } } : cur));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.plan21, ctx.previous);
      toast(e instanceof Error ? e.message : "Сталася помилка", "error");
    },
  });
}
