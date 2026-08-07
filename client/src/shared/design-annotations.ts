// Pure geometry/factory helpers for the canvas's freeform drawing layer (pen/shapes/arrows/text —
// see types.ts's DesignAnnotation) — kept out of design-canvas.tsx so the actual math is
// unit-testable without mounting React Flow, same convention as design-layout.ts/design-patterns.ts.
import type { DesignAnnotation, DesignArrowAnnotation, DesignAnnotationKind } from "./types";

export type DesignDrawTool = "select" | DesignAnnotationKind;

/** An axis-aligned box in flow (diagram) coordinates — what `normalizeRect` returns, and the shared
 * currency of the selection/resize helpers below. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Corner handles only (no edge handles) — enough to resize any annotation kind, and at the 8px
 * on-screen size the canvas draws them, four targets stay comfortably apart on a small shape. */
export type ResizeHandle = "nw" | "ne" | "se" | "sw";
export const RESIZE_HANDLES: ResizeHandle[] = ["nw", "ne", "se", "sw"];

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
export function normalizeRect(p0: { x: number; y: number }, p1: { x: number; y: number }): Rect {
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

// Rough on-canvas metrics of a text annotation, matching design-canvas.tsx's `text-sm` label
// (14px/20px). Deliberately an estimate rather than a real measurement: this module stays pure and
// DOM-free (that's the whole reason the geometry lives here), and the numbers only position a
// selection outline — being a few pixels off is invisible, and text isn't resizable anyway.
const TEXT_LINE_HEIGHT = 20;
const TEXT_CHAR_WIDTH = 7.2;
const TEXT_MAX_WIDTH = 220;

/** The axis-aligned box an annotation occupies — what the canvas outlines when it's selected, and
 * the `from` box a resize drag scales away from. */
export function annotationBounds(annotation: DesignAnnotation): Rect {
  switch (annotation.kind) {
    case "freehand": {
      const xs = annotation.points.map((p) => p.x);
      const ys = annotation.points.map((p) => p.y);
      if (!xs.length || !ys.length) return { x: 0, y: 0, width: 0, height: 0 };
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
    case "rectangle":
    case "ellipse":
      return { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
    case "arrow":
      return normalizeRect({ x: annotation.x1, y: annotation.y1 }, { x: annotation.x2, y: annotation.y2 });
    case "text": {
      const lines = annotation.text.split("\n");
      const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
      return {
        x: annotation.x,
        y: annotation.y,
        width: Math.min(TEXT_MAX_WIDTH, Math.max(TEXT_CHAR_WIDTH * 3, longest * TEXT_CHAR_WIDTH)),
        height: lines.length * TEXT_LINE_HEIGHT,
      };
    }
  }
}

/** Where a given corner handle sits on a box. */
export function resizeHandlePoint(bounds: Rect, handle: ResizeHandle): { x: number; y: number } {
  return {
    x: handle === "nw" || handle === "sw" ? bounds.x : bounds.x + bounds.width,
    y: handle === "nw" || handle === "ne" ? bounds.y : bounds.y + bounds.height,
  };
}

/** The new box after dragging `handle` to `point`: the opposite corner stays pinned, and the
 * dragged one is clamped so the box can never invert or collapse below MIN_SHAPE_SIZE (dragging
 * past the anchor stops rather than flipping the shape inside out mid-drag). */
export function resizeBounds(bounds: Rect, handle: ResizeHandle, point: { x: number; y: number }): Rect {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const movesLeftEdge = handle === "nw" || handle === "sw";
  const movesTopEdge = handle === "nw" || handle === "ne";
  const x = movesLeftEdge ? Math.min(point.x, right - MIN_SHAPE_SIZE) : bounds.x;
  const y = movesTopEdge ? Math.min(point.y, bottom - MIN_SHAPE_SIZE) : bounds.y;
  return {
    x,
    y,
    width: (movesLeftEdge ? right : Math.max(point.x, bounds.x + MIN_SHAPE_SIZE)) - x,
    height: (movesTopEdge ? bottom : Math.max(point.y, bounds.y + MIN_SHAPE_SIZE)) - y,
  };
}

/** Remaps an annotation from one bounding box to another — one linear transform covering every
 * kind, so a resize drag doesn't need per-kind handle math (freehand scales all its points, an
 * arrow both endpoints, a rect/ellipse its origin and size). Text only moves: its size comes from
 * the font, not from stored dimensions, so the canvas gives it no resize handles at all. Always
 * called with the ORIGINAL annotation and its bounds captured at drag start, never the previous
 * frame's — chaining per-frame scales would compound rounding drift across a long drag. */
export function scaleAnnotationToBounds(annotation: DesignAnnotation, from: Rect, to: Rect): DesignAnnotation {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  const mapX = (x: number) => to.x + (x - from.x) * sx;
  const mapY = (y: number) => to.y + (y - from.y) * sy;
  switch (annotation.kind) {
    case "freehand":
      return { ...annotation, points: annotation.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) })) };
    case "rectangle":
    case "ellipse":
      return { ...annotation, x: mapX(annotation.x), y: mapY(annotation.y), width: annotation.width * sx, height: annotation.height * sy };
    case "arrow":
      return { ...annotation, x1: mapX(annotation.x1), y1: mapY(annotation.y1), x2: mapX(annotation.x2), y2: mapY(annotation.y2) };
    case "text":
      return { ...annotation, x: mapX(annotation.x), y: mapY(annotation.y) };
  }
}

