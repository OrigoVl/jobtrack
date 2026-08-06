import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { DrillArchiveEntry, StudyState } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useStudy() {
  return useQuery({ queryKey: queryKeys.study, queryFn: api.study });
}

export function useDrillArchive() {
  return useQuery({ queryKey: queryKeys.drillArchive, queryFn: api.drillArchive });
}

export function useUpdateDrillArchiveEntry() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("study");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<DrillArchiveEntry, "q" | "sol" | "exp">> }) =>
      api.updateDrillArchiveEntry(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.drillArchive });
      toast(t("toasts.archiveUpdated"), "success");
    },
    onError,
  });
}

export function useDeleteDrillArchiveEntry() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("study");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: string) => api.deleteDrillArchiveEntry(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.drillArchive });
      toast(t("toasts.archiveDeleted"), "success");
    },
    onError,
  });
}

export function useGradeCard() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ cardId, grade }: { cardId: string; grade: number }) => api.grade(cardId, grade),
    // Grading also changes the roadmap's flashcard-recall level component for that card's tech.
    onSuccess: () =>
      Promise.all([qc.invalidateQueries({ queryKey: queryKeys.study }), qc.invalidateQueries({ queryKey: queryKeys.roadmap })]),
    onError,
  });
}

interface DrillCtx {
  previous?: StudyState;
}

export function useSetDrillStatus() {
  const qc = useQueryClient();
  const onErrorToast = useMutationErrorToast();
  return useMutation<{ ok: boolean }, Error, { id: string; status: "solved" | "todo" }, DrillCtx>({
    mutationFn: ({ id, status }) => api.setDrillStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.study });
      const previous = qc.getQueryData<StudyState>(queryKeys.study);
      qc.setQueryData<StudyState>(queryKeys.study, (cur) => {
        if (!cur) return cur;
        const next = { ...cur.drillProgress };
        if (status === "solved") next[id] = "solved";
        else delete next[id];
        return { ...cur, drillProgress: next };
      });
      return { previous };
    },
    // The roadmap shows a counter of solved drills per topic — that needs updating too.
    onSuccess: (_data, vars) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.roadmap }),
        ...(vars.status === "solved" ? [qc.invalidateQueries({ queryKey: queryKeys.drillArchive })] : []),
      ]),
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.study, ctx.previous);
      onErrorToast(e);
    },
  });
}

export function useGenerateDrills() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("study");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (tech: string) => api.generateDrills(tech),
    onSuccess: async (res, tech) => {
      await Promise.all([qc.invalidateQueries({ queryKey: queryKeys.study }), qc.invalidateQueries({ queryKey: queryKeys.roadmap })]);
      toast(
        res.offline ? t("toasts.aiOffline") : res.added ? t("toasts.drillsAdded", { count: res.added, tech }) : t("toasts.drillsNoneAdded"),
        res.added ? "success" : "info",
      );
    },
    onError,
  });
}

export function useGenerateCards() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("study");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (topic: string) => api.generateCards(topic),
    onSuccess: async (res, topic) => {
      // New cards change the roadmap's cardsTotal/recall level component for that topic's tech.
      await Promise.all([qc.invalidateQueries({ queryKey: queryKeys.study }), qc.invalidateQueries({ queryKey: queryKeys.roadmap })]);
      toast(
        res.offline ? t("toasts.aiOffline") : res.added ? t("toasts.cardsAdded", { count: res.added, topic }) : t("toasts.cardsNoneAdded"),
        res.added ? "success" : "info",
      );
    },
    onError,
  });
}
