import type { DesignNodeKind } from "./types";

export interface DesignPatternNode {
  kind: DesignNodeKind;
  /** design.json's "patterns.labels.<labelKey>" — omitted means fall back to the kind's own
   * generic label (designNodeKindLabel), the same default a plain single-node drop gets. Only
   * needed when a pattern has two nodes of the same kind (e.g. two services) that need
   * distinguishing labels. */
  labelKey?: string;
  dx: number;
  dy: number;
}

export interface DesignPatternEdge {
  from: number;
  to: number;
}

export interface DesignPattern {
  id: string;
  labelKey: string;
  nodes: DesignPatternNode[];
  edges: DesignPatternEdge[];
}

export const DESIGN_PATTERNS: DesignPattern[] = [
  {
    id: "load-balanced-web-tier",
    labelKey: "loadBalancedWebTier",
    nodes: [
      { kind: "client", dx: 0, dy: 60 },
      { kind: "loadBalancer", dx: 200, dy: 60 },
      { kind: "service", labelKey: "api1", dx: 400, dy: 0 },
      { kind: "service", labelKey: "api2", dx: 400, dy: 130 },
      { kind: "database", dx: 600, dy: 60 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 4 },
      { from: 3, to: 4 },
    ],
  },
  {
    id: "pub-sub-pipeline",
    labelKey: "pubSubPipeline",
    nodes: [
      { kind: "service", labelKey: "producer", dx: 0, dy: 0 },
      { kind: "queue", dx: 200, dy: 0 },
      { kind: "service", labelKey: "consumer", dx: 400, dy: 0 },
      { kind: "database", dx: 600, dy: 0 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ],
  },
  {
    id: "cached-api",
    labelKey: "cachedApi",
    nodes: [
      { kind: "client", dx: 0, dy: 60 },
      { kind: "service", dx: 200, dy: 60 },
      { kind: "cache", dx: 400, dy: 0 },
      { kind: "database", dx: 400, dy: 130 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
    ],
  },
];

export interface InstantiatedNode {
  id: string;
  kind: DesignNodeKind;
  label: string;
  x: number;
  y: number;
}
export interface InstantiatedEdge {
  id: string;
  source: string;
  target: string;
}

/** Pure — instantiates a pattern template at a drop position with fresh ids (an injected
 * generator, so tests don't depend on crypto.randomUUID()). `resolveLabel` turns each node's
 * kind/labelKey into display text — kept out of this module so it stays i18n-free and trivially
 * unit-testable, same split as design-node-kinds.ts's data vs. designNodeKindLabel(). */
export function instantiatePattern(
  pattern: DesignPattern,
  origin: { x: number; y: number },
  makeId: () => string,
  resolveLabel: (node: DesignPatternNode) => string,
): { nodes: InstantiatedNode[]; edges: InstantiatedEdge[] } {
  const ids = pattern.nodes.map(() => makeId());
  const nodes: InstantiatedNode[] = pattern.nodes.map((n, i) => ({
    id: ids[i]!,
    kind: n.kind,
    label: resolveLabel(n),
    x: origin.x + n.dx,
    y: origin.y + n.dy,
  }));
  const edges: InstantiatedEdge[] = pattern.edges.map((e, i) => ({
    id: `pattern-edge-${ids[e.from]}-${ids[e.to]}-${i}`,
    source: ids[e.from]!,
    target: ids[e.to]!,
  }));
  return { nodes, edges };
}
