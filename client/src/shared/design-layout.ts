import type { DesignDiagram, DesignEdge, DesignNode, DesignNodeKind, DesignReferenceEdge, DesignReferenceNode } from "./types";

// Deterministic left-to-right column order for the AI's suggested reference solution — the LLM
// isn't asked for x/y (unreliable), so this lays out its {kind, label} nodes the same way a
// system-design diagram is conventionally read: entry point first, data stores last.
const COLUMN_ORDER: DesignNodeKind[] = [
  "client",
  "loadBalancer",
  "service",
  "cache",
  "queue",
  "database",
  "storage",
  "cdn",
  "thirdParty",
  "generic",
];
const COLUMN_GAP = 220;
const ROW_GAP = 90;

function columnIndex(kind: DesignNodeKind): number {
  const i = COLUMN_ORDER.indexOf(kind);
  return i === -1 ? COLUMN_ORDER.length - 1 : i;
}

/** Pure — turns the AI's label-only reference nodes/edges into a positioned DesignDiagram
 * (same shape DesignCanvas already renders). An edge whose from/to label doesn't match any node
 * is dropped rather than thrown — the model restating a label slightly differently between the
 * two arrays shouldn't break the whole reference view. */
export function layoutReference(nodes: DesignReferenceNode[], edges: DesignReferenceEdge[]): DesignDiagram {
  const rowByColumn: Record<number, number> = {};
  const idByLabel = new Map<string, string>();
  const diagramNodes: DesignNode[] = nodes.map((n, i) => {
    const col = columnIndex(n.kind);
    const row = rowByColumn[col] ?? 0;
    rowByColumn[col] = row + 1;
    const id = `ref-${i}`;
    idByLabel.set(n.label, id);
    return { id, kind: n.kind, label: n.label, x: col * COLUMN_GAP, y: row * ROW_GAP };
  });
  const diagramEdges: DesignEdge[] = [];
  edges.forEach((e, i) => {
    const source = idByLabel.get(e.from);
    const target = idByLabel.get(e.to);
    if (source && target) diagramEdges.push({ id: `ref-edge-${i}`, source, target });
  });
  return { nodes: diagramNodes, edges: diagramEdges };
}
