import { useCallback, useEffect, useRef, useState } from "react";
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
  TypeIcon,
  type IconComponent,
} from "../../shared/icons";
import { DESIGN_NODE_ICON, DESIGN_NODE_KINDS, designNodeIconClass, designNodeKindLabel } from "../../shared/design-node-kinds";
import { DESIGN_PATTERNS, instantiatePattern, type DesignPattern, type DesignPatternNode } from "../../shared/design-patterns";
import {
  ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_COLOR,
  MIN_SHAPE_SIZE,
  buildFreehandPathD,
  colorMarkerKey,
  isDrawTool,
  nextAnnotationId,
  normalizeRect,
  translateAnnotation,
  type DesignDrawTool,
} from "../../shared/design-annotations";
import { DesignNode, type DesignNodeData } from "./design-node";
import type { DesignAnnotation, DesignDiagram, DesignNodeKind } from "../../shared/types";

const NODE_TYPES = { designNode: DesignNode };
// Backspace and Delete both remove the selected node(s)/edge(s) — React Flow's default is just
// Backspace; Delete is the more common expectation on Windows keyboards.
const DELETE_KEYS = ["Backspace", "Delete"];

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
type AnnotationDraft =
  | { kind: "freehand"; points: { x: number; y: number }[] }
  | { kind: "rectangle" | "ellipse"; start: { x: number; y: number }; current: { x: number; y: number } }
  | { kind: "arrow"; start: { x: number; y: number }; current: { x: number; y: number } };

function AnnotationShape({
  annotation,
  interactive,
  isSelected,
  isEditing,
  onSelectAndDrag,
  onEnterEdit,
  onCommitText,
}: {
  annotation: DesignAnnotation;
  interactive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  onSelectAndDrag: (id: string, e: React.PointerEvent) => void;
  onEnterEdit: (id: string) => void;
  onCommitText: (id: string, text: string) => void;
}) {
  const selectionStyle = isSelected ? { filter: "drop-shadow(0 0 0 2px rgb(var(--signal)))" } : undefined;
  const pointerProps = interactive
    ? { style: { cursor: "move", ...selectionStyle }, onPointerDown: (e: React.PointerEvent) => onSelectAndDrag(annotation.id, e) }
    : { style: selectionStyle };

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
      return (
        <foreignObject x={annotation.x} y={annotation.y} width={220} height={90} style={{ overflow: "visible" }}>
          {isEditing ? (
            <textarea
              defaultValue={annotation.text}
              ref={(el) => el?.focus()}
              onBlur={(e) => onCommitText(annotation.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              className="w-full h-16 bg-surface border border-signal rounded p-1 text-sm resize-none focus:outline-none"
              style={{ color: annotation.color }}
            />
          ) : (
            <div
              onPointerDown={interactive ? (e) => onSelectAndDrag(annotation.id, e) : undefined}
              onDoubleClick={() => onEnterEdit(annotation.id)}
              className="text-sm font-medium select-none whitespace-pre-wrap"
              style={{ color: annotation.color, cursor: interactive ? "move" : "default", ...selectionStyle }}
            >
              {annotation.text || <em className="opacity-50">…</em>}
            </div>
          )}
        </foreignObject>
      );
  }
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
}) {
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const dragRef = useRef<{ id: string; lastFlow: { x: number; y: number } } | null>(null);

  const drawing = isDrawTool(tool);

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

  const onLayerPointerMove = (e: React.PointerEvent) => {
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
        onClick={(e) => {
          // A click on empty canvas in select mode deselects — but not one that just finished a
          // drag (dragRef is already cleared by then, so this only fires for a genuine bare click).
          if (tool === "select" && e.target === e.currentTarget) setSelectedId(null);
        }}
      >
        <defs>
          {ANNOTATION_COLORS.map((c) => (
            <marker key={c} id={`design-arrowhead-${colorMarkerKey(c)}`} markerWidth={8} markerHeight={8} refX={7} refY={4} orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill={c} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {annotations.map((a) => (
            <AnnotationShape
              key={a.id}
              annotation={a}
              interactive={tool === "select"}
              isSelected={selectedId === a.id}
              isEditing={editingId === a.id}
              onSelectAndDrag={onSelectAndDrag}
              onEnterEdit={setEditingId}
              onCommitText={commitText}
            />
          ))}
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
                  {tool !== "select" && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-dim">{t("canvas.colorLabel")}</span>
                      {ANNOTATION_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          onClick={() => setColor(c)}
                          className={`h-5 w-5 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
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
