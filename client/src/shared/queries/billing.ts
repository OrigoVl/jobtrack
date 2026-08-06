import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";
import type { CheckoutPlan } from "../types";
import { queryKeys } from "./keys";

export function useBilling() {
  return useQuery({ queryKey: queryKeys.billing, queryFn: api.billingMe });
}

// Both mutations below redirect the whole page to a Stripe-hosted URL on success rather than
// returning data to render — there is nothing for the caller to do with the response except
// navigate, so onSuccess is the natural (and only) place for that side effect.
export function useStartCheckout() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (plan: CheckoutPlan) => api.createCheckout(plan),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError,
  });
}

export function useOpenBillingPortal() {
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: () => api.openBillingPortal(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError,
  });
}
