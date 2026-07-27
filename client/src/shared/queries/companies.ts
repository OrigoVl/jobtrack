import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Company } from "../types";
import { useToast } from "../toast";
import { queryKeys } from "./keys";

export function useCompanies() {
  return useQuery({ queryKey: queryKeys.companies, queryFn: api.companies });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (c: Partial<Company>) => api.saveCompany(c),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companies });
      toast("Збережено", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Сталася помилка", "error"),
  });
}
