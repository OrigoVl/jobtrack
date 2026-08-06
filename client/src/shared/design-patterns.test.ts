import { describe, expect, it } from "vitest";
import { instantiatePattern, DESIGN_PATTERNS, type DesignPattern } from "./design-patterns";

const pattern: DesignPattern = {
  id: "test-pattern",
  labelKey: "test",
  nodes: [
    { kind: "client", dx: 0, dy: 0 },
    { kind: "service", labelKey: "api1", dx: 100, dy: 0 },
  ],
  edges: [{ from: 0, to: 1 }],
};

function makeIdGenerator() {
  let n = 0;
  return () => `id-${n++}`;
}

describe("instantiatePattern", () => {
  it("offsets every node's position by the given origin", () => {
    const { nodes } = instantiatePattern(pattern, { x: 50, y: 20 }, makeIdGenerator(), (n) => n.kind);
    expect(nodes[0]).toMatchObject({ x: 50, y: 20 });
    expect(nodes[1]).toMatchObject({ x: 150, y: 20 });
  });

  it("assigns a fresh id per node using the injected generator", () => {
    const { nodes } = instantiatePattern(pattern, { x: 0, y: 0 }, makeIdGenerator(), (n) => n.kind);
    expect(nodes.map((n) => n.id)).toEqual(["id-0", "id-1"]);
  });

  it("resolves each node's label via the given callback", () => {
    const { nodes } = instantiatePattern(pattern, { x: 0, y: 0 }, makeIdGenerator(), (n) => n.labelKey ?? n.kind);
    expect(nodes.map((n) => n.label)).toEqual(["client", "api1"]);
  });

  it("edges reference the generated node ids, not the template indices", () => {
    const { nodes, edges } = instantiatePattern(pattern, { x: 0, y: 0 }, makeIdGenerator(), (n) => n.kind);
    expect(edges).toEqual([{ id: expect.any(String), source: nodes[0]!.id, target: nodes[1]!.id }]);
  });

  it("every shipped pattern's edges only reference valid node indices", () => {
    for (const p of DESIGN_PATTERNS) {
      for (const e of p.edges) {
        expect(e.from).toBeGreaterThanOrEqual(0);
        expect(e.from).toBeLessThan(p.nodes.length);
        expect(e.to).toBeGreaterThanOrEqual(0);
        expect(e.to).toBeLessThan(p.nodes.length);
      }
    }
  });
});
