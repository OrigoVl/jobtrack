import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import type { EnrichmentQueryInput } from "../types";
import { useMutationErrorToast } from "../use-error-toast";

// Not cached via a query key — a one-shot "search" action (like useContactOutreach), the result
// is held in the calling component's own state, not TanStack Query's cache. Doesn't mutate
// anything server-side, so no invalidation on success.
export function useEnrichContacts() {
  const onError = useMutationErrorToast();
  return useMutation({ mutationFn: (q: EnrichmentQueryInput) => api.enrichContacts(q), onError });
}

export function useRevealContactEmail() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: ({ provider, revealId }: { provider: string; revealId: string }) => api.revealContactEmail(provider, revealId),
    onError,
  });
}
