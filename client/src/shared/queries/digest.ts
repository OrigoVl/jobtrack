import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18n from "../../i18n";
import { api } from "../api";
import { useToast } from "../use-toast";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useDigestPreferences() {
  return useQuery({ queryKey: queryKeys.digestPreferences, queryFn: api.digestPreferences });
}

export function useSetDigestEnabled() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (enabled: boolean) => api.setDigestEnabled(enabled),
    onSuccess: async (prefs) => {
      qc.setQueryData(queryKeys.digestPreferences, prefs);
      toast(prefs.enabled ? i18n.t("account:digest.toasts.enabled") : i18n.t("account:digest.toasts.disabled"), "success");
    },
    onError,
  });
}
