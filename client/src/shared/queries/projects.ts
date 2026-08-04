import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ProjectsData } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: api.projects });
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
