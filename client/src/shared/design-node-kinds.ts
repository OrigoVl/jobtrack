// DesignNodeKind is a persisted wire value (stored in the diagram JSON, sent to the AI in
// prompts) — never translate it directly, same convention as fit-tone.ts's Fit. This maps each
// kind to its i18n key and a Chip tone so design-node.tsx/design-canvas.tsx's palette stay in
// sync with a single source of truth.
import i18n from "../i18n";
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
