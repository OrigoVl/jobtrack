import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Vacancy } from "../types";
import { useToast } from "../toast";
import { queryKeys } from "./keys";
import { useInvalidateAll, useInvalidateDerived } from "./derived";

export function useVacancies() {
  return useQuery({ queryKey: queryKeys.vacancies, queryFn: api.vacancies });
}

function useMutationErrorToast() {
  const { toast } = useToast();
  return (e: unknown) => toast(e instanceof Error ? e.message : "Сталася помилка", "error");
}

export function useAddVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (v: Partial<Vacancy>) => api.addVacancy(v),
    onSuccess: async (row) => {
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => [row, ...(cur ?? [])]);
      await invalidateDerived();
      toast("Вакансію додано", "success");
    },
    onError,
  });
}

export function useUpdateVacancy() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Vacancy> }) => api.updateVacancy(id, patch),
    onSuccess: async (row) => {
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => cur?.map((x) => (x.id === row.id ? row : x)) ?? cur);
      await invalidateDerived();
    },
    onError,
  });
}

export function useDeleteVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (id: number) => api.deleteVacancy(id),
    onSuccess: async (_res, id) => {
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => cur?.filter((x) => x.id !== id) ?? cur);
      await invalidateDerived();
      toast("Вакансію видалено", "success");
    },
    onError,
  });
}

export function useImportVacancies() {
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (html: string) => api.importVacancies(html),
    onSuccess: async (res) => {
      await invalidateAll();
      toast(res.added ? `Додано ${res.added} вакансій` : "Нових посилань не знайдено", res.added ? "success" : "info");
    },
    onError,
  });
}

export function useFetchAllVacancies() {
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: () => api.fetchAllVacancies(),
    onSuccess: async (res) => {
      await invalidateAll();
      toast(`Оброблено ${res.processed} вакансій — стек оновлено всюди`, "success");
    },
    onError,
  });
}
