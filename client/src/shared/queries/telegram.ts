import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

export function useTelegramStatus() {
  return useQuery({ queryKey: queryKeys.telegramStatus, queryFn: api.telegramStatus });
}

export function useCreateTelegramLinkToken() {
  const onError = useMutationErrorToast();
  return useMutation({ mutationFn: () => api.createTelegramLinkToken(), onError });
}

export function useUnlinkTelegram() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.unlinkTelegram(),
    onSuccess: (state) => qc.setQueryData(queryKeys.telegramStatus, state),
    onError,
  });
}

export function useNotificationSettings() {
  return useQuery({ queryKey: queryKeys.notificationSettings, queryFn: api.notificationSettings });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (prefs: Record<string, boolean>) => api.saveNotificationSettings(prefs),
    // setQueryData rather than invalidate: the server echoes the saved row back, so a refetch would
    // just re-fetch what we already hold — same shape as useUnlinkTelegram above.
    onSuccess: (settings) => qc.setQueryData(queryKeys.notificationSettings, settings),
    onError,
  });
}
