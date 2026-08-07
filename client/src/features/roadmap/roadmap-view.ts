/**
 * Which view of the Roadmap page is open. Radar, Materials and Intensive used to be routes of
 * their own (/radar, /learn, /plan21) before they became views of a single page — so a reload had
 * always kept you where you were, and `useUi` alone (in-memory, see shared/ui-state.ts) would
 * quietly take that away. Mirrored to localStorage for exactly the reason vacancies.tsx mirrors
 * its table/board choice, and by the same `jobtrack.*` key convention as shared/theme.ts.
 *
 * Deliberately its own module rather than an export from roadmap.tsx: app/App.tsx needs these to
 * honour the old URLs (RoadmapViewRedirect), and importing them from the page itself would pull
 * the whole Roadmap chunk — @xyflow, charts and all — into the main bundle, undoing the route-
 * level code splitting every lazy() at the top of App.tsx exists for.
 */
export type RoadmapView = "list" | "radar" | "materials" | "plan";

const VIEW_STORAGE_KEY = "jobtrack.roadmap.view";
const VIEWS: RoadmapView[] = ["list", "radar", "materials", "plan"];

export function readStoredRoadmapView(): RoadmapView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.includes(v as RoadmapView) ? (v as RoadmapView) : "list";
  } catch {
    // Private mode / storage blocked — fall back to the default rather than crashing the page.
    return "list";
  }
}

export function storeRoadmapView(v: RoadmapView): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  } catch {
    /* ignore — the view still works for this session, it just won't survive a reload */
  }
}
