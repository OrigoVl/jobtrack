import { describe, expect, it } from "vitest";
import {
  ANNOTATION_COLORS,
  buildFreehandPathD,
  colorMarkerKey,
  isDrawTool,
  nextAnnotationId,
  normalizeRect,
  translateAnnotation,
} from "./design-annotations";
import type { DesignAnnotation } from "./types";

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
