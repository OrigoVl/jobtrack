import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { Company, DesignDiagram } from "../types";
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

// A company's freeform architecture diagram (see companies.repo.ts's own comment — reuses the
// design trainer's canvas, no task/grading involved). `enabled` gates the fetch to only when the
// company's diagram section is actually expanded, same "don't fetch every row eagerly" convention
// as similar-vacancies-button.tsx's useSimilarVacancies(vacancyId, open).
export function useCompanyDiagram(companyId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.companyDiagram, companyId],
    queryFn: () => api.companyDiagram(companyId),
    enabled,
  });
}

export function useSaveCompanyDiagram(companyId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("companies");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (diagram: DesignDiagram) => api.saveCompanyDiagram(companyId, diagram),
    onSuccess: (diagram) => {
      qc.setQueryData<DesignDiagram>([...queryKeys.companyDiagram, companyId], diagram);
      toast(t("toasts.saved"), "success");
    },
    onError,
  });
}
