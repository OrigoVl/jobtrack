import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, EmptyState } from "../../shared/ui";
import type { CalendarEvent, CalendarVacancyStep } from "../../shared/types";
import { buildUpcoming } from "./calendar-agenda";
import { AgendaRows } from "./agenda-rows";

/** How many upcoming items the card lists — enough to cover the next week or two of a normal
 * search without turning the page into a second, worse list view. */
const UPCOMING_LIMIT = 7;

/**
 * "What's next", independent of which month the grid is showing. This replaced a card that
 * repeated the selected day's events — information the day popover now shows under the cursor, so
 * the space below the grid is better spent on the one question the month view can't answer at a
 * glance: what is actually coming up.
 *
 * Its data comes from its OWN date range (today → +N days), not the grid's visible month —
 * scrolling back to March must not empty out "upcoming".
 */
export function UpcomingCard({
  events,
  steps,
  fromDay,
  onOpenEvent,
  onGoVacancies,
}: {
  events: CalendarEvent[];
  steps: CalendarVacancyStep[];
  /** Local "yyyy-MM-dd" of today — the first day considered "upcoming". */
  fromDay: string;
  onOpenEvent: (event: CalendarEvent) => void;
  onGoVacancies: () => void;
}) {
  const { t } = useTranslation(["calendar", "common"]);
  const items = useMemo(() => buildUpcoming(events, steps, fromDay, UPCOMING_LIMIT), [events, steps, fromDay]);

  return (
    <Card>
      <div className="font-display font-semibold text-ink mb-2">{t("upcoming.title")}</div>
      {items.length === 0 ? (
        <EmptyState title={t("upcoming.emptyTitle")} hint={t("upcoming.emptyHint")} />
      ) : (
        <AgendaRows items={items} onOpenEvent={onOpenEvent} onGoVacancies={onGoVacancies} />
      )}
    </Card>
  );
}
