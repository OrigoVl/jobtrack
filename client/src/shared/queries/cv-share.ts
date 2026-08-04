import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "../../i18n";
import { api } from "../api";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useCvShare() {
  return useQuery({ queryKey: queryKeys.cvShare, queryFn: api.cvShare });
}

export function useGenerateCvShare() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.generateCvShare(),
    onSuccess: async (share) => {
      qc.setQueryData(queryKeys.cvShare, share);
      toast(i18n.t("cv:shareLink.toasts.created"), "success");
    },
    onError,
  });
}

export function useSetCvShareEnabled() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (enabled: boolean) => api.setCvShareEnabled(enabled),
    onSuccess: async (share) => {
      qc.setQueryData(queryKeys.cvShare, share);
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
