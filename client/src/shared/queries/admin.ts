import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";
import { useMutationErrorToast } from "../use-error-toast";

// `days` is part of the query key — switching the admin page's time-range selector fetches (and
// caches) a distinct result per range instead of one hook silently serving stale data for the
// range the user just picked.
export function useAdminOverview(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminOverview, days], queryFn: () => api.adminOverview(days) });
}
export function useAdminUsers(limit = 50, offset = 0, search = "") {
  return useQuery({ queryKey: [...queryKeys.adminUsers, limit, offset, search], queryFn: () => api.adminUsers(limit, offset, search) });
}
export function useAdminLlmUsage(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminLlmUsage, days], queryFn: () => api.adminLlmUsage(days) });
}
export function useAdminProductEvents(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminProductEvents, days], queryFn: () => api.adminProductEvents(days) });
}
export function useAdminBilling(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminBilling, days], queryFn: () => api.adminBilling(days) });
}

export function useBanUser() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => api.adminBanUser(userId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers }),
    onError,
  });
}
export function useUnbanUser() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (userId: string) => api.adminUnbanUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers }),
    onError,
  });
}

// useGrantTemporaryPlan invalidates adminUsers so the row's plan/subStatus column updates without
// a manual refetch. useGrantBonusAiCalls doesn't — the users table has no bonus-calls column
// today, so there's nothing there to invalidate.
export function useGrantTemporaryPlan() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ userId, plan, days }: { userId: string; plan: "pro" | "team"; days: number }) => api.adminGrantPlan(userId, plan, days),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminUsers }),
    onError,
  });
}
export function useGrantBonusAiCalls() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ userId, count }: { userId: string; count: number }) => api.adminGrantBonusAiCalls(userId, count),
    onError,
  });
}
