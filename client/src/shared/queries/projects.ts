import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ProjectsData } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

// The server's GET /projects starts (or resumes) a background personalization job itself and
// responds immediately with the static ladder / last known-good result (see server's
// projects-job.ts) — `generating: true` means the personalized ladder isn't ready yet. There's no
// separate "start" gesture to react to here (unlike the CV audit/fetch-all jobs), so re-polling
// this same query is enough: staleTime: 0 overrides the app-wide 5-minute default so polling isn't
// suppressed, and refetchInterval's function form self-stops once `generating` flips to false —
// same convention as useCvAuditJobStatus/useFetchAllJobStatus.
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.projects,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.generating ? 2000 : false),
  });
}

interface ProjectsCtx {
  previous?: ProjectsData;
}

export function useSetProjectItem() {
  const qc = useQueryClient();
  const onErrorToast = useMutationErrorToast();
  return useMutation<{ ok: boolean }, Error, { itemId: string; done: boolean }, ProjectsCtx>({
    mutationFn: ({ itemId, done }) => api.setProjectItem(itemId, done),
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects });
      const previous = qc.getQueryData<ProjectsData>(queryKeys.projects);
      qc.setQueryData<ProjectsData>(queryKeys.projects, (cur) => (cur ? { ...cur, progress: { ...cur.progress, [itemId]: done } } : cur));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.projects, ctx.previous);
      onErrorToast(e);
    },
  });
}
