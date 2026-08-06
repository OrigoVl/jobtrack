// DesignNodeKind is a persisted wire value (stored in the diagram JSON, sent to the AI in
// prompts) — never translate it directly, same convention as fit-tone.ts's Fit. This maps each
// kind to its i18n key and a Chip tone so design-node.tsx/design-canvas.tsx's palette stay in
// sync with a single source of truth.
import i18n from "../i18n";
import {
  MonitorIcon,
  SplitIcon,
  ServerIcon,
  DatabaseIcon,
  ZapIcon,
  QueueIcon,
  GlobeIcon,
  ArchiveIcon,
  PlugIcon,
  ShapesIcon,
  type IconComponent,
} from "./icons";
import type { DesignNodeKind } from "./types";

export const DESIGN_NODE_KINDS: DesignNodeKind[] = [
  "client",
  "loadBalancer",
  "service",
  "database",
  "cache",
  "queue",
  "cdn",
  "storage",
  "thirdParty",
  "generic",
];

const KIND_KEY: Record<DesignNodeKind, `nodeKinds.${DesignNodeKind}`> = {
  client: "nodeKinds.client",
  loadBalancer: "nodeKinds.loadBalancer",
  service: "nodeKinds.service",
  database: "nodeKinds.database",
  cache: "nodeKinds.cache",
  queue: "nodeKinds.queue",
  cdn: "nodeKinds.cdn",
  storage: "nodeKinds.storage",
  thirdParty: "nodeKinds.thirdParty",
  generic: "nodeKinds.generic",
};

/** Translates a DesignNodeKind for display. Calls the i18next singleton directly (not a `t` from
 * the caller's own useTranslation()) since callers may live in components with a different
 * default namespace — same reasoning as fit-tone.ts's fitLabel. */
export function designNodeKindLabel(kind: DesignNodeKind): string {
  return i18n.t(`design:${KIND_KEY[kind]}`);
}

// One tone per kind (Chip's tone union: slate|indigo|emerald|amber|good|rose) — cycled by
// meaning, not by rank: client/service are the "your system" tones, database/cache/queue/storage
// share a neutral data tone, cdn/thirdParty/loadBalancer stay a distinct slate/amber accent.
export const DESIGN_NODE_TONE: Record<DesignNodeKind, "slate" | "indigo" | "emerald" | "amber" | "good" | "rose"> = {
  client: "indigo",
  loadBalancer: "amber",
  service: "good",
  database: "slate",
  cache: "slate",
  queue: "slate",
  cdn: "amber",
  storage: "slate",
  thirdParty: "rose",
  generic: "slate",
};

// One glyph per kind, so the palette/canvas nodes read at a glance instead of by label text alone
// (an Excalidraw-style shape library). Picked by real-world association (cylinder=database,
// bolt=cache, fan-out=load balancer), not decoration.
export const DESIGN_NODE_ICON: Record<DesignNodeKind, IconComponent> = {
  client: MonitorIcon,
  loadBalancer: SplitIcon,
  service: ServerIcon,
  database: DatabaseIcon,
  cache: ZapIcon,
  queue: QueueIcon,
  cdn: GlobeIcon,
  storage: ArchiveIcon,
  thirdParty: PlugIcon,
  generic: ShapesIcon,
};

// Text-color half of ui.tsx's CHIP_TONE palette, for tinting a kind's icon the same hue as its
// Chip badge — derived from DESIGN_NODE_TONE above so the tone stays the single source of truth
// per kind (see that const's own comment) instead of a second parallel kind->color mapping.
const TONE_TEXT_CLASS: Record<"slate" | "indigo" | "emerald" | "amber" | "good" | "rose", string> = {
  slate: "text-ink-dim",
  indigo: "text-signal",
  emerald: "text-signal",
  amber: "text-alert",
  good: "text-good",
  rose: "text-rose-600 dark:text-rose-300",
};

export function designNodeIconClass(kind: DesignNodeKind): string {
  return TONE_TEXT_CLASS[DESIGN_NODE_TONE[kind]];
}
