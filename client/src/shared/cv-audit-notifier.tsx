import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useCvAuditJobStatus } from "./queries";
import { useToast } from "./use-toast";
import { notificationsEnabled } from "./notifications";
import type { CvAuditJobStatus } from "./types";

/**
 * Mounted once in Shell() (same "always mounted, reacts to shared state from anywhere" pattern as
 * FetchAllJobNotifier/CelebrationOverlay) — so the CV Builder's line-by-line audit (see
 * server/src/modules/cv/cv-audit-job.ts) keeps being watched even if the user navigates away from
 * CV Builder while it's running. Renders nothing itself; it's a pure side-effect watcher over the
 * same polled query the CV Builder page reads for its own progress display.
 */
export function CvAuditJobNotifier() {
  const { t } = useTranslation("cv");
  const { data: job } = useCvAuditJobStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const prevStatus = useRef<CvAuditJobStatus | undefined>(undefined);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = job?.status;
    if (!job || prev !== "running") return; // only react to a transition OUT of "running"

    if (job.status === "done") {
      const offline = job.result?.offline;
      const body = offline ? t("audit.toasts.offline") : t("audit.toasts.ready");
      toast(body, offline ? "info" : "success");
      if (notificationsEnabled()) {
        const n = new Notification(t("audit.toasts.notificationTitle"), { body });
        n.onclick = () => {
          window.focus();
          navigate("/cvbuilder");
          n.close();
        };
      }
    } else if (job.status === "error") {
      toast(job.error || t("builder.toasts.analysisError"), "error");
    }
  }, [job, toast, t, navigate]);

  return null;
}
