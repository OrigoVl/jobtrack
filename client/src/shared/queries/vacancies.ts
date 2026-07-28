import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Vacancy } from "../types";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";
import { useInvalidateAll, useInvalidateDerived } from "./derived";

export function useVacancies() {
  return useQuery({ queryKey: queryKeys.vacancies, queryFn: api.vacancies });
}

function useMutationErrorToast() {
  const { toast } = useToast();
  return (e: unknown) => toast(e instanceof Error ? e.message : "An error occurred", "error");
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
      toast("Vacancy added", "success");
    },
    onError,
  });
}

export function useUpdateVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Vacancy> }) => api.updateVacancy(id, patch),
    onSuccess: async (row, variables) => {
      const prevUrl = qc.getQueryData<Vacancy[]>(queryKeys.vacancies)?.find((x) => x.id === row.id)?.url;
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => cur?.map((x) => (x.id === row.id ? row : x)) ?? cur);
      await invalidateDerived();
      // The server tries to automatically pull the stack/level/fit when the URL appears or
      // changes (server/src/modules/vacancies/vacancy-analysis.service.ts tryAutoEnrichStack,
      // best-effort, any public https host — LinkedIn, Djinni, robota.ua, dou.ua, etc.,
      // except local/internal addresses blocked by SSRF protection) — we report the outcome.
      if (variables.patch.url !== undefined && variables.patch.url !== prevUrl) {
        toast(
          row.stack.length > 0
            ? `Stack pulled from the link: ${row.stack.slice(0, 5).join(", ")}${row.stack.length > 5 ? "…" : ""}`
            : variables.patch.url
              ? "Link saved (could not automatically detect the stack from the page)"
              : "Link removed",
          row.stack.length > 0 ? "success" : "info",
        );
      }
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
      toast("Vacancy deleted", "success");
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
      toast(res.added ? `Added ${res.added} vacancies` : "No new links found", res.added ? "success" : "info");
    },
    onError,
  });
}

export function useImportVacanciesJson() {
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (items: unknown[]) => api.importVacanciesJson(items),
    onSuccess: async (res) => {
      await invalidateAll();
      const parts: string[] = [];
      if (res.added) parts.push(`added ${res.added}`);
      if (res.updated) parts.push(`updated ${res.updated}`);
      if (res.skipped) parts.push(`skipped ${res.skipped} (format errors)`);
      const ok = res.added > 0 || res.updated > 0;
      toast(parts.length ? parts.join(", ") : "No new data found", ok ? "success" : "error");
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
      toast(`Processed ${res.processed} vacancies — stack updated everywhere`, "success");
    },
    onError,
  });
}
