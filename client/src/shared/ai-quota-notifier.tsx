import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AI_QUOTA_EXCEEDED_EVENT } from "./api";
import { useToast } from "./use-toast";
import { queryKeys } from "./queries/keys";

/**
 * Mounted once in Shell() alongside FetchAllJobNotifier/CvReviewJobNotifier/
 * CalendarReminderNotifier — this app's established pattern for a cross-cutting background
 * notice that must keep working no matter which page the user is on. Listens for the
 * X-AI-Quota-Exceeded response header (surfaced as a DOM event by shared/api.ts's
 * handleResponse) rather than a response-shape change on every one of the ~26 AI routes.
 * Renders nothing itself.
 */
export function AiQuotaNotifier() {
  const { t } = useTranslation("billing");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // De-duped for the lifetime of this page load — a Free user at quota will otherwise trigger
  // this on every subsequent AI action for the rest of the month, which is noise once they've
  // already seen the message once. The toast text itself points to /pricing (no action-button
  // API on this app's toast — see shared/toast.tsx).
  const notified = useRef(false);

  useEffect(() => {
    function onQuotaExceeded() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing });
      if (notified.current) return;
      notified.current = true;
      toast(t("quota.exceededToast"), "info");
    }
    window.addEventListener(AI_QUOTA_EXCEEDED_EVENT, onQuotaExceeded);
    return () => window.removeEventListener(AI_QUOTA_EXCEEDED_EVENT, onQuotaExceeded);
  }, [toast, queryClient, t]);

  return null;
}
