import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { SavedSearchInput } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useSavedSearches() {
  return useQuery({ queryKey: queryKeys.savedSearches, queryFn: api.savedSearches });
}

export function useAddSavedSearch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("jobs");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (s: SavedSearchInput) => api.addSavedSearch(s),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.savedSearches });
      toast(t("toasts.alertCreated"), "success");
    },
    onError,
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("jobs");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteSavedSearch(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.savedSearches });
      toast(t("toasts.alertDeleted"), "success");
    },
    onError,
  });
}
