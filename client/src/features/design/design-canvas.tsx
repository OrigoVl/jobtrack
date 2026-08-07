import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { Segmented } from "../../shared/ui";
import { useTheme } from "../../shared/theme";
import {
  ArrowToolIcon,
  CursorIcon,
  EllipseToolIcon,
  ExpandIcon,
  LayersIcon,
  PencilIcon,
  RectangleToolIcon,
  TrashIcon,
  TypeIcon,
  type IconComponent,
} from "../../shared/icons";
import { DESIGN_NODE_ICON, DESIGN_NODE_KINDS, designNodeIconClass, designNodeKindLabel } from "../../shared/design-node-kinds";
import { DESIGN_PATTERNS, instantiatePattern, type DesignPattern, type DesignPatternNode } from "../../shared/design-patterns";
import {
  ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_COLOR,
  MIN_SHAPE_SIZE,
  RESIZE_HANDLES,
  anchorPointOnNode,
  angleFromCenter,
  annotationBounds,
  annotationCenter,
  applyArrowBindings,
  buildFreehandPathD,
  colorMarkerKey,
  findBindTarget,
  isDrawTool,
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
  type DesignDrawTool,
  type Rect,
  type ResizeHandle,
} from "../../shared/design-annotations";
import { DesignNode, type DesignNodeData } from "./design-node";
import type { DesignAnnotation, DesignDiagram, DesignNodeKind } from "../../shared/types";

const NODE_TYPES = { designNode: DesignNode };
// Backspace and Delete both remove the selected node(s)/edge(s) — React Flow's default is just
// Backspace; Delete is the more common expectation on Windows keyboards.
const DELETE_KEYS = ["Backspace", "Delete"];
// Only used for the single frame between dropping a node and React Flow measuring it — see
// bindableNodes below. Roughly a DesignNode card's rendered size, so an arrow bound on that frame
// doesn't visibly jump once the real measurement lands.
const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 70;

// design-patterns.ts's labelKey fields are plain runtime strings (kept i18n-free there — see that
// file's own comment) — these Records re-attach them to LITERAL i18next keys (small, closed sets)
// so t() stays statically checked, same convention as fit-tone.ts's Record-based lookup rather
// than status-labels.ts's runtime-template escape hatch (that one's needed only for an open-ended
// union; these are fixed at authoring time).
const PATTERN_NAME_KEY: Record<DesignPattern["id"], "patterns.loadBalancedWebTier" | "patterns.pubSubPipeline" | "patterns.cachedApi"> = {
  "load-balanced-web-tier": "patterns.loadBalancedWebTier",
  "pub-sub-pipeline": "patterns.pubSubPipeline",
  "cached-api": "patterns.cachedApi",
};
const PATTERN_NODE_LABEL_KEY: Record<
  string,
  "patterns.labels.api1" | "patterns.labels.api2" | "patterns.labels.producer" | "patterns.labels.consumer"
> = {
  api1: "patterns.labels.api1",
  api2: "patterns.labels.api2",
  producer: "patterns.labels.producer",
  consumer: "patterns.labels.consumer",
};
const TOOL_KEY: Record<
  DesignDrawTool,
  | "canvas.tools.select"
  | "canvas.tools.freehand"
  | "canvas.tools.rectangle"
  | "canvas.tools.ellipse"
  | "canvas.tools.arrow"
  | "canvas.tools.text"
> = {
  select: "canvas.tools.select",
  freehand: "canvas.tools.freehand",
  rectangle: "canvas.tools.rectangle",
  ellipse: "canvas.tools.ellipse",
  arrow: "canvas.tools.arrow",
  text: "canvas.tools.text",
};
const TOOL_ORDER: DesignDrawTool[] = ["select", "freehand", "rectangle", "ellipse", "arrow", "text"];
const TOOL_ICON: Record<DesignDrawTool, IconComponent> = {
  select: CursorIcon,
  freehand: PencilIcon,
  rectangle: RectangleToolIcon,
  ellipse: EllipseToolIcon,
  arrow: ArrowToolIcon,
  text: TypeIcon,
};

function toFlowNodes(diagram: DesignDiagram): Node<DesignNodeData>[] {
  return diagram.nodes.map((n) => ({ id: n.id, type: "designNode", position: { x: n.x, y: n.y }, data: { kind: n.kind, label: n.label } }));
}
function toFlowEdges(diagram: DesignDiagram): Edge[] {
  return diagram.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label }));
}
function fromFlow(nodes: Node<DesignNodeData>[], edges: Edge[], annotations: DesignAnnotation[]): DesignDiagram {
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label, x: n.position.x, y: n.position.y })),
    edges: edges.map((e) =>
      e.label ? { id: e.id, source: e.source, target: e.target, label: String(e.label) } : { id: e.id, source: e.source, target: e.target },
    ),
    annotations,
  };
}

