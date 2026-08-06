// Pure geometry/factory helpers for the canvas's freeform drawing layer (pen/shapes/arrows/text —
// see types.ts's DesignAnnotation) — kept out of design-canvas.tsx so the actual math is
// unit-testable without mounting React Flow, same convention as design-layout.ts/design-patterns.ts.
import type { DesignAnnotation, DesignAnnotationKind } from "./types";

export type DesignDrawTool = "select" | DesignAnnotationKind;

// A small fixed palette (not a full color picker) — same "small closed set" reasoning as
// design-patterns.ts's pattern list. Each swatch also gets its own arrow-marker id in
// design-canvas.tsx, since an SVG marker can't inherit a dynamic per-instance stroke color.
export const ANNOTATION_COLORS = ["#4338ca", "#dc2626", "#16a34a", "#d97706", "#0891b2", "#db2777"] as const;
export const DEFAULT_ANNOTATION_COLOR: string = ANNOTATION_COLORS[0];

/** A DOM-id-safe fragment derived from a hex color (`#4338ca` -> `4338ca`), for building this
 * color's own `<marker id="...">` — ids can't contain `#`. */
export function colorMarkerKey(color: string): string {
  return color.replace("#", "");
}

/** Below this, a drag is almost certainly an accidental click-and-release, not an intended shape —
 * discarded by the caller rather than committing a near-invisible annotation. */
export const MIN_SHAPE_SIZE = 4;

/** Normalizes two arbitrary drag corners into a top-left-anchored rect — a shape dragged
 * up/left of its start point still gets a positive width/height instead of a negative one. */
export function normalizeRect(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(p0.x, p1.x);
  const y = Math.min(p0.y, p1.y);
  return { x, y, width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) };
}

/** SVG path `d` for a freehand stroke — a plain polyline (no curve smoothing) through every
 * captured point; good enough for a "basic" pen tool. Empty string for <2 points (nothing to draw). */
export function buildFreehandPathD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  return `M ${first!.x} ${first!.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
}

/** Moves any annotation kind by (dx, dy) — used by the canvas's drag-to-reposition interaction in
 * the "select" tool. Pure and exhaustive over DesignAnnotationKind so a new kind added later is a
 * compile error here until handled, not a silently-ignored drag. */
export function translateAnnotation(annotation: DesignAnnotation, dx: number, dy: number): DesignAnnotation {
  switch (annotation.kind) {
    case "freehand":
      return { ...annotation, points: annotation.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case "rectangle":
    case "ellipse":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
    case "arrow":
      return { ...annotation, x1: annotation.x1 + dx, y1: annotation.y1 + dy, x2: annotation.x2 + dx, y2: annotation.y2 + dy };
    case "text":
      return { ...annotation, x: annotation.x + dx, y: annotation.y + dy };
  }
}

/** Same id shape as design.routes.ts's DesignHistoryEntry ids — NOT a per-session counter: a
 * counter starting fresh at 1 on every page load would collide with an annotation id already
 * persisted from an earlier session (e.g. a previously-saved "rectangle-1") the moment this
 * session creates its own first rectangle. */
export function nextAnnotationId(kind: DesignAnnotationKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const DRAW_TOOL_KINDS: DesignAnnotationKind[] = ["freehand", "rectangle", "ellipse", "arrow", "text"];

export function isDrawTool(tool: DesignDrawTool): tool is DesignAnnotationKind {
  return DRAW_TOOL_KINDS.includes(tool as DesignAnnotationKind);
}
