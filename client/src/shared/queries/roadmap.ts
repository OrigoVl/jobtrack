import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { RoadmapData, RoadmapNode, RoadmapStatus } from "../types";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useRoadmap() {
  return useQuery({ queryKey: queryKeys.roadmap, queryFn: api.roadmap });
}

function patchNode(rm: RoadmapData, tech: string, patch: Partial<RoadmapNode>): RoadmapData {
  const groups = rm.groups.map((g) => ({
    ...g,
    nodes: g.nodes.map((n) => (n.tech === tech ? { ...n, ...patch } : n)),
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

/** Optimistic toggling of skill status with rollback on network error. */
export function useSetRoadmapStatus() {
  const qc = useQueryClient();
  const onErrorToast = useMutationErrorToast();
  return useMutation<{ ok: boolean }, Error, { tech: string; status: RoadmapStatus }, RoadmapCtx>({
    mutationFn: ({ tech, status }) => api.setRoadmapStatus(tech, status),
    onMutate: async ({ tech, status }) => {
      await qc.cancelQueries({ queryKey: queryKeys.roadmap });
      const previous = qc.getQueryData<RoadmapData>(queryKeys.roadmap);
      qc.setQueryData<RoadmapData>(queryKeys.roadmap, (cur) => (cur ? patchNode(cur, tech, { status }) : cur));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.roadmap, ctx.previous);
      onErrorToast(e);
    },
    // Status is one of the level's own inputs (see server's skill-level.ts, weight 0.5) — the
    // client deliberately doesn't duplicate that formula, so a real refetch is needed to pick up
    // the server-recomputed level rather than just patching status in the local cache above.
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.roadmap }),
  });
}

/** Optimistic manual skill-level override, with rollback on network error. Setting a level
 * patches both `level` and `levelManual` (the "Set by you" state); clearing (level: null) patches
 * `level` back to the node's own `levelAuto` and clears `levelManual` — both directions are exact
 * because the node already carries `levelAuto` from the last successful fetch. */
export function useSetSkillLevel() {
  const qc = useQueryClient();
  const onErrorToast = useMutationErrorToast();
  return useMutation<{ ok: boolean; levels: Record<string, number> }, Error, { tech: string; level: number | null }, RoadmapCtx>({
    mutationFn: ({ tech, level }) => api.setSkillLevel(tech, level),
    onMutate: async ({ tech, level }) => {
      await qc.cancelQueries({ queryKey: queryKeys.roadmap });
      const previous = qc.getQueryData<RoadmapData>(queryKeys.roadmap);
      qc.setQueryData<RoadmapData>(queryKeys.roadmap, (cur) => {
        if (!cur) return cur;
        const node = cur.groups.flatMap((g) => g.nodes).find((n) => n.tech === tech);
        if (!node) return cur;
        return patchNode(cur, tech, level != null ? { level, levelManual: level } : { level: node.levelAuto, levelManual: null });
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.roadmap, ctx.previous);
      onErrorToast(e);
    },
  });
}
