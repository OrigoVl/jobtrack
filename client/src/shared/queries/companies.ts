import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { Company } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useCompanies() {
  return useQuery({ queryKey: queryKeys.companies, queryFn: api.companies });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("companies");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (c: Partial<Company>) => api.saveCompany(c),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies });
      toast(t("toasts.saved"), "success");
    },
    onError,
  });
}

/**
 * Creates (or fills in the blanks of) the company auto-derived from a vacancy link, resolving to
 * the row itself so the caller can immediately link the vacancy to it via its id.
 *
 * No success toast, unlike useSaveCompany: this only ever runs as one step of a larger action the
 * user took ("autofill from link", "refresh from link"), which reports its own result — a second
 * "Saved" toast for an intermediate step would just be noise.
 */
export function useEnrichCompany() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (c: Partial<Company>) => api.enrichCompany(c),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies });
    },
    onError,
  });
}

// Used to save edits to an EXISTING company (notes/questions, and the name itself) — unlike
// useSaveCompany's POST (which upserts by name and would silently create a duplicate row instead
// of renaming), this PUTs by id so a name change actually renames the row.
export function useUpdateCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("companies");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Company> }) => api.updateCompany(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies });
      toast(t("toasts.saved"), "success");
    },
    onError,
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("companies");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: number) => api.deleteCompany(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies });
      toast(t("toasts.deleted"), "success");
    },
    onError,
  });
}
