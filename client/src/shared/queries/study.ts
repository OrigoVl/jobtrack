import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { StudyState } from "../types";
import { useToast } from "../use-toast";
import { queryKeys } from "./keys";

export function useStudy() {
  return useQuery({ queryKey: queryKeys.study, queryFn: api.study });
}

export function useGradeCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ cardId, grade }: { cardId: string; grade: number }) => api.grade(cardId, grade),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.study }),
    onError: (e) => toast(e instanceof Error ? e.message : "Сталася помилка", "error"),
  });
}

interface DrillCtx {
  previous?: StudyState;
}

export function useSetDrillStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
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
    // Роудмапа показує лічильник розвʼязаних drill'ів за темою — теж треба оновити.
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roadmap }),
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.study, ctx.previous);
      toast(e instanceof Error ? e.message : "Сталася помилка", "error");
    },
  });
}

export function useGenerateDrills() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (tech: string) => api.generateDrills(tech),
    onSuccess: async (res, tech) => {
      await Promise.all([qc.invalidateQueries({ queryKey: queryKeys.study }), qc.invalidateQueries({ queryKey: queryKeys.roadmap })]);
      toast(
        res.offline
          ? "AI офлайн — увімкни ключ у server/.env"
          : res.added
            ? `Додано ${res.added} нових задач під «${tech}»`
            : "Нових задач не згенеровано (усе вже є)",
        res.added ? "success" : "info",
      );
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Сталася помилка", "error"),
  });
}

export function useGenerateCards() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (topic: string) => api.generateCards(topic),
    onSuccess: async (res, topic) => {
      await qc.invalidateQueries({ queryKey: queryKeys.study });
      toast(
        res.offline
          ? "AI офлайн — увімкни ключ у server/.env"
          : res.added
            ? `Додано ${res.added} нових карток під «${topic}»`
            : "Нових карток не згенеровано (усе вже є)",
        res.added ? "success" : "info",
      );
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Сталася помилка", "error"),
  });
}
