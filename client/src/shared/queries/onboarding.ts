import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";
import { useMutationErrorToast } from "../use-error-toast";

export function useOnboardingState() {
  return useQuery({ queryKey: queryKeys.onboardingState, queryFn: api.onboardingState });
}

export function useMarkWelcomeSeen() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.markWelcomeSeen(),
    onSuccess: (state) => qc.setQueryData(queryKeys.onboardingState, state),
    onError,
  });
}
