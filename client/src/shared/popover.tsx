import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import type { PopoverCoords } from "./use-popover";

/** Portals `children` to `document.body`, positioned `fixed` at `coords`, once `open`. Clicking
 * anything inside without `data-keep-open` closes it — the same "closes once you pick something,
 * like a native <select>" convention every popover panel in this app follows. Pair with
 * `usePopover` (shared/use-popover.ts) for the anchor/state plumbing. */
export function PopoverPanel({
  open,
  panelRef,
  coords,
  onClose,
  className,
  style,
  children,
}: {
  open: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  coords: PopoverCoords;
  onClose: () => void;
  className?: string;
  /** Merged into the positioning style below — e.g. an explicit `width` so a panel with wider
   * content than the default menu-item list doesn't have to fight the className's min-width. */
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      ref={panelRef}
      className={`fixed z-[60] rounded-xl bg-surface/85 backdrop-blur-sm border border-grid shadow-lg overflow-y-auto overscroll-contain ${className ?? ""}`}
      style={{ top: coords.top, left: coords.left, maxHeight: coords.maxHeight, ...style }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-keep-open]")) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
