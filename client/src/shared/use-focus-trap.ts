import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Every currently-open trap, most-recently-opened last. A dialog can open ANOTHER trapped dialog
// on top of it (e.g. the vacancy detail modal's own "discard changes?" confirm) — only the
// topmost entry's keydown handler should act on Tab, or the outer dialog's trap steals focus back
// out from under the nested one it has no idea is there. Module-level rather than context/props:
// every trap needs to see every other trap regardless of where in the tree it renders (several are
// portaled straight to document.body), and there's normally at most one or two entries alive.
const trapStack: RefObject<HTMLElement | null>[] = [];

/**
 * Hand-rolled WAI-ARIA dialog focus management, shared by every `role="dialog"`/`role="alertdialog"`
 * overlay in this app (confirm.tsx, vacancy-detail-modal, vacancy-create-modal, event-modal): while
 * `active`, moves focus into the dialog on open (an explicit `initialFocusRef`, or the first
 * focusable element inside the container) and cycles Tab/Shift+Tab within it so it can never
 * escape to the page underneath; on close (`active` turning false, or the component unmounting),
 * returns focus to whatever had it right before the dialog opened — the row/card/button that
 * triggered it — instead of leaving focus stranded on `<body>`.
 *
 * Attach the returned ref to the dialog's own outermost element (the one carrying
 * `role="dialog"`/`aria-modal`). `active` defaults to `true` for a modal component that's only
 * ever mounted while open (its own unmount is the close); pass a real boolean for a
 * provider-style dialog that stays mounted and toggles open/closed internally (see confirm.tsx).
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active = true,
  initialFocusRef?: RefObject<HTMLElement | null>,
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const stackEntry = containerRef as RefObject<HTMLElement | null>;
    trapStack.push(stackEntry);

    const focusables = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        // offsetParent is null for display:none (and unattached) elements — cheap visibility check,
        // no getComputedStyle needed for what's realistically hidden inside a dialog body.
        (el) => el.offsetParent !== null,
      );

    (initialFocusRef?.current ?? focusables()[0] ?? containerRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (trapStack[trapStack.length - 1] !== stackEntry) return; // a nested dialog owns Tab right now
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && !!containerRef.current?.contains(current);
      if (e.shiftKey ? current === first || !inside : current === last || !inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const idx = trapStack.indexOf(stackEntry);
      if (idx !== -1) trapStack.splice(idx, 1);
      previouslyFocused.current?.focus();
    };
  }, [active, initialFocusRef]);

  return containerRef;
}
