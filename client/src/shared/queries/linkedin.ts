import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useToast } from "../use-toast";

// Not cached via a query key — this is a one-shot "generate" action (like /learn/plan or
// /cv/doc/generate), the result is held in the calling component's own state, not TanStack
// Query's cache.
export function useLinkedInOptimize() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => api.linkedinOptimize(),
    onError: (e) => toast(e instanceof Error ? e.message : "An error occurred", "error"),
  });
}
