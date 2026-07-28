import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

// `days` is part of the query key — switching the admin page's time-range selector fetches (and
// caches) a distinct result per range instead of one hook silently serving stale data for the
// range the user just picked.
export function useAdminOverview(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminOverview, days], queryFn: () => api.adminOverview(days) });
}
export function useAdminUsers(limit = 50, offset = 0) {
  return useQuery({ queryKey: [...queryKeys.adminUsers, limit, offset], queryFn: () => api.adminUsers(limit, offset) });
}
export function useAdminLlmUsage(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminLlmUsage, days], queryFn: () => api.adminLlmUsage(days) });
}
export function useAdminProductEvents(days: number) {
  return useQuery({ queryKey: [...queryKeys.adminProductEvents, days], queryFn: () => api.adminProductEvents(days) });
}
