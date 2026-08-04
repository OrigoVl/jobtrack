import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { Vacancy } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { useFireCelebration } from "../use-celebration";
import { queryKeys } from "./keys";
import { useInvalidateAll, useInvalidateDerived } from "./derived";

export function useVacancies() {
  return useQuery({ queryKey: queryKeys.vacancies, queryFn: api.vacancies });
}

/** Lazy by design (`enabled`) — GET /vacancies/:id/similar is only fetched once a user actually
 * opens a given vacancy's "similar" popover (see SimilarVacanciesButton), not eagerly for every
 * row in the list (which would fire one request per row on every page load for no reason). */
export function useSimilarVacancies(vacancyId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.similarVacancies, vacancyId],
    queryFn: () => api.similarVacancies(vacancyId),
    enabled,
  });
}

export function useAddVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (v: Partial<Vacancy>) => api.addVacancy(v),
    onSuccess: async ({ possibleDuplicateOf, ...row }) => {
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => [row, ...(cur ?? [])]);
      await invalidateDerived();
      // Advisory only (server/src/modules/jobs/job-dedupe.ts#findSimhashDuplicate) — the vacancy
      // is already saved either way, this just flags it so the user can merge/delete manually
      // if it really is the same posting.
      if (possibleDuplicateOf) {
        toast(t("toasts.possibleDuplicate", { company: possibleDuplicateOf.company, position: possibleDuplicateOf.position }), "info");
      } else {
        toast(t("toasts.added"), "success");
      }
    },
    onError,
  });
}

export function useUpdateVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  const fireCelebration = useFireCelebration();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Vacancy> }) => api.updateVacancy(id, patch),
    onSuccess: async (row, variables) => {
      const prev = qc.getQueryData<Vacancy[]>(queryKeys.vacancies)?.find((x) => x.id === row.id);
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => cur?.map((x) => (x.id === row.id ? row : x)) ?? cur);
      await invalidateDerived();
      // The server tries to automatically pull the stack/level/fit when the URL appears or
      // changes (server/src/modules/vacancies/vacancy-analysis.service.ts tryAutoEnrichStack,
      // best-effort, any public https host — LinkedIn, Djinni, robota.ua, dou.ua, etc.,
      // except local/internal addresses blocked by SSRF protection) — we report the outcome.
      if (variables.patch.url !== undefined && variables.patch.url !== prev?.url) {
        toast(
          row.stack.length > 0
            ? t("toasts.stackPulled", { stack: `${row.stack.slice(0, 5).join(", ")}${row.stack.length > 5 ? "…" : ""}` })
            : variables.patch.url
              ? t("toasts.linkSavedNoStack")
              : t("toasts.linkRemoved"),
          row.stack.length > 0 ? "success" : "info",
        );
      }
      // Celebrate reaching "Offer" — gated on the patch itself (not just row.status) so an
      // unrelated edit to a vacancy that's already an Offer (e.g. tweaking its salary) doesn't
      // re-fire the confetti every time.
      if (variables.patch.status === "Offer" && prev?.status !== "Offer") {
        fireCelebration("🎉", t("toasts.offerCelebration", { company: row.company }));
      }
    },
    onError,
  });
}

export function useDeleteVacancy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (id: number) => api.deleteVacancy(id),
    onSuccess: async (_res, id) => {
      qc.setQueryData<Vacancy[]>(queryKeys.vacancies, (cur) => cur?.filter((x) => x.id !== id) ?? cur);
      await invalidateDerived();
      toast(t("toasts.deleted"), "success");
    },
    onError,
  });
}

export function useImportVacancies() {
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (html: string) => api.importVacancies(html),
    onSuccess: async (res) => {
      await invalidateAll();
      const base = res.added ? t("toasts.importAdded", { count: res.added }) : t("toasts.importNoNewLinks");
      // Advisory only (server/src/modules/jobs/job-dedupe.ts) — the items are already saved
      // either way, this just flags a same-company match so the user can check for a duplicate.
      const dupSuffix = res.possibleDuplicates.length
        ? ` — ${t("toasts.possibleDuplicatesCount", { count: res.possibleDuplicates.length })}`
        : "";
      toast(base + dupSuffix, res.added ? "success" : "info");
    },
    onError,
  });
}

export function useImportVacanciesJson() {
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: (items: unknown[]) => api.importVacanciesJson(items),
    onSuccess: async (res) => {
      await invalidateAll();
      const parts: string[] = [];
      if (res.added) parts.push(t("toasts.jsonImport.added", { count: res.added }));
      if (res.updated) parts.push(t("toasts.jsonImport.updated", { count: res.updated }));
      if (res.skipped) parts.push(t("toasts.jsonImport.skipped", { count: res.skipped }));
      if (res.possibleDuplicates.length) parts.push(t("toasts.possibleDuplicatesCount", { count: res.possibleDuplicates.length }));
      const ok = res.added > 0 || res.updated > 0;
      toast(parts.length ? parts.join(", ") : t("toasts.jsonImport.noData"), ok ? "success" : "error");
    },
    onError,
  });
}

export function useFetchAllVacancies() {
  const { toast } = useToast();
  const { t } = useTranslation("vacancies");
  const onError = useMutationErrorToast();
  const invalidateAll = useInvalidateAll();
  return useMutation({
    mutationFn: () => api.fetchAllVacancies(),
    onSuccess: async (res) => {
      await invalidateAll();
      toast(t("toasts.fetchAllProcessed", { count: res.processed }), "success");
    },
    onError,
  });
}
