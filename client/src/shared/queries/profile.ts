import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Profile } from "../types";
import { useToast } from "../toast";
import { queryKeys } from "./keys";
import { useInvalidateDerived } from "./derived";

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: api.profile });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (p: Profile) => api.saveProfile(p),
    onSuccess: async (saved) => {
      qc.setQueryData<Profile>(queryKeys.profile, saved);
      await invalidateDerived();
      toast("Профіль збережено", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Сталася помилка", "error"),
  });
}

/**
 * Застосовує щойно розпарсений CV (сервер уже зберіг skills/cvText як побічний ефект
 * /cv/upload) до кешу профілю — оптимістично, без окремого мережевого виклику — і одразу
 * тягне похідні дані (аналітику/roadmap/план), щоб усе оновилось узгоджено.
 */
export function useApplyCvUpload() {
  const qc = useQueryClient();
  const invalidateDerived = useInvalidateDerived();
  return useCallback(
    async (res: { text: string; skills: string[]; domain?: string }) => {
      qc.setQueryData<Profile | undefined>(queryKeys.profile, (cur) => ({
        skills: res.skills,
        cvText: res.text,
        domain: res.domain ?? cur?.domain,
      }));
      await invalidateDerived();
    },
    [qc, invalidateDerived],
  );
}