function PaletteItem({ kind }: { kind: DesignNodeKind }) {
  const Icon = DESIGN_NODE_ICON[kind];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-design-node-kind", kind);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing select-none flex items-center gap-2 text-sm font-medium text-ink bg-surface-2 border border-grid rounded-lg px-2.5 py-1.5 transition hover:border-signal/40 hover:-translate-y-px"
    >
      <Icon className={`h-4 w-4 shrink-0 ${designNodeIconClass(kind)}`} />
      <span className="truncate">{designNodeKindLabel(kind)}</span>
    </div>
  );
}

function PatternPaletteItem({ pattern }: { pattern: DesignPattern }) {
  const { t } = useTranslation("design");
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-design-pattern-id", pattern.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing select-none flex items-center gap-2 text-xs font-medium text-ink-dim bg-surface-2 border border-dashed border-grid rounded-lg px-2.5 py-1.5 transition hover:border-signal/40 hover:text-ink hover:-translate-y-px"
    >
      <LayersIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{t(PATTERN_NAME_KEY[pattern.id])}</span>
    </div>
  );
}

/** A draft shape/stroke still being dragged out, before it's committed as a real DesignAnnotation
 * on pointer-up. Text has no draft — it commits immediately on click (see AnnotationLayer's
 * onPointerDown). */
type ArrowEndpoint = "start" | "end";
const ARROW_ENDPOINTS: ArrowEndpoint[] = ["start", "end"];

type AnnotationDraft =
  | { kind: "freehand"; points: { x: number; y: number }[] }
  | { kind: "rectangle" | "ellipse"; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "arrow"; start: { x: number; y: number }; current: { x: number; y: number } };

