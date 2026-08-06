import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { queryKeys } from "./keys";

export function useReferralState() {
  return useQuery({ queryKey: queryKeys.referralState, queryFn: api.referralState });
}

// No onError toast (unlike most mutations) — this fires silently in the background on a new
// user's first authenticated load (see ReferralClaimer in app/App.tsx); a failed/no-op claim
// (bad code, already claimed, self-referral) is never something the user needs to see.
export function useClaimReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.claimReferral(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.referralState }),
  });
}
