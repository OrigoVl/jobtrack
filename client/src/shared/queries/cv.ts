import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useMutationErrorToast } from "../use-error-toast";
import { queryKeys } from "./keys";

// Read-only — cv-builder.tsx fetches/edits the doc through its own local (uncached) state since
// it needs full control over in-progress edits; this cached query is for read-only consumers
// like the Dashboard's ResumeCompleteness card, where a shared TanStack Query cache is the right
// fit (no local mutation to protect). `profileId` is undefined until the caller knows which CV
// profile to show (e.g. the Dashboard waits on useCvProfiles() to resolve its default profile).
export function useCvDoc(profileId: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.cvDoc, profileId],
    queryFn: () => api.cvDoc(profileId!),
    enabled: profileId !== undefined,
  });
}

// Polled while a CV review job is running (server/src/modules/cv/cv-review-job.ts) — the CV
// Builder's "AI Assistant" runs as a background job now (previously a single blocking request),
// so progress is observed by polling GET /cv/review/status instead of awaiting the POST.
// staleTime: 0 overrides the app-wide 5-minute default so polling isn't suppressed;
// refetchInterval's function form self-stops once the job leaves "running" (same convention as
// useFetchAllJobStatus).
export function useCvReviewJobStatus() {
  return useQuery({
    queryKey: queryKeys.cvReviewJob,
    queryFn: api.cvReviewJobStatus,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1000 : false),
  });
}

// Just starts the job (POST returns immediately, see cv-review-job.ts) — the completion
// toast/notification live in CvReviewJobNotifier (mounted once at the app shell), not here, since
// the job may finish long after this mutation itself has settled (the user can navigate away).
export function useStartCvReviewJob() {
  const qc = useQueryClient();
  const onError = useMutationErrorToast();
  return useMutation({
    mutationFn: (cvText: string) => api.startCvReviewJob(cvText),
    onSuccess: (job) => {
      // Seed the status query immediately so polling reflects "running" right away instead of
      // waiting for the first interval tick.
      qc.setQueryData(queryKeys.cvReviewJob, job);
    },
    onError,
  });
}
