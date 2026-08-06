import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useFetchAllJobStatus } from "./queries";
import { useInvalidateAll } from "./queries/derived";
import { useToast } from "./use-toast";
import { notificationsEnabled } from "./notifications";
import type { FetchAllJobStatus } from "./types";

/**
 * Mounted once in Shell() (same "always mounted, reacts to shared state from anywhere" pattern
 * as CelebrationOverlay) — so the "Проаналізувати всі вакансії" batch job (see
 * server/src/modules/vacancies/fetch-all-job.ts) keeps being watched even if the user navigates
 * away from the Analyzer page while it's running. Renders nothing itself; it's a pure side-effect
 * watcher over the same polled query the Analyzer page reads for its progress bar/results table.
 */
export function FetchAllJobNotifier() {
  const { t } = useTranslation("vacancies");
  const { data: job } = useFetchAllJobStatus();
  const invalidateAll = useInvalidateAll();
  const { toast } = useToast();
  const navigate = useNavigate();
  const prevStatus = useRef<FetchAllJobStatus | undefined>(undefined);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = job?.status;
    if (!job || prev !== "running") return; // only react to a transition OUT of "running"

    if (job.status === "done") {
      void invalidateAll();
      toast(t("toasts.fetchAllProcessed", { count: job.processed }), "success");
      if (notificationsEnabled()) {
        const n = new Notification(t("toasts.fetchAllNotificationTitle"), {
          body: t("toasts.fetchAllProcessed", { count: job.processed }),
        });
        n.onclick = () => {
          window.focus();
          navigate("/analyzer");
          n.close();
        };
      }
    } else if (job.status === "error") {
      toast(job.error || t("toasts.fetchAllError"), "error");
    }
  }, [job, invalidateAll, toast, t, navigate]);

  return null;
}
