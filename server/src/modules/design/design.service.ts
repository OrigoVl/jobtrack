// Architecture trainer: AI generates a system-design task, the user builds a node/edge diagram
// (client/src/features/design/), the AI grades it against a score + criteria checklist. Business
// logic split from design.routes.ts, same reasoning as mock-interview.service.ts/cv-analysis.service.ts.
import { z } from "zod";
import { chat, chatJson, llmAvailable } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Profile, VacancyRow } from "../../db/types.js";

export type DesignNodeKind =
  "client" | "loadBalancer" | "service" | "database" | "cache" | "queue" | "cdn" | "storage" | "thirdParty" | "generic";

export interface DesignNode {
  id: string;
  kind: DesignNodeKind;
  label: string;
  x: number;
  y: number;
}
export interface DesignEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}
// Freeform drawing (pen/shapes/arrows/text) layered on top of the structured node/edge graph —
// purely decorative annotations a candidate might use to sketch out a note or emphasize part of
// the diagram, Excalidraw-style. Deliberately NOT read by renderDiagram()/the grading prompts
// below: a system-design grade is about the structural components and their connections, not
// freehand scribbles, so annotations never reach the LLM. Optional on DesignDiagram so every
// existing call site/fixture that builds a diagram literal without one still compiles.
interface DesignAnnotationBase {
  id: string;
  color: string;
  /** Clockwise degrees about the annotation's own bounding-box center (client-side geometry — see
   * the client's design-annotations.ts); absent means unrotated. */
  rotation?: number;
}
export interface DesignFreehandAnnotation extends DesignAnnotationBase {
  kind: "freehand";
  points: { x: number; y: number }[];
}
export interface DesignRectangleAnnotation extends DesignAnnotationBase {
  kind: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DesignEllipseAnnotation extends DesignAnnotationBase {
  kind: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DesignArrowAnnotation extends DesignAnnotationBase {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Optional "sticks to this node" bindings — the client re-anchors the endpoint whenever the
   * bound node moves. Purely a drawing aid: a bound arrow is still an annotation, NOT a structural
   * DesignEdge, and is just as invisible to the grading prompt as the rest of this layer. */
  startNodeId?: string;
  endNodeId?: string;
}
export interface DesignTextAnnotation extends DesignAnnotationBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
}
export type DesignAnnotation =
  DesignFreehandAnnotation | DesignRectangleAnnotation | DesignEllipseAnnotation | DesignArrowAnnotation | DesignTextAnnotation;

export interface DesignDiagram {
  nodes: DesignNode[];
  edges: DesignEdge[];
  annotations?: DesignAnnotation[];
}

export interface DesignTask {
  title: string;
  scenario: string;
  requirements: string[];
  constraints: string[];
  difficulty: "easy" | "medium" | "hard";
}

export interface DesignCriterion {
  title: string;
  met: boolean;
  note: string;
}
// A suggested reference solution — kind/label only, deliberately NO x/y from the LLM (coordinates
// are unreliable to ask an LLM for; the client auto-layouts these deterministically by kind, see
// client/src/shared/design-layout.ts). Edges reference nodes by label text, not index — matches
// how renderDiagram() below already describes a diagram to the model, and is robust to the model
// re-ordering nodes between the two arrays in its own response.
export interface DesignReferenceNode {
  kind: DesignNodeKind;
  label: string;
}
export interface DesignReferenceEdge {
  from: string;
  to: string;
}

export interface DesignGrade {
  offline?: boolean;
  score: number;
  summary: string;
  criteria: DesignCriterion[];
  strengths: string[];
  missed: string[];
  tip: string;
  // Only populated by a real AI grade (never the offline heuristic — suggesting a "reference
  // solution" is a creative task, not a structural check a regex-based fallback can approximate).
  referenceNodes?: DesignReferenceNode[];
  referenceEdges?: DesignReferenceEdge[];
}

// Lightweight history (score + metadata, no diagram) — enough to show progress over time without
// keeping every full diagram around. Not the "current exercise" (design.routes.ts's designExercise
// key) — that's the single in-progress one; this is an append-only log of past grades.
export interface DesignHistoryEntry {
  id: string;
  title: string;
  difficulty: DesignTask["difficulty"];
  score: number;
  offline: boolean;
  gradedAt: string;
}

export const MAX_DESIGN_HISTORY = 20;

/** Prepends the newest entry and caps the list — same append-and-cap shape as
 * study/content-store.ts's genDrills. Pure so the cap behavior is unit-testable without a DB. */
export function appendDesignHistory(history: DesignHistoryEntry[], entry: DesignHistoryEntry): DesignHistoryEntry[] {
  return [entry, ...history].slice(0, MAX_DESIGN_HISTORY);
}

const DesignTaskSchema = z.object({
  title: z.string().catch(""),
  scenario: z.string().catch(""),
  requirements: z.array(z.string()).catch([]),
  constraints: z.array(z.string()).catch([]),
  difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
});

const DesignCriterionSchema = z.object({ title: z.string(), met: z.boolean().catch(false), note: z.string().catch("") });
const DESIGN_NODE_KIND_VALUES = [
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
] as const;
const DesignReferenceNodeSchema = z.object({
  kind: z.enum(DESIGN_NODE_KIND_VALUES).catch("generic"),
  label: z.string().catch(""),
});
const DesignReferenceEdgeSchema = z.object({ from: z.string().catch(""), to: z.string().catch("") });
const DesignGradeSchema = z.object({
  score: z.coerce.number().catch(0),
  summary: z.string().catch(""),
  criteria: z.array(DesignCriterionSchema).catch([]),
  strengths: z.array(z.string()).catch([]),
  missed: z.array(z.string()).catch([]),
  tip: z.string().catch(""),
  referenceNodes: z.array(DesignReferenceNodeSchema).catch([]),
  referenceEdges: z.array(DesignReferenceEdgeSchema).catch([]),
});

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Exported for design-defense's own prompts below (runDefenseTurn) — same diagram->prose
// rendering the grade/help prompts already use, so the AI describes the SAME diagram consistently
// across every design.service.ts call site.
export function renderDiagram(diagram: DesignDiagram): string {
  if (diagram.nodes.length === 0) return "(empty — no shapes placed yet)";
  const nodeLines = diagram.nodes.map((n) => `- "${n.label || n.kind}" [${n.kind}]`).join("\n");
  const edgeLines = diagram.edges.length
    ? diagram.edges
        .map((e) => {
          const from = diagram.nodes.find((n) => n.id === e.source);
          const to = diagram.nodes.find((n) => n.id === e.target);
          return `- "${from?.label || from?.kind || e.source}" -> "${to?.label || to?.kind || e.target}"${e.label ? ` (${e.label})` : ""}`;
        })
        .join("\n")
    : "(no connections)";
  return `Shapes:\n${nodeLines}\n\nConnections:\n${edgeLines}`;
}

// A local composition, not a reuse of mock-interview.service.ts's buildVacancyContext — this repo
// deliberately keeps per-feature vacancy→text helpers independent (see vacancy-detail-modal.tsx's
// own comment on why three near-identical ones already exist) rather than one shared helper that
// has to please every call site's own framing.
function buildVacancyDesignContext(vacancy: VacancyRow | null): string {
  if (!vacancy) return "";
  return (
    `\n\nBias the task toward this specific tracked vacancy, so the practice is directly relevant:\n` +
    `${vacancy.position}${vacancy.company ? ` @ ${vacancy.company}` : ""}${vacancy.level ? ` (${vacancy.level})` : ""}\n` +
    `${vacancy.stack.length ? `Stack: ${vacancy.stack.join(", ")}\n` : ""}` +
    `${vacancy.notes ? vacancy.notes : ""}`
  );
}

export function buildTaskPrompt(profile: Profile, vacancy: VacancyRow | null = null): string {
  const role = profile.domain || "backend/full-stack";
  return (
    `Generate ONE system-design practice task for a candidate targeting a "${role}" role — the kind of ` +
    `question asked in a system-design interview (e.g. "design a URL shortener", "design a rate limiter", ` +
    `"design a chat app"). Pick a fresh, varied scenario each time — don't always default to the most common one.` +
    `${buildVacancyDesignContext(vacancy)}\n\n` +
    `Return JSON strictly: {"title":"short task name","scenario":"2-3 sentence description of what to design",` +
    `"requirements":["3-6 functional/non-functional requirements, e.g. scale numbers, latency targets"],` +
    `"constraints":["1-3 constraints, e.g. budget, team size, must reuse an existing component"],` +
    `"difficulty":"easy|medium|hard"}`
  );
}

export function buildGradePrompt(task: DesignTask, diagram: DesignDiagram): string {
  return (
    `Task: ${task.title}\n${task.scenario}\n` +
    `Requirements:\n${task.requirements.map((r) => `- ${r}`).join("\n")}\n` +
    `Constraints:\n${task.constraints.map((c) => `- ${c}`).join("\n")}\n\n` +
    `Candidate's diagram:\n${renderDiagram(diagram)}\n\n` +
    `Grade the diagram against the requirements/constraints above. Also sketch a reference solution: ` +
    `4-8 shapes that would satisfy the requirements well, using EXACTLY the same label text in both ` +
    `referenceNodes and referenceEdges (edges reference nodes by label, not position/index).\n\n` +
    `Return JSON strictly: ` +
    `{"score":<0-100>,"summary":"1-2 sentence overall verdict",` +
    `"criteria":[{"title":"one specific requirement/best-practice check","met":<true|false>,"note":"why, 1 sentence"}],` +
    `"strengths":["1-3 things the candidate got right"],"missed":["1-3 things missing or wrong"],"tip":"1 concrete next step",` +
    `"referenceNodes":[{"kind":"client|loadBalancer|service|database|cache|queue|cdn|storage|thirdParty|generic","label":"short label"}],` +
    `"referenceEdges":[{"from":"label of source node","to":"label of target node"}]}`
  );
}

export function buildHelpPrompt(task: DesignTask, diagram: DesignDiagram, question: string): string {
  return (
    `Task: ${task.title}\n${task.scenario}\n` +
    `Requirements:\n${task.requirements.map((r) => `- ${r}`).join("\n")}\n\n` +
    `Candidate's current diagram:\n${renderDiagram(diagram)}\n\n` +
    `Candidate's question: ${question}\n\n` +
    `Answer helpfully and concretely, in 2-4 sentences. Don't just give away the full solution — nudge them ` +
    `toward the answer unless they're clearly stuck.`
  );
}

const TASK_SYSTEM = "You design system-design practice exercises for software engineering interview prep. Respond with ONLY valid JSON.";
const GRADE_SYSTEM =
  "You are a staff engineer reviewing a candidate's system-design diagram. Grade only what's actually in the " +
  "diagram provided — don't credit a component the candidate didn't actually place, even if it would be a good " +
  "idea. Respond with ONLY valid JSON.";
const HELP_SYSTEM = "You are a helpful staff engineer mentoring a candidate through a system-design practice exercise. Be concise.";

// ---------- Requirement-keyword -> expected node kind, for the offline heuristic grader ----------
const REQUIREMENT_HINTS: { pattern: RegExp; kind: DesignNodeKind; title: string }[] = [
  { pattern: /\b(persist|store|database|db)\b/i, kind: "database", title: "Has a database for persistence" },
  { pattern: /\bcach(e|ing)\b/i, kind: "cache", title: "Has a cache" },
  { pattern: /\b(queue|async|message|event)\b/i, kind: "queue", title: "Has a queue for async work" },
  { pattern: /\b(scale|multiple instances|high availability|load)\b/i, kind: "loadBalancer", title: "Has a load balancer" },
  { pattern: /\b(cdn|static asset|media)\b/i, kind: "cdn", title: "Has a CDN for static content" },
];

/** Offline fallback for grading (unlike task generation, a structural check is possible without
 * an LLM) — checks the diagram's shape against the task's own requirement/constraint text, plus
 * basic graph hygiene (not empty, no fully-disconnected shapes). */
export function heuristicGrade(task: DesignTask, diagram: DesignDiagram): DesignGrade {
  const text = `${task.scenario} ${task.requirements.join(" ")} ${task.constraints.join(" ")}`;
  const criteria: DesignCriterion[] = [];

  criteria.push({
    title: "Diagram is not empty",
    met: diagram.nodes.length > 0,
    note: diagram.nodes.length > 0 ? `${diagram.nodes.length} shape(s) placed.` : "No shapes placed yet.",
  });

  const connected = new Set(diagram.edges.flatMap((e) => [e.source, e.target]));
  const orphans = diagram.nodes.filter((n) => !connected.has(n.id));
  criteria.push({
    title: "No disconnected shapes",
    met: diagram.nodes.length > 0 && orphans.length === 0,
    note: orphans.length > 0 ? `${orphans.length} shape(s) have no connection.` : "Every shape is connected.",
  });

  for (const hint of REQUIREMENT_HINTS) {
    if (!hint.pattern.test(text)) continue;
    const met = diagram.nodes.some((n) => n.kind === hint.kind);
    criteria.push({
      title: hint.title,
      met,
      note: met ? "Found in the diagram." : "The task hints at this, but no matching shape was found.",
    });
  }

  const metCount = criteria.filter((c) => c.met).length;
  const score = criteria.length ? clampScore((metCount / criteria.length) * 100) : 0;
  return {
    score,
    summary: "Basic offline structural check — enable the LLM for a full review.",
    criteria,
    strengths: [],
    missed: criteria.filter((c) => !c.met).map((c) => c.title),
    tip: "Enable the LLM in server/.env for a detailed, requirement-by-requirement review.",
  };
}

export async function generateDesignTask(
  userId: UserId,
  profile: Profile,
  vacancy: VacancyRow | null = null,
): Promise<{ offline: boolean; task: DesignTask | null }> {
  if (!llmAvailable()) return { offline: true, task: null };
  // No `cache` — same reasoning as mock-interview's ask phase: identical prompts would serve
  // every user in the same role the same task forever, and temperature would be muted.
  const out = await chatJson(userId, TASK_SYSTEM, buildTaskPrompt(profile, vacancy), DesignTaskSchema, {
    maxTokens: 500,
    temperature: 0.7,
    tier: "fast",
    feature: "design-generate-task",
    outputLocale: "app",
  });
  if (!out) return { offline: true, task: null };
  return { offline: false, task: out };
}

export async function gradeDesign(userId: UserId, task: DesignTask, diagram: DesignDiagram): Promise<DesignGrade> {
  if (!llmAvailable()) return { offline: true, ...heuristicGrade(task, diagram) };
  // maxTokens 2600 (not 2000) — asking for a reference solution (4-8 shapes + edges) on top of
  // the existing score/criteria/strengths/missed/tip runs longer; a truncated response silently
  // falls back to the offline heuristic (same risk cv-analysis.service.ts's matchCv() documents).
  const out = await chatJson(userId, GRADE_SYSTEM, buildGradePrompt(task, diagram), DesignGradeSchema, {
    maxTokens: 2600,
    temperature: 0.3,
    tier: "smart",
    feature: "design-grade",
    outputLocale: "app",
  });
  if (!out) return { offline: true, ...heuristicGrade(task, diagram) };
  return { offline: false, ...out, score: clampScore(out.score) };
}

export async function helpWithDesign(
  userId: UserId,
  task: DesignTask,
  diagram: DesignDiagram,
  question: string,
): Promise<{ offline: boolean; answer: string }> {
  if (!llmAvailable()) return { offline: true, answer: "" };
  const out = await chat(userId, HELP_SYSTEM, buildHelpPrompt(task, diagram, question), {
    maxTokens: 400,
    temperature: 0.5,
    tier: "fast",
    feature: "design-help",
    outputLocale: "app",
  });
  if (!out) return { offline: true, answer: "" };
  return { offline: false, answer: out };
}

// ---------- Verbal defense: a short live follow-up discussion about the graded diagram ----------
// A sibling to mock-interview.service.ts, not a reuse: that module's prompts/schemas are
// vacancy-interview-flavored end to end (system prompts, a full second MockEvalCard-shaped
// review), and a second 0-100 score sitting next to DesignGrade.score would be redundant. What IS
// shared: the stateless "client resends the whole transcript every turn" contract, and the same
// {offline, retryable, done, question, review, turnNumber, maxTurns} result shape, so the client
// can reuse mock/voice-interview.tsx's turn-management logic almost verbatim.
export const MIN_DEFENSE_TURNS = 2;
export const MAX_DEFENSE_TURNS = 4;

export interface DesignDefenseReview {
  score: number;
  verdict: string;
  good: string[];
  missed: string[];
  tip: string;
}

export interface DesignDefenseTurnResult {
  offline?: boolean;
  /** true only for a transient failure (chatJson returned null mid-defense) — same meaning as
   * mock-interview.service.ts's InterviewTurnResult.retryable. */
  retryable?: boolean;
  done: boolean;
  question: string;
  review: DesignDefenseReview | null;
  turnNumber: number;
  maxTurns: number;
}

function renderDefenseTranscript(transcript: { q: string; a: string }[]): string {
  if (transcript.length === 0) return "(nothing yet — this is the opening question)";
  return transcript.map((t, i) => `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a}`).join("\n\n");
}

export function buildDefenseAskPrompt(task: DesignTask, diagram: DesignDiagram, transcript: { q: string; a: string }[]): string {
  return (
    `Task: ${task.title}\n${task.scenario}\n\n` +
    `Candidate's diagram:\n${renderDiagram(diagram)}\n\n` +
    `Discussion so far:\n${renderDefenseTranscript(transcript)}\n\n` +
    `Ask the next question — probe a specific design decision, tradeoff, or gap in THIS diagram, not a ` +
    `generic interview question. Return JSON strictly: {"question":"<the next question>"}`
  );
}

export function buildDefenseReviewPrompt(task: DesignTask, diagram: DesignDiagram, transcript: { q: string; a: string }[]): string {
  return (
    `Task: ${task.title}\n${task.scenario}\n\n` +
    `Candidate's diagram:\n${renderDiagram(diagram)}\n\n` +
    `Full discussion:\n${renderDefenseTranscript(transcript)}\n\n` +
    `Return JSON strictly: {"score":<0-100, how well they defended their design choices>,` +
    `"verdict":"1-2 sentence overall verdict","good":["what they defended well, 1-3"],` +
    `"missed":["what they couldn't justify or got wrong, 1-3"],"tip":"1 concrete tip for next time"}`
  );
}

const DEFENSE_ASK_SYSTEM =
  "You are a staff engineer probing a candidate's system-design diagram in a short follow-up discussion. Ask " +
  "ONE clear, pointed question at a time about a specific design choice, tradeoff, or gap in THEIR diagram — " +
  "not a generic interview question. Respond with ONLY valid JSON.";
const DEFENSE_REVIEW_SYSTEM =
  "The follow-up discussion is over. Give a holistic assessment of how well the candidate defended their " +
  "design choices. Respond with ONLY valid JSON.";

const DefenseAskSchema = z.object({ question: z.string().catch("") });
const DefenseReviewSchema = z.object({
  score: z.coerce.number().catch(0),
  verdict: z.string().catch(""),
  good: z.array(z.string()).catch([]),
  missed: z.array(z.string()).catch([]),
  tip: z.string().catch(""),
});

function clampDefenseTurns(n: number): number {
  return Math.max(MIN_DEFENSE_TURNS, Math.min(MAX_DEFENSE_TURNS, n));
}

export async function runDefenseTurn(
  userId: UserId,
  task: DesignTask,
  diagram: DesignDiagram,
  transcript: { q: string; a: string }[],
  maxTurnsInput: number,
): Promise<DesignDefenseTurnResult> {
  const maxTurns = clampDefenseTurns(maxTurnsInput);
  const turnNumber = transcript.length + 1;
  if (!llmAvailable()) return { offline: true, done: true, question: "", review: null, turnNumber, maxTurns };

  if (transcript.length < maxTurns) {
    // "fast" tier + no cache — same reasoning as mock-interview's ask phase: many small calls per
    // defense, and caching would serve every user the same opening question forever.
    const out = await chatJson(userId, DEFENSE_ASK_SYSTEM, buildDefenseAskPrompt(task, diagram, transcript), DefenseAskSchema, {
      maxTokens: 300,
      temperature: 0.6,
      tier: "fast",
      feature: "design-defense",
      outputLocale: "app",
    });
    if (!out) return { offline: true, retryable: true, done: false, question: "", review: null, turnNumber, maxTurns };
    return { done: false, question: out.question, review: null, turnNumber, maxTurns };
  }

  const out = await chatJson(userId, DEFENSE_REVIEW_SYSTEM, buildDefenseReviewPrompt(task, diagram, transcript), DefenseReviewSchema, {
    maxTokens: 700,
    temperature: 0.3,
    tier: "smart",
    feature: "design-defense",
    outputLocale: "app",
  });
  if (!out) return { offline: true, retryable: true, done: false, question: "", review: null, turnNumber, maxTurns };
  return { done: true, question: "", review: { ...out, score: clampScore(out.score) }, turnNumber, maxTurns };
}
