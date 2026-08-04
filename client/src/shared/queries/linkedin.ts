import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";

// Not cached via a query key — this is a one-shot "generate" action (like /learn/plan or
// /cv/doc/generate), the result is held in the calling component's own state, not TanStack
// Query's cache.
export function useLinkedInOptimize() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.linkedinOptimize(),
    onError,
  });
}
