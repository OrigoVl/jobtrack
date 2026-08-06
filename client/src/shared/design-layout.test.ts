import { describe, expect, it } from "vitest";
import { layoutReference } from "./design-layout";

describe("layoutReference", () => {
  it("assigns increasing x by kind's column order (client before service before database)", () => {
    const { nodes } = layoutReference(
      [
        { kind: "database", label: "DB" },
        { kind: "client", label: "Client" },
        { kind: "service", label: "API" },
      ],
      [],
    );
    const x = (label: string) => nodes.find((n) => n.label === label)!.x;
    expect(x("Client")).toBeLessThan(x("API"));
    expect(x("API")).toBeLessThan(x("DB"));
  });

  it("stacks two nodes of the same kind in the same column at different rows", () => {
    const { nodes } = layoutReference(
      [
        { kind: "service", label: "API 1" },
        { kind: "service", label: "API 2" },
      ],
      [],
    );
    expect(nodes[0]!.x).toBe(nodes[1]!.x);
    expect(nodes[0]!.y).not.toBe(nodes[1]!.y);
  });

  it("resolves edges by label to the generated node ids", () => {
    const { nodes, edges } = layoutReference(
      [
        { kind: "client", label: "Client" },
        { kind: "service", label: "API" },
      ],
      [{ from: "Client", to: "API" }],
    );
    const client = nodes.find((n) => n.label === "Client")!;
    const api = nodes.find((n) => n.label === "API")!;
    expect(edges).toEqual([{ id: "ref-edge-0", source: client.id, target: api.id }]);
  });

  it("drops an edge whose label doesn't match any node, instead of throwing", () => {
    const { edges } = layoutReference([{ kind: "client", label: "Client" }], [{ from: "Client", to: "Nonexistent" }]);
    expect(edges).toEqual([]);
  });

  it("falls back an unknown kind to the last column, without throwing", () => {
    const { nodes } = layoutReference([{ kind: "generic", label: "Box" }], []);
    expect(nodes).toHaveLength(1);
  });
});
