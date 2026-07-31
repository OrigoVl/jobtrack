import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { SavedSearchInput } from "../types";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";

export function useSavedSearches() {
  return useQuery({ queryKey: queryKeys.savedSearches, queryFn: api.savedSearches });
}

export function useAddSavedSearch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (s: SavedSearchInput) => api.addSavedSearch(s),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.savedSearches });
      toast("Alert created — we'll email you when new postings match", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteSavedSearch(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.savedSearches });
      toast("Alert deleted", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}
