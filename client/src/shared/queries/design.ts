import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import type { DesignDiagram, DesignExercise, DesignTask } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";

// GET /design/current — resumes the in-progress exercise after a reload (unlike the stateless
// mock interview, a diagram is real effort; see design.routes.ts's own comment on this choice).
export function useDesignCurrent() {
  return useQuery({ queryKey: queryKeys.designCurrent, queryFn: api.designCurrent });
}

// GET /design/history — lightweight score log, newest first, capped server-side.
export function useDesignHistory() {
  return useQuery({ queryKey: queryKeys.designHistory, queryFn: api.designHistory });
}

// GET /design/archive — full task/diagram/grade snapshot of each graded exercise, newest first.
export function useDesignArchive() {
  return useQuery({ queryKey: queryKeys.designArchive, queryFn: api.designArchive });
}

export function useUpdateDesignArchiveEntry() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("design");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<{ title: string; scenario: string; summary: string; tip: string }> }) =>
      api.updateDesignArchiveEntry(id, patch),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.designArchive });
      toast(t("archive.toasts.updated"), "success");
    },
    onError,
  });
}

export function useDeleteDesignArchiveEntry() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("design");
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (id: string) => api.deleteDesignArchiveEntry(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.designArchive });
      toast(t("archive.toasts.deleted"), "success");
    },
    onError,
  });
}

export function useGenerateDesignTask() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (vacancyId?: number) => api.designTask(vacancyId),
    // A fresh task replaces whatever exercise (task/diagram/grade) was current — the component
    // is responsible for clearing its own local diagram state on success, this just keeps the
    // "resume after reload" cache from showing the stale previous exercise in the meantime.
    onSuccess: (res) => {
      if (res.task)
        qc.setQueryData<DesignExercise>(queryKeys.designCurrent, { task: res.task, diagram: { nodes: [], edges: [] }, grade: null });
    },
    onError,
  });
}

export function useGradeDesign() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ task, diagram }: { task: DesignTask; diagram: DesignDiagram }) => api.designGrade(task, diagram),
    onSuccess: (grade, { task, diagram }) => {
      qc.setQueryData<DesignExercise>(queryKeys.designCurrent, { task, diagram, grade });
      // Grading also appends a history entry AND an archive entry server-side (design.routes.ts)
      // — refetch rather than guess the server-generated id/timestamp client-side.
      void qc.invalidateQueries({ queryKey: queryKeys.designHistory });
      void qc.invalidateQueries({ queryKey: queryKeys.designArchive });
    },
    onError,
  });
}
