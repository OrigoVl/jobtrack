import { useEffect, useRef, useState } from "react";

export interface PopoverCoords {
  top: number;
  left: number;
  /** Caps the panel's own height so it can never extend past the bottom of the viewport — without
   * this, a panel taller than the remaining space below the anchor (e.g. Vacancies' Kanban "Move"
   * menu opened on a card near the bottom of the window) simply overflows off-screen with no way
   * to reach the rest of it, since the browser viewport itself doesn't scroll a `position: fixed`
   * element into view. Paired with `overflow-y-auto` on the panel (see PopoverPanel) so it scrolls
   * internally instead. Computed generically from `top` here (not by each caller) — it's correct
   * regardless of whether that caller always opens below (Dropdown) or flips above when there's no
   * room (the date picker in date-input.tsx). */
  maxHeight: number;
}

/**
 * Shared state/positioning logic behind every "anchored popover" in this app (Dropdown in
 * shared/ui.tsx, the calendar-icon date picker in shared/date-input.tsx): an anchor element,
 * open/close state, and a panel that needs to float above the anchor without being clipped by an
 * `overflow-x-auto`/`overflow-hidden` ancestor — tables, the Vacancies Kanban board's horizontal
 * scroller, etc. all silently clip a `position: absolute` popover nested inside them. The panel
 * (see shared/popover.tsx's PopoverPanel) is instead portaled to `document.body` and positioned
 * `fixed` from the anchor's live bounding rect.
 *
 * `computeCoords` receives the anchor's current DOMRect and returns where the panel should sit —
 * callers own the alignment/viewport-clamping logic since that differs per popover (e.g. Dropdown
 * aligns left/right of its button; the date picker also flips above when there's no room below).
 */
/**
 * `T` is the anchor element's type. It defaults to `HTMLDivElement` (every caller that attaches
 * `anchorRef` to a wrapper `<div>` in JSX), and is widened by callers that anchor to something
 * else — the Calendar page assigns `anchorRef.current` imperatively to whichever day-cell button
 * was clicked, since one popover serves 42 possible anchors and can't be a ref in the markup.
 */
export function usePopover<T extends HTMLElement = HTMLDivElement>(
  computeCoords: (anchorRect: DOMRect, panelHeight: number) => Omit<PopoverCoords, "maxHeight">,
) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords>({ top: 0, left: 0, maxHeight: 0 });
  const anchorRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const computeCoordsRef = useRef(computeCoords);
  computeCoordsRef.current = computeCoords;

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      // The panel's REAL rendered height, so a caller that flips above the anchor can sit right on
      // top of it instead of guessing. It's 0 on the very first call of an open cycle (the panel
      // mounts in the same render that this effect follows), which is why callers pass their own
      // estimate as the fallback — see date-input.tsx / calendar.tsx.
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const { top, left } = computeCoordsRef.current(rect, panelHeight);
      // A little breathing room below the panel, and never less than a genuinely usable height
      // even on a very short viewport (an edge case, not the common path — the panel itself still
      // scrolls beyond that via overflow-y-auto).
      const maxHeight = Math.max(100, window.innerHeight - top - 8);
      setCoords({ top, left, maxHeight });
    };
    reposition();
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      // A NESTED popover's panel is portaled to <body>, so it isn't inside this one's panel and
      // would otherwise read as an outside click — closing the parent out from under the child
      // (e.g. the CV Builder's vacancy menu vanishing the moment its searchable select is used).
      // `[data-keep-open]` is the same marker PopoverPanel's own click handler honours, and it's
      // only ever put on popover-internal chrome, so nothing outside a popover matches it.
      if (target instanceof Element && target.closest("[data-keep-open]")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    // capture: true — a scroll inside a nested scroller (table, Kanban board) doesn't bubble,
    // but it IS caught in the capture phase at the window.
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  return { open, setOpen, anchorRef, panelRef, coords };
}
