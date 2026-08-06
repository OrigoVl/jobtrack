import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Chip } from "../../shared/ui";
import { DESIGN_NODE_ICON, DESIGN_NODE_TONE, designNodeIconClass, designNodeKindLabel } from "../../shared/design-node-kinds";
import type { DesignNodeKind } from "../../shared/types";

export interface DesignNodeData extends Record<string, unknown> {
  kind: DesignNodeKind;
  label: string;
}

// Simplified handle layout (left=target, right=source only, not one pair per side) — a diagram
// arranged left-to-right covers the vast majority of system-design sketches, and this keeps the
// node visually calm instead of 8 tiny dots. Styled with existing tokens (Card-like), not a new
// visual language — see shared/design-node-kinds.ts for the kind->Chip-tone mapping.
export function DesignNode({ data, selected }: NodeProps & { data: DesignNodeData }) {
  const Icon = DESIGN_NODE_ICON[data.kind];
  return (
    <div
      className={`min-w-[140px] rounded-xl border bg-surface px-3 py-2 shadow-sm ${selected ? "border-signal ring-2 ring-signal/30" : "border-grid"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-dim !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${designNodeIconClass(data.kind)}`} />
        <div className="text-sm font-semibold text-ink truncate">{data.label || designNodeKindLabel(data.kind)}</div>
      </div>
      <Chip tone={DESIGN_NODE_TONE[data.kind]}>{designNodeKindLabel(data.kind)}</Chip>
      <Handle type="source" position={Position.Right} className="!bg-ink-dim !w-2 !h-2" />
    </div>
  );
}
