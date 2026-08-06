import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useCombinedCalendar } from "../../shared/queries";
import { notificationsEnabled } from "../../shared/notifications";
import { findEventsToNotify, getNotifiedEventIds, markNotified } from "../../shared/calendar-reminders";
import { ymd } from "../../shared/calendar-grid";
import type { CalendarEventType } from "../../shared/types";

const POLL_MS = 60_000;

// Mirrors calendar.tsx's own (unexported, component-local) TYPE_KEY — a Record, not a template
// literal, so every value stays a literal key i18next's typed t() can verify.
const TYPE_KEY: Record<
  CalendarEventType,
  "eventType.interview" | "eventType.call" | "eventType.deadline" | "eventType.reminder" | "eventType.other"
> = {
  interview: "eventType.interview",
  call: "eventType.call",
  deadline: "eventType.deadline",
  reminder: "eventType.reminder",
  other: "eventType.other",
};

/**
 * Mounted once in Shell() (same "always mounted, reacts to shared state from anywhere" pattern as
 * CelebrationOverlay/FetchAllJobNotifier) — fires a browser Notification a few minutes before a
 * manual calendar event starts, regardless of which page the user is currently on. Polls
 * `useCombinedCalendar` every POLL_MS (rather than relying on its default 5-minute staleTime)
 * since a reminder that's late by several minutes defeats the point.
 */
export function CalendarReminderNotifier() {
  const { t, i18n } = useTranslation("calendar");
  const navigate = useNavigate();
  // `from` only (no `to`) — every future event for this user from today onward, a small/cheap set
  // for a personal calendar. Stays the SAME query key all day (only changes at midnight), so
  // POLL_MS re-fetches reuse one cache entry instead of minting a new one every minute.
  const { data } = useCombinedCalendar({ from: ymd(new Date()) }, { refetchInterval: POLL_MS });

  useEffect(() => {
    if (!data || !notificationsEnabled()) return;
    const now = Date.now();
    const toNotify = findEventsToNotify(data.events, now, getNotifiedEventIds(now));
    for (const event of toNotify) {
      const timeLabel = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startAt));
      const n = new Notification(t("notifications.title"), {
        tag: `calendar-event-${event.id}`,
        body: t("notifications.body", { title: event.title || t("untitledEvent"), type: t(TYPE_KEY[event.type]), time: timeLabel }),
      });
      n.onclick = () => {
        window.focus();
        navigate("/calendar");
        n.close();
      };
      markNotified(event);
    }
  }, [data, t, i18n.language, navigate]);

  return null;
}