function AnnotationShape({
  annotation,
  interactive,
  isEditing,
  onSelectAndDrag,
  onEnterEdit,
  onCommitText,
}: {
  annotation: DesignAnnotation;
  interactive: boolean;
  isEditing: boolean;
  onSelectAndDrag: (id: string, e: React.PointerEvent) => void;
  onEnterEdit: (id: string) => void;
  onCommitText: (id: string, text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focusing a just-created text annotation has to wait a frame. The annotation is created in the
  // layer's pointerdown handler, which React flushes synchronously — so a focus() issued during
  // that render lands BEFORE the browser runs the pointerdown's own default action, which moves
  // focus to the document body. The textarea would blur immediately, and the blur handler commits
  // the (still empty) text by deleting the annotation — i.e. clicking with the text tool appeared
  // to do nothing at all. A rAF puts the focus after that default action instead.
  useEffect(() => {
    if (!isEditing) return;
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isEditing]);

  const pointerProps = interactive
    ? { style: { cursor: "move" }, onPointerDown: (e: React.PointerEvent) => onSelectAndDrag(annotation.id, e) }
    : {};

  switch (annotation.kind) {
    case "freehand":
      return (
        <path
          d={buildFreehandPathD(annotation.points)}
          stroke={annotation.color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents={interactive ? "stroke" : "none"}
          {...pointerProps}
        />
      );
    case "rectangle":
      return (
        <rect
          x={annotation.x}
          y={annotation.y}
          width={annotation.width}
          height={annotation.height}
          rx={4}
          stroke={annotation.color}
          strokeWidth={2}
          fill="none"
          pointerEvents={interactive ? "stroke" : "none"}
          {...pointerProps}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={annotation.x + annotation.width / 2}
          cy={annotation.y + annotation.height / 2}
          rx={Math.max(annotation.width / 2, 1)}
          ry={Math.max(annotation.height / 2, 1)}
          stroke={annotation.color}
          strokeWidth={2}
          fill="none"
          pointerEvents={interactive ? "stroke" : "none"}
          {...pointerProps}
        />
      );
    case "arrow":
      return (
        <line
          x1={annotation.x1}
          y1={annotation.y1}
          x2={annotation.x2}
          y2={annotation.y2}
          stroke={annotation.color}
          strokeWidth={2.5}
          markerEnd={`url(#design-arrowhead-${colorMarkerKey(annotation.color)})`}
          pointerEvents={interactive ? "stroke" : "none"}
          {...pointerProps}
        />
      );
    case "text":
      // Unlike the SVG shapes above (each sets its own pointerEvents), HTML inside a foreignObject
      // inherits pointer-events from AnnotationLayer's Panel — which is "none" for every non-draw
      // tool. Creating a text annotation switches the tool straight back to "select", so without an
      // explicit override the fresh textarea is unclickable and a click aimed at it lands on the
      // pane beneath, blurring it into an empty-string commit that deletes the annotation again.
      // Re-enabled on the interactive children only (never on the foreignObject box itself, whose
      // 220x90 area would otherwise swallow clicks on nodes underneath), and the label is
      // inline-block so its hit area is the text, not a full-width strip.
      return (
        <foreignObject x={annotation.x} y={annotation.y} width={220} height={90} style={{ overflow: "visible" }} pointerEvents="none">
          {isEditing ? (
            <textarea
              defaultValue={annotation.text}
              ref={textareaRef}
              onBlur={(e) => onCommitText(annotation.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              className="w-full h-16 bg-surface border border-signal rounded p-1 text-sm resize-none focus:outline-none"
              style={{ color: annotation.color, pointerEvents: "auto" }}
            />
          ) : (
            <div
              onPointerDown={interactive ? (e) => onSelectAndDrag(annotation.id, e) : undefined}
              onDoubleClick={() => onEnterEdit(annotation.id)}
              className="inline-block text-sm font-medium select-none whitespace-pre-wrap"
              style={{ color: annotation.color, cursor: interactive ? "move" : "default", pointerEvents: interactive ? "auto" : "none" }}
            >
              {annotation.text || <em className="opacity-50">…</em>}
            </div>
          )}
        </foreignObject>
      );
  }
}

// Screen-pixel sizes for the selection chrome. Everything drawn inside the viewport-transformed <g>
// is in flow coordinates, so each of these is divided by the current zoom to keep the outline hairline
// and the handles grabbable at any zoom level — the same trick as SVG's `vector-effect`, applied to
// handle geometry too (which `vector-effect` can't cover, since it only scales strokes).
const HANDLE_SIZE = 9;
const SELECTION_PADDING = 6;
/** How far above the box's top edge the rotate handle floats — same idea as Excalidraw's ◯. */
const ROTATE_HANDLE_OFFSET = 22;
const HANDLE_CURSOR: Record<ResizeHandle, string> = { nw: "nwse-resize", ne: "nesw-resize", se: "nwse-resize", sw: "nesw-resize" };

/** Excalidraw-style selection chrome for the active annotation. What it offers depends on the kind:
 * an arrow gets a round grip on each ENDPOINT (dragging one end is what reshaping an arrow means —
 * corner handles would be a clumsy proxy for that, and rotation is redundant once both ends move
 * freely), everything else gets four corner handles plus a rotate grip above the box. Text gets
 * neither resize (its size is the font's) nor endpoints — just the outline and the rotate grip.
 * Purely an overlay: it never wraps the shape, so it can't interfere with the shape's own hit
 * area, and it renders after every annotation so the grips stay on top. */
function SelectionBox({
  annotation,
  bounds,
  zoom,
  onResizeStart,
  onRotateStart,
  onEndpointStart,
}: {
  annotation: DesignAnnotation;
  bounds: Rect;
  zoom: number;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  onEndpointStart: (end: ArrowEndpoint, e: React.PointerEvent) => void;
}) {
  const pad = SELECTION_PADDING / zoom;
  const stroke = 1 / zoom;
  const box: Rect = { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
  const size = HANDLE_SIZE / zoom;
  const isArrow = annotation.kind === "arrow";
  const resizable = annotation.kind !== "text" && !isArrow;
  const rotateAnchor = { x: box.x + box.width / 2, y: box.y - ROTATE_HANDLE_OFFSET / zoom };
  return (
    <g transform={rotationTransform(annotation)}>
      <rect
        {...box}
        fill="none"
        stroke="rgb(var(--signal))"
        strokeWidth={stroke}
        strokeDasharray={`${4 / zoom} ${3 / zoom}`}
        pointerEvents="none"
      />
      {resizable &&
        RESIZE_HANDLES.map((handle) => {
          const point = resizeHandlePoint(box, handle);
          return (
            <rect
              key={handle}
              x={point.x - size / 2}
              y={point.y - size / 2}
              width={size}
              height={size}
              rx={stroke}
              fill="rgb(var(--surface))"
              stroke="rgb(var(--signal))"
              strokeWidth={stroke * 1.5}
              style={{ cursor: HANDLE_CURSOR[handle] }}
              pointerEvents="all"
              onPointerDown={(e) => onResizeStart(handle, e)}
            />
          );
        })}
      {!isArrow && (
        <>
          <line
            x1={box.x + box.width / 2}
            y1={box.y}
            x2={rotateAnchor.x}
            y2={rotateAnchor.y}
            stroke="rgb(var(--signal))"
            strokeWidth={stroke}
            pointerEvents="none"
          />
          <circle
            cx={rotateAnchor.x}
            cy={rotateAnchor.y}
            r={size / 1.6}
            fill="rgb(var(--surface))"
            stroke="rgb(var(--signal))"
            strokeWidth={stroke * 1.5}
            style={{ cursor: "grab" }}
            pointerEvents="all"
            onPointerDown={onRotateStart}
          />
        </>
      )}
      {annotation.kind === "arrow" &&
        ARROW_ENDPOINTS.map((end) => (
          <circle
            key={end}
            cx={end === "start" ? annotation.x1 : annotation.x2}
            cy={end === "start" ? annotation.y1 : annotation.y2}
            r={size / 1.6}
            fill="rgb(var(--surface))"
            stroke="rgb(var(--signal))"
            strokeWidth={stroke * 1.5}
            style={{ cursor: "move" }}
            pointerEvents="all"
            onPointerDown={(e) => onEndpointStart(end, e)}
          />
        ))}
    </g>
  );
}

/** The freeform drawing layer — an SVG overlay transformed by the same pan/zoom viewport as the
 * node/edge graph beneath it (see useViewport() below), so annotations stay put relative to the
 * diagram instead of the screen. Rendered inside a full-size <Panel> so it sits in the same
 * coordinate space @xyflow/react itself uses for nodes. Deliberately its own component (not inlined
 * in DesignCanvasInner) — it re-renders on every viewport change (pan/zoom), which the rest of the
 * canvas (palette, toolbar) doesn't need to. */
function AnnotationLayer({
  tool,
  color,
  annotations,
  setAnnotations,
  selectedId,
  setSelectedId,
  editingId,
  setEditingId,
  onToolUsed,
  bindableNodes,
}: {
  tool: DesignDrawTool;
  color: string;
  annotations: DesignAnnotation[];
  setAnnotations: (updater: (prev: DesignAnnotation[]) => DesignAnnotation[]) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onToolUsed: () => void;
  /** The diagram's nodes as plain boxes, for snapping arrow endpoints onto them. */
  bindableNodes: BindableNode[];
}) {
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const dragRef = useRef<{ id: string; lastFlow: { x: number; y: number } } | null>(null);
  // The annotation as it was when the resize drag started, plus its box then — every frame rescales
  // that snapshot rather than the previous frame's result (see scaleAnnotationToBounds' own note).
  const resizeRef = useRef<{ handle: ResizeHandle; from: Rect; original: DesignAnnotation } | null>(null);
  const rotateRef = useRef<{ id: string; center: { x: number; y: number }; startRotation: number; startAngle: number } | null>(null);
  const endpointRef = useRef<{ id: string; end: ArrowEndpoint } | null>(null);
  // The node an in-flight arrow-endpoint drag would bind to if released now — drawn as a highlight
  // so the snap is visible BEFORE letting go, rather than a surprise on pointer-up.
  const [bindCandidate, setBindCandidate] = useState<string | null>(null);

  const drawing = isDrawTool(tool);
  const selected = tool === "select" ? (annotations.find((a) => a.id === selectedId) ?? null) : null;
  const bindCandidateNode = bindCandidate ? (bindableNodes.find((n) => n.id === bindCandidate) ?? null) : null;

  const toFlow = useCallback(
    (e: { clientX: number; clientY: number }) => screenToFlowPosition({ x: e.clientX, y: e.clientY }),
    [screenToFlowPosition],
  );

  const onSelectAndDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelectedId(id);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      dragRef.current = { id, lastFlow: toFlow(e) };
    },
    [tool, setSelectedId, toFlow],
  );

  // Pointer capture on each grip keeps its drag alive when the cursor outruns the 9px target, and —
  // because captured events still bubble — the layer's own move/up handlers below stay the single
  // place every drag is tracked, exactly like onSelectAndDrag's move drag.
  const captureGrip = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onResizeStart = (handle: ResizeHandle, e: React.PointerEvent) => {
    if (!selected) return;
    captureGrip(e);
    resizeRef.current = { handle, from: annotationBounds(selected), original: selected };
  };

  const onRotateStart = (e: React.PointerEvent) => {
    if (!selected) return;
    captureGrip(e);
    const center = annotationCenter(selected);
    rotateRef.current = {
      id: selected.id,
      center,
      startRotation: selected.rotation ?? 0,
      // Anchoring to the angle the drag STARTED at (rather than snapping the shape to the pointer)
      // is what keeps the grip under the cursor instead of jumping a quarter turn on grab.
      startAngle: angleFromCenter(center, toFlow(e)),
    };
  };

  const onEndpointStart = (end: ArrowEndpoint, e: React.PointerEvent) => {
    if (!selected || selected.kind !== "arrow") return;
    captureGrip(e);
    endpointRef.current = { id: selected.id, end };
  };

  const onLayerPointerMove = (e: React.PointerEvent) => {
    if (endpointRef.current) {
      const { id, end } = endpointRef.current;
      const pt = toFlow(e);
      const target = findBindTarget(pt, bindableNodes);
      setBindCandidate(target);
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === id && a.kind === "arrow" ? (end === "start" ? { ...a, x1: pt.x, y1: pt.y } : { ...a, x2: pt.x, y2: pt.y }) : a,
        ),
      );
      return;
    }
    if (rotateRef.current) {
      const { id, center, startRotation, startAngle } = rotateRef.current;
      const delta = angleFromCenter(center, toFlow(e)) - startAngle;
      // Shift constrains to 15° steps, the same coarse-angle affordance Excalidraw offers.
      const next = e.shiftKey ? Math.round((startRotation + delta) / 15) * 15 : startRotation + delta;
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, rotation: normalizeAngle(next) } : a)));
      return;
    }
    if (resizeRef.current) {
      const { handle, from, original } = resizeRef.current;
      // A rotated shape stores axis-aligned geometry and is only DRAWN turned, so the pointer is
      // turned back into that frame (about the box center captured at drag start, which keeps the
      // mapping stable for the whole drag) before the plain, rotation-free resize math runs.
      const rotation = original.rotation ?? 0;
      const center = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const pt = rotation ? rotatePoint(toFlow(e), center, -rotation) : toFlow(e);
      const to = resizeBounds(from, handle, pt);
      setAnnotations((prev) => prev.map((a) => (a.id === original.id ? scaleAnnotationToBounds(original, from, to) : a)));
      return;
    }
    if (dragRef.current) {
      const pt = toFlow(e);
      const { id, lastFlow } = dragRef.current;
      const dx = pt.x - lastFlow.x;
      const dy = pt.y - lastFlow.y;
      setAnnotations((prev) => prev.map((a) => (a.id === id ? translateAnnotation(a, dx, dy) : a)));
      dragRef.current.lastFlow = pt;
      return;
    }
    if (!draft) return;
    const pt = toFlow(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === "freehand") return { ...d, points: [...d.points, pt] };
      return { ...d, current: pt };
    });
  };

  const onLayerPointerUp = () => {
    if (endpointRef.current) {
      const { id, end } = endpointRef.current;
      endpointRef.current = null;
      // Releasing over a node binds that end to it; releasing anywhere else clears the binding, so
      // dragging an endpoint off a node is how you detach it — no separate unbind gesture.
      const nodeId = bindCandidate;
      setBindCandidate(null);
      setAnnotations((prev) =>
        prev.map((a) => {
          if (a.id !== id || a.kind !== "arrow") return a;
          const next = { ...a };
          const key = end === "start" ? "startNodeId" : "endNodeId";
          if (nodeId) next[key] = nodeId;
          else delete next[key];
          const node = nodeId ? bindableNodes.find((n) => n.id === nodeId) : undefined;
          if (!node) return next;
          const anchor = anchorPointOnNode(node, end === "start" ? { x: next.x2, y: next.y2 } : { x: next.x1, y: next.y1 });
          return end === "start" ? { ...next, x1: anchor.x, y1: anchor.y } : { ...next, x2: anchor.x, y2: anchor.y };
        }),
      );
      return;
    }
    if (rotateRef.current) {
      rotateRef.current = null;
      return;
    }
    if (resizeRef.current) {
      resizeRef.current = null;
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    if (!draft) return;
    if (draft.kind === "freehand") {
      if (draft.points.length >= 2) {
        setAnnotations((prev) => [...prev, { id: nextAnnotationId("freehand"), kind: "freehand", color, points: draft.points }]);
      }
    } else if (draft.kind === "arrow") {
      const dist = Math.hypot(draft.current.x - draft.start.x, draft.current.y - draft.start.y);
      if (dist >= MIN_SHAPE_SIZE) {
        setAnnotations((prev) => [
          ...prev,
          {
            id: nextAnnotationId("arrow"),
            kind: "arrow",
            color,
            x1: draft.start.x,
            y1: draft.start.y,
            x2: draft.current.x,
            y2: draft.current.y,
          },
        ]);
      }
    } else {
      const rect = normalizeRect(draft.start, draft.current);
      if (rect.width >= MIN_SHAPE_SIZE && rect.height >= MIN_SHAPE_SIZE) {
        setAnnotations((prev) => [...prev, { id: nextAnnotationId(draft.kind), kind: draft.kind, color, ...rect }]);
      }
    }
    setDraft(null);
    onToolUsed();
  };

  const onLayerPointerDown = (e: React.PointerEvent) => {
    if (!drawing) return;
    const pt = toFlow(e);
    if (tool === "text") {
      const id = nextAnnotationId("text");
      setAnnotations((prev) => [...prev, { id, kind: "text", color, x: pt.x, y: pt.y, text: "" }]);
      setEditingId(id);
      onToolUsed();
      return;
    }
    setDraft(tool === "freehand" ? { kind: "freehand", points: [pt] } : { kind: tool, start: pt, current: pt });
  };

  const commitText = (id: string, text: string) => {
    setEditingId(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } else {
      setAnnotations((prev) => prev.map((a) => (a.id === id && a.kind === "text" ? { ...a, text: trimmed } : a)));
    }
  };

  // Delete/Backspace removes the selected annotation — React Flow's own deleteKeyCode only knows
  // about its own nodes/edges, not this separate annotation layer, so it needs its own listener.
  // Skipped while focus is inside the text-editing textarea, so backspacing a character while
  // editing doesn't also delete the whole annotation.
  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, setAnnotations, setSelectedId]);

  return (
    <Panel
      position="top-left"
      style={{ margin: 0, top: 0, left: 0, width: "100%", height: "100%", pointerEvents: drawing ? "auto" : "none" }}
    >
      <svg
        width="100%"
        height="100%"
        style={{ cursor: drawing ? (tool === "text" ? "text" : "crosshair") : "default" }}
        onPointerDown={onLayerPointerDown}
        onPointerMove={onLayerPointerMove}
        onPointerUp={onLayerPointerUp}
      >
        <defs>
          {ANNOTATION_COLORS.map((c) => (
            <marker key={c} id={`design-arrowhead-${colorMarkerKey(c)}`} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill={c} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {/* The rotation lives on this wrapper rather than inside AnnotationShape: the stored
              geometry stays axis-aligned (so bounds/resize/binding math never has to deal with
              angles) and only the drawing is turned — and SVG hit-testing follows the transform,
              so a rotated shape still grabs where it LOOKS like it is. */}
          {annotations.map((a) => (
            <g key={a.id} transform={rotationTransform(a)}>
              <AnnotationShape
                annotation={a}
                interactive={tool === "select"}
                isEditing={editingId === a.id}
                onSelectAndDrag={onSelectAndDrag}
                onEnterEdit={setEditingId}
                onCommitText={commitText}
              />
            </g>
          ))}
          {bindCandidateNode && (
            <rect
              x={bindCandidateNode.x - 4}
              y={bindCandidateNode.y - 4}
              width={bindCandidateNode.width + 8}
              height={bindCandidateNode.height + 8}
              rx={10}
              fill="rgb(var(--signal) / 0.1)"
              stroke="rgb(var(--signal))"
              strokeWidth={1.5 / viewport.zoom}
              pointerEvents="none"
            />
          )}
          {selected && editingId !== selected.id && (
            <SelectionBox
              annotation={selected}
              bounds={annotationBounds(selected)}
              zoom={viewport.zoom}
              onResizeStart={onResizeStart}
              onRotateStart={onRotateStart}
              onEndpointStart={onEndpointStart}
            />
          )}
          {draft && (
            <g opacity={0.7} pointerEvents="none">
              {draft.kind === "freehand" && (
                <path d={buildFreehandPathD(draft.points)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              )}
              {draft.kind === "rectangle" && (
                <rect {...normalizeRect(draft.start, draft.current)} stroke={color} strokeWidth={2} fill="none" strokeDasharray="4 3" />
              )}
              {draft.kind === "ellipse" && (
                <ellipse
                  cx={(draft.start.x + draft.current.x) / 2}
                  cy={(draft.start.y + draft.current.y) / 2}
                  rx={Math.abs(draft.current.x - draft.start.x) / 2}
                  ry={Math.abs(draft.current.y - draft.start.y) / 2}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="4 3"
                />
              )}
              {draft.kind === "arrow" && (
                <line x1={draft.start.x} y1={draft.start.y} x2={draft.current.x} y2={draft.current.y} stroke={color} strokeWidth={2.5} />
              )}
            </g>
          )}
        </g>
      </svg>
    </Panel>
  );
}

function DesignCanvasInner({
  initialDiagram,
  onChange,
  heightClass,
  readOnly,
  fullscreen,
  onToggleFullscreen,
}: {
  initialDiagram: DesignDiagram;
  onChange: (d: DesignDiagram) => void;
  heightClass: string;
  readOnly: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { t } = useTranslation("design");
  const [theme] = useTheme();
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DesignNodeData>>(toFlowNodes(initialDiagram));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(initialDiagram));
  const [annotations, setAnnotations] = useState<DesignAnnotation[]>(initialDiagram.annotations ?? []);
  const [tool, setTool] = useState<DesignDrawTool>("select");
  const [color, setColor] = useState(DEFAULT_ANNOTATION_COLOR);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);

  // Fires after every node/edge/annotation change (move, add, delete, connect, draw) — reacting to
  // the actual state rather than computing "the next value" at each handler call site avoids a
  // stale-closure bug (onNodesChange/setNodes schedule an update; `nodes` in the same handler call
  // is still last render's value). There's no feedback loop into `initialDiagram`: a full reset
  // (new task / clear) remounts this component via a `key` change on the exported DesignCanvas
  // below, instead of pushing a new diagram prop into an already-mounted instance.
  useEffect(() => {
    onChange(fromFlow(nodes, edges, annotations));
    // onChange intentionally excluded below: the caller passes a fresh setState-wrapping function
    // each render, which would otherwise refire this effect every render with no actual diagram change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, annotations]);

  // Escape backs out of fullscreen — the same expectation as any other full-viewport overlay in
  // the app (e.g. cv-preview-panel.tsx's own modal), skipped while the text-annotation textarea
  // has focus so its own Escape-to-blur (AnnotationLayer's onKeyDown) isn't shadowed.
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.activeElement?.tagName === "TEXTAREA") return;
      onToggleFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, onToggleFullscreen]);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  // React Flow reports a node's rendered size in `measured` once it has been laid out; the fallbacks
  // only cover the very first frame after a drop, before that measurement exists.
  const bindableNodes: BindableNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? DEFAULT_NODE_WIDTH,
        height: n.measured?.height ?? DEFAULT_NODE_HEIGHT,
      })),
    [nodes],
  );
  // Re-anchor every bound arrow after the nodes move/resize — keyed on the node GEOMETRY alone, not
  // on `annotations`: re-running whenever an annotation changes would fight the user mid-drag
  // (every endpoint move would be snapped straight back), whereas this way dragging a bound node
  // pulls its arrows along, which is the behaviour the binding exists for. applyArrowBindings
  // returns the same reference when nothing moved, so an unrelated node nudge is a no-op update.
  const nodeGeometryKey = bindableNodes.map((n) => `${n.id}:${n.x}:${n.y}:${n.width}:${n.height}`).join("|");
  useEffect(() => {
    const nodeMap = new Map(bindableNodes.map((n) => [n.id, n]));
    setAnnotations((prev) => {
      const next = prev.map((a) => (a.kind === "arrow" ? applyArrowBindings(a, nodeMap) : a));
      return next.some((a, i) => a !== prev[i]) ? next : prev;
    });
    // bindableNodes is derived from the same nodes as nodeGeometryKey, which is the actual trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeGeometryKey]);

  const selectedAnnotation = annotations.find((a) => a.id === selectedAnnotationId) ?? null;

  const applyColor = (next: string) => {
    setColor(next);
    if (selectedAnnotationId) setAnnotations((prev) => prev.map((a) => (a.id === selectedAnnotationId ? { ...a, color: next } : a)));
  };

  const deleteSelectedAnnotation = () => {
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  };

  const resolvePatternLabel = useCallback(
    (n: DesignPatternNode) => (n.labelKey ? t(PATTERN_NODE_LABEL_KEY[n.labelKey]) : designNodeKindLabel(n.kind)),
    [t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const patternId = e.dataTransfer.getData("application/x-design-pattern-id");
      if (patternId) {
        const pattern = DESIGN_PATTERNS.find((p) => p.id === patternId);
        if (!pattern) return;
        const { nodes: newNodes, edges: newEdges } = instantiatePattern(pattern, position, () => crypto.randomUUID(), resolvePatternLabel);
        setNodes((nds) => [
          ...nds,
          ...newNodes.map((n) => ({ id: n.id, type: "designNode", position: { x: n.x, y: n.y }, data: { kind: n.kind, label: n.label } })),
        ]);
        setEdges((eds) => [...eds, ...newEdges]);
        return;
      }
      const kind = e.dataTransfer.getData("application/x-design-node-kind") as DesignNodeKind;
      if (!kind) return;
      const id = crypto.randomUUID();
      setNodes((nds) => [...nds, { id, type: "designNode", position, data: { kind, label: designNodeKindLabel(kind) } }]);
    },
    [screenToFlowPosition, setNodes, setEdges, resolvePatternLabel],
  );

  return (
    <div className={`flex flex-col gap-2 ${heightClass}`}>
      <div className="flex gap-3 flex-1 min-h-0">
        {!readOnly && (
          <div className="w-40 shrink-0 space-y-2 overflow-y-auto">
            <div className="text-xs font-semibold text-ink-dim">{t("palette.heading")}</div>
            <p className="text-xs text-ink-dim">{t("palette.hint")}</p>
            <div className="flex flex-col gap-1.5">
              {DESIGN_NODE_KINDS.map((kind) => (
                <PaletteItem key={kind} kind={kind} />
              ))}
            </div>
            <div className="text-xs font-semibold text-ink-dim pt-2">{t("patterns.heading")}</div>
            <div className="flex flex-col gap-1.5">
              {DESIGN_PATTERNS.map((pattern) => (
                <PatternPaletteItem key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </div>
        )}
        <div
          className="flex-1 rounded-xl border border-grid overflow-hidden relative"
          onDragOver={readOnly ? undefined : (e) => e.preventDefault()}
          onDrop={readOnly ? undefined : onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            // Clicking bare canvas clears the annotation selection. It has to be handled here, not
            // on the annotation layer's own SVG: in "select" mode that layer is pointer-events:none
            // (only the shapes themselves opt back in), so a click on empty space never reaches it.
            onPaneClick={() => setSelectedAnnotationId(null)}
            nodeTypes={NODE_TYPES}
            deleteKeyCode={readOnly ? [] : DELETE_KEYS}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
            colorMode={theme}
            fitView
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
            {/* Always available (readOnly reference views benefit from more room just as much as
                the editable trainer canvas) — needs the same z-index bump as the toolbar below so
                the AnnotationLayer's full-size draw overlay can't cover it either. */}
            <Panel position="top-right" className="!m-2" style={{ zIndex: 10 }}>
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={t(fullscreen ? "canvas.fullscreenExit" : "canvas.fullscreenEnter")}
                aria-label={t(fullscreen ? "canvas.fullscreenExit" : "canvas.fullscreenEnter")}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface/95 backdrop-blur border border-grid shadow-md text-ink-dim hover:text-ink transition-colors"
              >
                {/* No dedicated "collapse" icon in the shared set — a literal ✕ for exiting
                    fullscreen matches cv-preview-panel.tsx's own modal-close convention. */}
                {fullscreen ? <span className="text-base leading-none">✕</span> : <ExpandIcon className="h-4 w-4" />}
              </button>
            </Panel>
            {/* Floating pill toolbar over the canvas (Excalidraw's own layout), instead of a
                full-width row above the sidebar — keeps the tool switcher next to the surface it
                acts on. */}
            {!readOnly && (
              <Panel position="top-center" className="!m-2" style={{ zIndex: 10 }}>
                <div className="flex items-center gap-3 flex-wrap bg-surface/95 backdrop-blur border border-grid rounded-xl shadow-md px-2.5 py-2">
                  <Segmented
                    value={tool}
                    onChange={setTool}
                    options={TOOL_ORDER.map((tl) => {
                      const Icon = TOOL_ICON[tl];
                      return {
                        value: tl,
                        label: (
                          <span className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            {t(TOOL_KEY[tl])}
                          </span>
                        ),
                      };
                    })}
                  />
                  {/* Doubles as Excalidraw's properties panel: with nothing selected the swatches
                      set the color the NEXT shape is drawn in; with a shape selected they recolor
                      that shape (and still update the default), and a delete button appears next to
                      them so removing a shape doesn't depend on knowing the Delete-key shortcut. */}
                  {(tool !== "select" || selectedAnnotation) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-dim">{t("canvas.colorLabel")}</span>
                      {ANNOTATION_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          onClick={() => applyColor(c)}
                          className={`h-5 w-5 rounded-full border-2 ${(selectedAnnotation?.color ?? color) === c ? "border-ink" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      {selectedAnnotation && (
                        <button
                          type="button"
                          onClick={deleteSelectedAnnotation}
                          title={t("canvas.deleteShape")}
                          aria-label={t("canvas.deleteShape")}
                          className="ml-1 flex items-center justify-center h-6 w-6 rounded-lg text-ink-dim hover:text-ink hover:bg-surface-2 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Panel>
            )}
            {!readOnly && (
              <AnnotationLayer
                tool={tool}
                color={color}
                annotations={annotations}
                setAnnotations={setAnnotations}
                selectedId={selectedAnnotationId}
                setSelectedId={setSelectedAnnotationId}
                editingId={editingAnnotationId}
                setEditingId={setEditingAnnotationId}
                onToolUsed={() => setTool("select")}
                bindableNodes={bindableNodes}
              />
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

/** `key` on this component (set by the caller, design-trainer.tsx) forces a remount — the only
 * reset path (new task / clear) — instead of trying to reconcile a fresh `diagram` prop into an
 * already-mounted React Flow instance mid-edit. */
export function DesignCanvas({
  initialDiagram,
  onChange,
  heightClass = "h-[65vh]",
  readOnly = false,
}: {
  initialDiagram: DesignDiagram;
  onChange: (d: DesignDiagram) => void;
  /** Defaults to the trainer's own full-height canvas; a smaller embed (e.g. a company card) can
   * pass something shorter. */
  heightClass?: string;
  /** No palette, no dragging/connecting/deleting — used for the reference-solution reveal
   * (design-reference-panel.tsx), which is a view, not an edit surface. */
  readOnly?: boolean;
}) {
  // Toggling this only swaps the wrapping div's own classes (fixed+inset vs. the normal inline
  // heightClass) — it deliberately does NOT remount ReactFlowProvider/DesignCanvasInner, so the
  // in-progress diagram, viewport pan/zoom, and active tool all survive entering/leaving
  // fullscreen instead of resetting.
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <>
      {fullscreen && <div className="fixed inset-0 z-40 bg-ink/60 cursor-default" onClick={() => setFullscreen(false)} aria-hidden />}
      <ReactFlowProvider>
        <DesignCanvasInner
          initialDiagram={initialDiagram}
          onChange={onChange}
          heightClass={fullscreen ? "fixed inset-3 md:inset-6 z-50 bg-surface rounded-2xl shadow-xl border border-grid p-3" : heightClass}
          readOnly={readOnly}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
        />
      </ReactFlowProvider>
    </>
  );
}
