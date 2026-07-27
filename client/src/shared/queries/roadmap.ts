import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { RoadmapData, RoadmapStatus } from "../types";
import { useToast } from "../toast";
import { queryKeys } from "./keys";

export function useRoadmap() {
  return useQuery({ queryKey: queryKeys.roadmap, queryFn: api.roadmap });
}

function recomputeRoadmap(rm: RoadmapData, tech: string, status: RoadmapStatus): RoadmapData {
  const groups = rm.groups.map((g) => ({
    ...g,
    nodes: g.nodes.map((n) => (n.tech === tech ? { ...n, status } : n)),
  }));
  const all = groups.flatMap((g) => g.nodes);
  return {
    groups,
    progress: {
      done: all.filter((n) => n.status === "done").length,
      learning: all.filter((n) => n.status === "learning").length,
      total: all.length,
    },
  };
}

interface RoadmapCtx {
  previous?: RoadmapData;
}

/** Оптимістичне перемикання статусу навички з відкатом при помилці мережі. */
export function useSetRoadmapStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation<{ ok: boolean }, Error, { tech: string; status: RoadmapStatus }, RoadmapCtx>({
    mutationFn: ({ tech, status }) => api.setRoadmapStatus(tech, status),
    onMutate: async ({ tech, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.roadmap });
      const previous = qc.getQueryData<RoadmapData>(queryKeys.roadmap);
      qc.setQueryData<RoadmapData>(queryKeys.roadmap, (cur) => (cur ? recomputeRoadmap(cur, tech, status) : cur));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.roadmap, ctx.previous);
      toast(e instanceof Error ? e.message : "Сталася помилка", "error");
    },
  });
}
