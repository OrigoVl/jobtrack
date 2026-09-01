import type { FocusActionKind } from "../../shared/types";
import type { RoadmapView } from "../roadmap/roadmap-view";

/** Where a "Focus of the week" action sends the user, and (for the Practice page, which hosts
 * four different modes on one route, or the Roadmap page, which hosts four different views on
 * one route) which mode/view to open it in. `studyMode` matches the `"study.mode"` useUi key
 * that study.tsx reads — same trick dashboard.tsx already uses for its "system-design interview
 * coming up" reminder. `roadmapView` is the same idea for `"roadmap.view"` (roadmap-view.ts). */
export interface FocusDestination {
  path: string;
  studyMode?: "srs" | "drill" | "mock" | "design";
  roadmapView?: RoadmapView;
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
  // The only heuristic action of this kind is "close this specific skill gap" (see
  // heuristicFocus's "gap" code in analytics.service.ts) — the Roadmap's default list view
  // just names the gap again without doing anything about it, while its Materials view is
  // exactly the screen built to close gaps with concrete learning resources.
  skills: { path: "/roadmap", roadmapView: "materials" },
  contacts: { path: "/contacts" },
  cv: { path: "/cvbuilder" },
};

export function focusDestination(kind: FocusActionKind | undefined): FocusDestination | undefined {
  return kind ? FOCUS_DESTINATIONS[kind] : undefined;
}
