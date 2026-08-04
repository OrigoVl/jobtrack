import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

export function useAnalytics() {
  return useQuery({ queryKey: queryKeys.analytics, queryFn: api.analytics });
}

export function useFocusWeek() {
  return useQuery({ queryKey: queryKeys.focusWeek, queryFn: api.focusWeek });
}
