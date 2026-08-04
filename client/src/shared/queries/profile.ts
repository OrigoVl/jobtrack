import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Profile } from "../types";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";
import { useInvalidateDerived } from "./derived";

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: api.profile });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  const invalidateDerived = useInvalidateDerived();
  return useMutation({
    mutationFn: (p: Profile) => api.saveProfile(p),
    onSuccess: async (saved) => {
      qc.setQueryData<Profile>(queryKeys.profile, saved);
      await invalidateDerived();
      toast("Profile saved", "success");
    },
    onError,
  });
}

/**
 * Applies a freshly parsed CV (the server has already saved skills/cvText as a side effect
 * of /cv/upload) to the profile cache — optimistically, without a separate network call —
 * and immediately refetches derived data (analytics/roadmap/plan) so everything updates consistently.
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
