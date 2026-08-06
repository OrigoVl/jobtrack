import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ApplyProgress } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useApplyProgress() {
  return useQuery({ queryKey: queryKeys.applyProgress, queryFn: api.applyProgress });
}

export function useSetWeeklyApplyGoal() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (weekly: number) => api.setWeeklyApplyGoal(weekly),
    onSuccess: ({ weeklyGoal }) => {
      qc.setQueryData<ApplyProgress>(queryKeys.applyProgress, (cur) => (cur ? { ...cur, weeklyGoal } : cur));
    },
    onError,
  });
}
