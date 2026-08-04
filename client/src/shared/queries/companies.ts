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
