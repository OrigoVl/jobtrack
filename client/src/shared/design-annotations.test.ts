import { describe, expect, it } from "vitest";
import {
  anchorPointOnNode,
  angleFromCenter,
  ANNOTATION_COLORS,
  annotationBounds,
  applyArrowBindings,
  buildFreehandPathD,
  colorMarkerKey,
  findBindTarget,
  isDrawTool,
  MIN_SHAPE_SIZE,
  nextAnnotationId,
  normalizeAngle,
  normalizeRect,
  resizeBounds,
  resizeHandlePoint,
  rotatePoint,
  rotationTransform,
  scaleAnnotationToBounds,
  translateAnnotation,
  type BindableNode,
} from "./design-annotations";
import type { DesignAnnotation, DesignArrowAnnotation } from "./types";

describe("normalizeRect", () => {
  it("keeps a top-left-to-bottom-right drag as-is", () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 50, y: 60 })).toEqual({ x: 10, y: 20, width: 40, height: 40 });
  });

  it("normalizes a drag toward the top-left into a positive-size rect anchored correctly", () => {
    expect(normalizeRect({ x: 50, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 40 });
  });
});

describe("buildFreehandPathD", () => {
  it("returns an empty string for fewer than 2 points", () => {
    expect(buildFreehandPathD([])).toBe("");
    expect(buildFreehandPathD([{ x: 1, y: 1 }])).toBe("");
  });

  it("builds an M-then-L polyline through every point", () => {
    expect(
      buildFreehandPathD([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M 0 0 L 5 5 L 10 0");
  });
});

describe("translateAnnotation", () => {
  it("moves a freehand path's every point", () => {
    const a: DesignAnnotation = {
      id: "f1",
      kind: "freehand",
      color: "#4338ca",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    };
    expect(translateAnnotation(a, 5, -5)).toEqual({
      id: "f1",
      kind: "freehand",
      color: "#4338ca",
      points: [
        { x: 5, y: -5 },
        { x: 15, y: 5 },
      ],
    });
  });

  it("moves a rectangle's x/y, leaving width/height untouched", () => {
    const a: DesignAnnotation = { id: "r1", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 40, height: 20 };
    expect(translateAnnotation(a, 10, 10)).toEqual({ id: "r1", kind: "rectangle", color: "#dc2626", x: 10, y: 10, width: 40, height: 20 });
  });

  it("moves an arrow's both endpoints", () => {
    const a: DesignAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(translateAnnotation(a, 2, 3)).toEqual({ id: "a1", kind: "arrow", color: "#16a34a", x1: 2, y1: 3, x2: 12, y2: 13 });
  });

  it("moves a text annotation's x/y, leaving its text untouched", () => {
    const a: DesignAnnotation = { id: "t1", kind: "text", color: "#0891b2", x: 0, y: 0, text: "note" };
    expect(translateAnnotation(a, 1, 1)).toEqual({ id: "t1", kind: "text", color: "#0891b2", x: 1, y: 1, text: "note" });
  });
});

describe("annotationBounds", () => {
  it("wraps every point of a freehand stroke, including ones left/above the start", () => {
    const a: DesignAnnotation = {
      id: "f1",
      kind: "freehand",
      color: "#4338ca",
      points: [
        { x: 10, y: 10 },
        { x: -5, y: 40 },
        { x: 30, y: 0 },
      ],
    };
    expect(annotationBounds(a)).toEqual({ x: -5, y: 0, width: 35, height: 40 });
  });

  it("returns a rectangle's own geometry unchanged", () => {
    const a: DesignAnnotation = { id: "r1", kind: "rectangle", color: "#dc2626", x: 4, y: 8, width: 40, height: 20 };
    expect(annotationBounds(a)).toEqual({ x: 4, y: 8, width: 40, height: 20 });
  });

  it("normalizes an arrow drawn right-to-left into a positive-size box", () => {
    const a: DesignAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: 100, y1: 50, x2: 20, y2: 10 };
    expect(annotationBounds(a)).toEqual({ x: 20, y: 10, width: 80, height: 40 });
  });

  it("grows a text box by line count and keeps it within the wrap width", () => {
    const oneLine = annotationBounds({ id: "t1", kind: "text", color: "#0891b2", x: 0, y: 0, text: "hi" });
    const twoLines = annotationBounds({ id: "t2", kind: "text", color: "#0891b2", x: 0, y: 0, text: "hi\nthere" });
    expect(twoLines.height).toBeGreaterThan(oneLine.height);
    expect(annotationBounds({ id: "t3", kind: "text", color: "#0891b2", x: 0, y: 0, text: "x".repeat(500) }).width).toBeLessThanOrEqual(
      220,
    );
  });
});

describe("resizeHandlePoint", () => {
  it("maps each corner name to that corner of the box", () => {
    const box = { x: 10, y: 20, width: 100, height: 50 };
    expect(resizeHandlePoint(box, "nw")).toEqual({ x: 10, y: 20 });
    expect(resizeHandlePoint(box, "ne")).toEqual({ x: 110, y: 20 });
    expect(resizeHandlePoint(box, "se")).toEqual({ x: 110, y: 70 });
    expect(resizeHandlePoint(box, "sw")).toEqual({ x: 10, y: 70 });
  });
});

describe("resizeBounds", () => {
  const box = { x: 0, y: 0, width: 100, height: 100 };

  it("moves only the dragged corner, pinning the opposite one", () => {
    expect(resizeBounds(box, "se", { x: 140, y: 60 })).toEqual({ x: 0, y: 0, width: 140, height: 60 });
    expect(resizeBounds(box, "nw", { x: 20, y: 30 })).toEqual({ x: 20, y: 30, width: 80, height: 70 });
  });

  it("clamps instead of inverting when dragged past the anchored corner", () => {
    const collapsed = resizeBounds(box, "se", { x: -200, y: -200 });
    expect(collapsed).toEqual({ x: 0, y: 0, width: MIN_SHAPE_SIZE, height: MIN_SHAPE_SIZE });
    const flipped = resizeBounds(box, "nw", { x: 500, y: 500 });
    expect(flipped.width).toBe(MIN_SHAPE_SIZE);
    expect(flipped.height).toBe(MIN_SHAPE_SIZE);
    expect(flipped.x).toBe(100 - MIN_SHAPE_SIZE);
  });
});

describe("scaleAnnotationToBounds", () => {
  const from = { x: 0, y: 0, width: 100, height: 100 };
  const to = { x: 10, y: 10, width: 200, height: 50 };

  it("scales a rectangle's origin and size into the new box", () => {
    const a: DesignAnnotation = { id: "r1", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 100, height: 100 };
    expect(scaleAnnotationToBounds(a, from, to)).toEqual({ id: "r1", kind: "rectangle", color: "#dc2626", ...to });
  });

  it("scales a freehand stroke's every point, keeping their relative layout", () => {
    const a: DesignAnnotation = {
      id: "f1",
      kind: "freehand",
      color: "#4338ca",
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
      ],
    };
    const scaled = scaleAnnotationToBounds(a, from, to);
    expect(scaled.kind === "freehand" && scaled.points).toEqual([
      { x: 10, y: 10 },
      { x: 110, y: 60 },
    ]);
  });

  it("scales an arrow's both endpoints", () => {
    const a: DesignAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: 0, y1: 100, x2: 100, y2: 0 };
    expect(scaleAnnotationToBounds(a, from, to)).toEqual({ id: "a1", kind: "arrow", color: "#16a34a", x1: 10, y1: 60, x2: 210, y2: 10 });
  });

  it("only repositions text — its size comes from the font, not from stored dimensions", () => {
    const a: DesignAnnotation = { id: "t1", kind: "text", color: "#0891b2", x: 0, y: 0, text: "note" };
    expect(scaleAnnotationToBounds(a, from, to)).toEqual({ id: "t1", kind: "text", color: "#0891b2", x: 10, y: 10, text: "note" });
  });

  it("leaves a zero-width/height source box (a flat arrow) alone instead of dividing by zero", () => {
    const a: DesignAnnotation = { id: "a2", kind: "arrow", color: "#16a34a", x1: 0, y1: 0, x2: 100, y2: 0 };
    const flat = { x: 0, y: 0, width: 100, height: 0 };
    const scaled = scaleAnnotationToBounds(a, flat, { x: 0, y: 0, width: 50, height: 0 });
    expect(scaled).toEqual({ id: "a2", kind: "arrow", color: "#16a34a", x1: 0, y1: 0, x2: 50, y2: 0 });
  });
});

