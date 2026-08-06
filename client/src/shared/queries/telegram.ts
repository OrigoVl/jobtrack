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
