import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "../../i18n";
import { api } from "../api";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useCvShare(profileId: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.cvShare, profileId],
    queryFn: () => api.cvShare(profileId!),
    enabled: profileId !== undefined,
  });
}

export function useGenerateCvShare(profileId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.generateCvShare(profileId),
    onSuccess: async (share) => {
      qc.setQueryData([...queryKeys.cvShare, profileId], share);
      toast(i18n.t("cv:shareLink.toasts.created"), "success");
    },
    onError,
  });
}

export function useSetCvShareEnabled(profileId: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (enabled: boolean) => api.setCvShareEnabled(profileId, enabled),
    onSuccess: async (share) => {
      qc.setQueryData([...queryKeys.cvShare, profileId], share);
      toast(share.enabled ? i18n.t("cv:shareLink.toasts.enabled") : i18n.t("cv:shareLink.toasts.disabled"), "success");
    },
    onError,
  });
}

/** The PUBLIC (no session) lookup by slug — features/cv/cv-public.tsx. Not scoped/invalidated by
 * anything else in the cache (a fresh, unauthenticated visitor's query client has nothing else
 * in it anyway), so a plain per-slug key is enough. `retry: false` — a 404 (bad/disabled slug)
 * should show the "not found" state immediately, not retry a few times first. */
export function useCvPublic(slug: string) {
  return useQuery({
    queryKey: ["cvPublic", slug],
    queryFn: () => api.cvPublic(slug),
    retry: false,
  });
}