describe("rotatePoint", () => {
  it("turns a point a quarter clockwise about the center (SVG's y-down frame)", () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("round-trips through the negated angle — the inverse a rotated resize relies on", () => {
    const center = { x: 25, y: 40 };
    const original = { x: 100, y: -12 };
    const back = rotatePoint(rotatePoint(original, center, 37), center, -37);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });
});

describe("normalizeAngle", () => {
  it("wraps into [0, 360)", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
  });
});

describe("angleFromCenter", () => {
  it("reads a pointer straight above the center as 0°, and quarter turns clockwise from there", () => {
    const center = { x: 0, y: 0 };
    expect(angleFromCenter(center, { x: 0, y: -10 })).toBeCloseTo(0);
    expect(angleFromCenter(center, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(angleFromCenter(center, { x: 0, y: 10 })).toBeCloseTo(180);
  });
});

describe("rotationTransform", () => {
  it("is undefined for an unrotated annotation, so no transform attribute is emitted at all", () => {
    expect(rotationTransform({ id: "r1", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 40, height: 20 })).toBeUndefined();
  });

  it("turns about the annotation's own box center", () => {
    const a: DesignAnnotation = { id: "r1", kind: "rectangle", color: "#dc2626", x: 0, y: 0, width: 40, height: 20, rotation: 45 };
    expect(rotationTransform(a)).toBe("rotate(45 20 10)");
  });
});

describe("findBindTarget", () => {
  const nodes: BindableNode[] = [
    { id: "a", x: 0, y: 0, width: 100, height: 50 },
    { id: "b", x: 400, y: 0, width: 100, height: 50 },
  ];

  it("binds to a node the point is inside", () => {
    expect(findBindTarget({ x: 50, y: 25 }, nodes)).toBe("a");
  });

  it("still binds just outside the border, but not far away", () => {
    expect(findBindTarget({ x: -10, y: 25 }, nodes)).toBe("a");
    expect(findBindTarget({ x: -200, y: 25 }, nodes)).toBeNull();
  });

  it("picks the nearest center when two snap zones overlap", () => {
    const overlapping: BindableNode[] = [
      { id: "left", x: 0, y: 0, width: 100, height: 50 },
      { id: "right", x: 110, y: 0, width: 100, height: 50 },
    ];
    expect(findBindTarget({ x: 108, y: 25 }, overlapping)).toBe("right");
  });
});

describe("anchorPointOnNode", () => {
  const node: BindableNode = { id: "a", x: 0, y: 0, width: 100, height: 100 };

  it("lands on the side facing the other end, just outside the border", () => {
    const right = anchorPointOnNode(node, { x: 500, y: 50 });
    expect(right.y).toBeCloseTo(50);
    expect(right.x).toBeGreaterThan(100);

    const above = anchorPointOnNode(node, { x: 50, y: -500 });
    expect(above.x).toBeCloseTo(50);
    expect(above.y).toBeLessThan(0);
  });

  it("falls back to the center when the target sits exactly on it (no direction to project)", () => {
    expect(anchorPointOnNode(node, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
  });
});

describe("applyArrowBindings", () => {
  const nodes = new Map<string, BindableNode>([
    ["a", { id: "a", x: 0, y: 0, width: 100, height: 100 }],
    ["b", { id: "b", x: 400, y: 0, width: 100, height: 100 }],
  ]);

  it("returns the very same object for an unbound arrow, so the caller can skip the state update", () => {
    const arrow: DesignArrowAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(applyArrowBindings(arrow, nodes)).toBe(arrow);
  });

  it("pulls a bound end onto its node's border, facing the other end", () => {
    const arrow: DesignArrowAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: -300, y1: 50, x2: 300, y2: 50, startNodeId: "a" };
    const bound = applyArrowBindings(arrow, nodes);
    expect(bound.x1).toBeGreaterThan(100);
    expect(bound.y1).toBeCloseTo(50);
    // The free end is left exactly where the user put it.
    expect(bound.x2).toBe(300);
  });

  it("faces both ends at each other when both are bound", () => {
    const arrow: DesignArrowAnnotation = {
      id: "a1",
      kind: "arrow",
      color: "#16a34a",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      startNodeId: "a",
      endNodeId: "b",
    };
    const bound = applyArrowBindings(arrow, nodes);
    expect(bound.x1).toBeGreaterThan(100);
    expect(bound.x2).toBeLessThan(400);
    expect(bound.y1).toBeCloseTo(50);
    expect(bound.y2).toBeCloseTo(50);
  });

  it("drops a binding whose node has been deleted, leaving the arrow where it was", () => {
    const arrow: DesignArrowAnnotation = { id: "a1", kind: "arrow", color: "#16a34a", x1: 5, y1: 5, x2: 20, y2: 20, startNodeId: "gone" };
    const bound = applyArrowBindings(arrow, nodes);
    expect(bound.startNodeId).toBeUndefined();
    expect(bound).toMatchObject({ x1: 5, y1: 5, x2: 20, y2: 20 });
  });
});

describe("colorMarkerKey", () => {
  it("strips the leading #", () => {
    expect(colorMarkerKey("#4338ca")).toBe("4338ca");
  });
});

describe("nextAnnotationId", () => {
  it("returns a unique, kind-prefixed id on every call", () => {
    const a = nextAnnotationId("rectangle");
    const b = nextAnnotationId("rectangle");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^rectangle-/);
  });
});

describe("isDrawTool", () => {
  it("is false for 'select', true for every annotation kind", () => {
    expect(isDrawTool("select")).toBe(false);
    expect(isDrawTool("freehand")).toBe(true);
    expect(isDrawTool("text")).toBe(true);
  });
});

describe("ANNOTATION_COLORS", () => {
  it("is a non-empty palette of valid 6-digit hex colors", () => {
    expect(ANNOTATION_COLORS.length).toBeGreaterThan(0);
    for (const c of ANNOTATION_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