/** The center a rotation turns about, and the origin the canvas anchors its rotate handle to. */
export function annotationCenter(annotation: DesignAnnotation): { x: number; y: number } {
  const bounds = annotationBounds(annotation);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Wraps any angle into [0, 360), so a rotation accumulated over several drags stays readable and
 * two visually identical rotations compare equal. */
export function normalizeAngle(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Rotates a point clockwise about `center` (SVG's y-down convention, so this matches what
 * `transform="rotate(deg cx cy)"` draws — the inverse, used to map a pointer back into a rotated
 * shape's own frame, is just a negated angle). */
export function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, degrees: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** The SVG transform that draws an annotation at its stored rotation, or undefined when it's
 * unrotated — geometry stays axis-aligned in state and only the presentation is turned, so bounds
 * math, resizing and hit-testing all keep working in the shape's own frame. */
export function rotationTransform(annotation: DesignAnnotation): string | undefined {
  const rotation = annotation.rotation ?? 0;
  if (!rotation) return undefined;
  const center = annotationCenter(annotation);
  return `rotate(${rotation} ${center.x} ${center.y})`;
}

/** The angle a rotate-handle drag implies: the handle sits directly ABOVE the center, so a pointer
 * straight up is 0°, and the +90 turns atan2's "east is 0" into that. */
export function angleFromCenter(center: { x: number; y: number }, point: { x: number; y: number }): number {
  return normalizeAngle((Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90);
}

/** A diagram node reduced to the box the arrow-binding math needs — the canvas builds these from
 * React Flow's measured node dimensions, keeping this module free of any React Flow types. */
export interface BindableNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far outside a node's box an arrow endpoint still counts as "dropped on it", and the gap the
 * anchored endpoint then keeps from the border so the arrowhead doesn't overlap the node's card. */
export const ARROW_BIND_DISTANCE = 24;
const ARROW_BIND_GAP = 6;

/** The node an arrow endpoint should stick to when released at `point`: the one whose box (grown by
 * ARROW_BIND_DISTANCE) contains it, and if several overlap, the one whose center is nearest — so
 * dropping into the overlap of two boxes binds to the one you're most obviously pointing at. */
export function findBindTarget(point: { x: number; y: number }, nodes: BindableNode[]): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const node of nodes) {
    const withinX = point.x >= node.x - ARROW_BIND_DISTANCE && point.x <= node.x + node.width + ARROW_BIND_DISTANCE;
    const withinY = point.y >= node.y - ARROW_BIND_DISTANCE && point.y <= node.y + node.height + ARROW_BIND_DISTANCE;
    if (!withinX || !withinY) continue;
    const distance = Math.hypot(point.x - (node.x + node.width / 2), point.y - (node.y + node.height / 2));
    if (!best || distance < best.distance) best = { id: node.id, distance };
  }
  return best?.id ?? null;
}

/** Where on a node's border an arrow coming from `toward` should land: the ray from the node's
 * center toward that point, clipped to the box (plus ARROW_BIND_GAP). Walking the border like this
 * — rather than pinning a fixed side — is what makes a bound arrow swing around the node as the
 * other end (or the node itself) moves. */
export function anchorPointOnNode(node: BindableNode, toward: { x: number; y: number }): { x: number; y: number } {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx === 0 ? Infinity : (node.width / 2 + ARROW_BIND_GAP) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (node.height / 2 + ARROW_BIND_GAP) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Re-anchors a bound arrow against the current node boxes, and drops bindings whose node is gone
 * (deleted since). Each bound end aims at the other end — the other node's CENTER when that end is
 * bound too, so both ends face each other instead of chasing the previous frame's coordinates.
 * Returns the annotation unchanged (same reference) when nothing moved, so the caller can skip a
 * state update rather than loop on its own change. */
export function applyArrowBindings(arrow: DesignArrowAnnotation, nodes: Map<string, BindableNode>): DesignArrowAnnotation {
  const startNode = arrow.startNodeId ? nodes.get(arrow.startNodeId) : undefined;
  const endNode = arrow.endNodeId ? nodes.get(arrow.endNodeId) : undefined;
  const startBindingLost = arrow.startNodeId != null && !startNode;
  const endBindingLost = arrow.endNodeId != null && !endNode;
  const start = startNode
    ? anchorPointOnNode(
        startNode,
        endNode ? { x: endNode.x + endNode.width / 2, y: endNode.y + endNode.height / 2 } : { x: arrow.x2, y: arrow.y2 },
      )
    : { x: arrow.x1, y: arrow.y1 };
  const end = endNode
    ? anchorPointOnNode(
        endNode,
        startNode ? { x: startNode.x + startNode.width / 2, y: startNode.y + startNode.height / 2 } : { x: arrow.x1, y: arrow.y1 },
      )
    : { x: arrow.x2, y: arrow.y2 };
  const moved = start.x !== arrow.x1 || start.y !== arrow.y1 || end.x !== arrow.x2 || end.y !== arrow.y2;
  if (!moved && !startBindingLost && !endBindingLost) return arrow;
  const next: DesignArrowAnnotation = { ...arrow, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  if (startBindingLost) delete next.startNodeId;
  if (endBindingLost) delete next.endNodeId;
  return next;
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
