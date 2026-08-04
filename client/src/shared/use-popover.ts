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
export function usePopover(computeCoords: (anchorRect: DOMRect) => Omit<PopoverCoords, "maxHeight">) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords>({ top: 0, left: 0, maxHeight: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const computeCoordsRef = useRef(computeCoords);
  computeCoordsRef.current = computeCoords;

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { top, left } = computeCoordsRef.current(rect);
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
