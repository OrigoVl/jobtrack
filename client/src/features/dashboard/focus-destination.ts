import type { FocusActionKind } from "../../shared/types";

/** Where a "Focus of the week" action sends the user, and (for the Practice page, which hosts
 * four different modes on one route) which mode to open it in. `studyMode` matches the
 * `"study.mode"` useUi key that study.tsx reads — same trick dashboard.tsx already uses for its
 * "system-design interview coming up" reminder. */
export interface FocusDestination {
  path: string;
  studyMode?: "srs" | "drill" | "mock" | "design";
}

/**
 * The client-side half of the focus-action contract: the server classifies each action into one
 * of a closed set of areas (FOCUS_ACTION_KINDS, server/src/modules/analytics/analytics.service.ts)
 * and this maps that to a real route. Kept on the client precisely so the server never has to
 * hardcode a URL it can't validate — and so a route rename is a one-file change here rather than
 * a wire-format migration.
 *
 * A `Record` over the full union (not a partial map with a fallback) so adding a kind on the
 * server and forgetting to route it is a tsc error, not a dead link discovered in production.
 */
export const FOCUS_DESTINATIONS: Record<FocusActionKind, FocusDestination> = {
  vacancies: { path: "/vacancies" },
  // Interview prep and card review both live on Practice, but in different modes — sending
  // someone told to "prepare for interviews" to the flashcard deck would be a broken promise.
  interviews: { path: "/study", studyMode: "mock" },
  cards: { path: "/study", studyMode: "srs" },
  skills: { path: "/roadmap" },
  contacts: { path: "/contacts" },
  cv: { path: "/cvbuilder" },
};

export function focusDestination(kind: FocusActionKind | undefined): FocusDestination | undefined {
  return kind ? FOCUS_DESTINATIONS[kind] : undefined;
}
