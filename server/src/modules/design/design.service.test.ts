// Contract test for the offline fallback (llmAvailable() === false must NEVER touch chat()/
// chatJson()), plus prompt builders and the offline heuristic grader — same mocking shape as
// mock-interview.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
  chat: vi.fn(),
}));

import {
  generateDesignTask,
  gradeDesign,
  helpWithDesign,
  heuristicGrade,
  appendDesignHistory,
  MAX_DESIGN_HISTORY,
  runDefenseTurn,
  buildTaskPrompt,
  buildGradePrompt,
  buildHelpPrompt,
  buildDefenseAskPrompt,
  buildDefenseReviewPrompt,
  MIN_DEFENSE_TURNS,
  MAX_DEFENSE_TURNS,
  type DesignDiagram,
  type DesignHistoryEntry,
  type DesignTask,
} from "./design.service.js";
import { llmAvailable, chatJson, chat } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { Profile, VacancyRow } from "../../db/types.js";

const profile: Profile = { skills: ["React", "Node.js"], cvText: "", domain: "Backend Engineer" };
const vacancy: VacancyRow = {
  id: 1,
  company: "Acme",
  position: "Senior Backend Engineer",
  level: "Senior",
  salary: "",
  url: "",
  status: "Applied",
  fit: "high",
  applied: "",
  next: "",
  notes: "High-traffic payments platform.",
  stack: ["Go", "Kafka", "PostgreSQL"],
  created: "",
  companyId: null,
  favorite: false,
  coverLetter: "",
  coverLetterDetails: "",
};
const task: DesignTask = {
  title: "URL shortener",
  scenario: "Design a service that shortens long URLs.",
  requirements: ["Handle 1000 requests/sec", "Persist mappings in a database", "Cache hot lookups"],
  constraints: ["Single team, 2 weeks"],
  difficulty: "medium",
};

describe("generateDesignTask()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offline: returns a terminal offline result without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await generateDesignTask(BOOTSTRAP_USER_ID, profile);
    expect(result).toEqual({ offline: true, task: null });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("available: returns the generated task and uses the fast tier", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(task);
    const result = await generateDesignTask(BOOTSTRAP_USER_ID, profile);
    expect(result).toEqual({ offline: false, task });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "fast", feature: "design-generate-task" });
  });

  it("chatJson() returning null is offline, not a thrown error", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await generateDesignTask(BOOTSTRAP_USER_ID, profile);
    expect(result).toEqual({ offline: true, task: null });
  });

  it("passes the vacancy through into the prompt when one is given", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(task);
    await generateDesignTask(BOOTSTRAP_USER_ID, profile, vacancy);
    const prompt = vi.mocked(chatJson).mock.calls[0]![2] as string;
    expect(prompt).toContain("Senior Backend Engineer @ Acme");
    expect(prompt).toContain("Kafka");
  });
});

describe("gradeDesign()", () => {
  const diagram: DesignDiagram = {
    nodes: [
      { id: "1", kind: "client", label: "Client", x: 0, y: 0 },
      { id: "2", kind: "service", label: "API", x: 100, y: 0 },
      { id: "3", kind: "database", label: "DB", x: 200, y: 0 },
    ],
    edges: [
      { id: "e1", source: "1", target: "2" },
      { id: "e2", source: "2", target: "3" },
    ],
  };

  beforeEach(() => vi.clearAllMocks());

  it("offline: falls back to the deterministic heuristic without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await gradeDesign(BOOTSTRAP_USER_ID, task, diagram);
    expect(result.offline).toBe(true);
    expect(chatJson).not.toHaveBeenCalled();
    // requirement mentions caching, but no cache node exists in this diagram
    expect(result.criteria.some((c) => c.title === "Has a cache" && !c.met)).toBe(true);
  });

  it("available: returns the AI grade with score clamped, using the smart tier", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({
      score: 130,
      summary: "Good start.",
      criteria: [{ title: "Has a database", met: true, note: "Yes." }],
      strengths: ["Clear client/API split"],
      missed: ["No cache"],
      tip: "Add a cache in front of the database.",
      referenceNodes: [{ kind: "cache", label: "Cache" }],
      referenceEdges: [{ from: "API", to: "Cache" }],
    });
    const result = await gradeDesign(BOOTSTRAP_USER_ID, task, diagram);
    expect(result.offline).toBe(false);
    expect(result.score).toBe(100);
    expect(result.referenceNodes).toEqual([{ kind: "cache", label: "Cache" }]);
    expect(result.referenceEdges).toEqual([{ from: "API", to: "Cache" }]);
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "smart", feature: "design-grade" });
  });

  it("offline heuristic never fabricates a reference solution", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await gradeDesign(BOOTSTRAP_USER_ID, task, diagram);
    expect(result.referenceNodes ?? []).toEqual([]);
    expect(result.referenceEdges ?? []).toEqual([]);
  });

  it("chatJson() returning null falls back to the heuristic (still offline:true)", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await gradeDesign(BOOTSTRAP_USER_ID, task, diagram);
    expect(result.offline).toBe(true);
    expect(result.criteria.length).toBeGreaterThan(0);
  });
});

describe("heuristicGrade()", () => {
  it("flags an empty diagram as not meeting the basic structural checks", () => {
    const result = heuristicGrade(task, { nodes: [], edges: [] });
    expect(result.score).toBe(0);
    expect(result.criteria.find((c) => c.title === "Diagram is not empty")?.met).toBe(false);
  });

  it("flags a disconnected shape", () => {
    const diagram: DesignDiagram = {
      nodes: [
        { id: "1", kind: "client", label: "Client", x: 0, y: 0 },
        { id: "2", kind: "database", label: "DB", x: 100, y: 0 },
      ],
      edges: [],
    };
    const result = heuristicGrade(task, diagram);
    expect(result.criteria.find((c) => c.title === "No disconnected shapes")?.met).toBe(false);
  });
});

describe("helpWithDesign()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offline: returns a terminal offline result without calling chat()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await helpWithDesign(BOOTSTRAP_USER_ID, task, { nodes: [], edges: [] }, "What should I cache?");
    expect(result).toEqual({ offline: true, answer: "" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("available: returns the plain-text answer using chat() (not chatJson)", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    // `chat()` is overloaded (string | null vs. the internal LlmResult shape) — vi.mocked() picks
    // the implementation signature's return type, so the plain-string resolved value needs a cast.
    vi.mocked(chat).mockResolvedValue("Cache the lookup results, keyed by the short code." as never);
    const result = await helpWithDesign(BOOTSTRAP_USER_ID, task, { nodes: [], edges: [] }, "What should I cache?");
    expect(result).toEqual({ offline: false, answer: "Cache the lookup results, keyed by the short code." });
    expect(chatJson).not.toHaveBeenCalled();
  });
});

describe("prompt builders", () => {
  it("buildTaskPrompt() mentions the candidate's target role", () => {
    expect(buildTaskPrompt(profile)).toContain("Backend Engineer");
  });

  it("buildTaskPrompt() with no vacancy doesn't mention any company", () => {
    expect(buildTaskPrompt(profile)).not.toContain("Acme");
  });

  it("buildTaskPrompt() biases toward the given vacancy's stack/scale", () => {
    const prompt = buildTaskPrompt(profile, vacancy);
    expect(prompt).toContain("Senior Backend Engineer @ Acme");
    expect(prompt).toContain("Go, Kafka, PostgreSQL");
    expect(prompt).toContain("High-traffic payments platform.");
  });

  it("buildGradePrompt() renders the task and diagram", () => {
    const prompt = buildGradePrompt(task, { nodes: [{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }], edges: [] });
    expect(prompt).toContain("URL shortener");
    expect(prompt).toContain('"Client" [client]');
  });

  it("buildGradePrompt() asks for a reference solution keyed by label", () => {
    const prompt = buildGradePrompt(task, { nodes: [], edges: [] });
    expect(prompt).toContain("referenceNodes");
    expect(prompt).toContain("referenceEdges");
  });

  it("buildGradePrompt() renders an empty diagram honestly", () => {
    expect(buildGradePrompt(task, { nodes: [], edges: [] })).toContain("no shapes placed yet");
  });

  it("buildHelpPrompt() includes the candidate's question", () => {
    expect(buildHelpPrompt(task, { nodes: [], edges: [] }, "What should I cache?")).toContain("What should I cache?");
  });
});

describe("appendDesignHistory()", () => {
  const entry = (id: string, score = 50): DesignHistoryEntry => ({
    id,
    title: "URL shortener",
    difficulty: "medium",
    score,
    offline: false,
    gradedAt: "2026-01-01T00:00:00.000Z",
  });

  it("prepends the new entry (newest first)", () => {
    const result = appendDesignHistory([entry("old")], entry("new"));
    expect(result.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("caps the list at MAX_DESIGN_HISTORY", () => {
    const full = Array.from({ length: MAX_DESIGN_HISTORY }, (_, i) => entry(`e${i}`));
    const result = appendDesignHistory(full, entry("newest"));
    expect(result.length).toBe(MAX_DESIGN_HISTORY);
    expect(result[0]!.id).toBe("newest");
    expect(result.find((e) => e.id === `e${MAX_DESIGN_HISTORY - 1}`)).toBeUndefined();
  });
});

describe("runDefenseTurn()", () => {
  const diagram: DesignDiagram = {
    nodes: [{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }],
    edges: [],
  };

  beforeEach(() => vi.clearAllMocks());

  it("offline: returns a terminal offline result without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, [], 3);
    expect(result).toEqual({ offline: true, done: true, question: "", review: null, turnNumber: 1, maxTurns: 3 });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("ask mode: returns the next question with done:false while transcript.length < maxTurns, using the fast tier", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ question: "Why did you choose a single database instance?" });
    const result = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, [{ q: "Walk me through your design.", a: "Sure, ..." }], 3);
    expect(result).toEqual({
      done: false,
      question: "Why did you choose a single database instance?",
      review: null,
      turnNumber: 2,
      maxTurns: 3,
    });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "fast", feature: "design-defense" });
  });

  it("review mode: once transcript.length reaches maxTurns, asks for a holistic review instead of another question", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({
      score: 130,
      verdict: "Solid defense.",
      good: ["Justified the cache choice well"],
      missed: [],
      tip: "Consider discussing failure modes.",
    });
    const transcript = Array.from({ length: 3 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const result = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, transcript, 3);
    expect(result.done).toBe(true);
    expect(result.review).toEqual({
      score: 100,
      verdict: "Solid defense.",
      good: ["Justified the cache choice well"],
      missed: [],
      tip: "Consider discussing failure modes.",
    });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "smart", feature: "design-defense" });
  });

  it("chatJson() returning null in ask mode is retryable, not terminal", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, [], 3);
    expect(result).toEqual({ offline: true, retryable: true, done: false, question: "", review: null, turnNumber: 1, maxTurns: 3 });
  });

  it("chatJson() returning null in review mode is also retryable", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const transcript = Array.from({ length: 3 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const result = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, transcript, 3);
    expect(result.offline).toBe(true);
    expect(result.retryable).toBe(true);
    expect(result.done).toBe(false);
  });

  it("clamps maxTurns to [MIN_DEFENSE_TURNS, MAX_DEFENSE_TURNS] regardless of input", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const tooLow = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, [], 0);
    expect(tooLow.maxTurns).toBe(MIN_DEFENSE_TURNS);
    const tooHigh = await runDefenseTurn(BOOTSTRAP_USER_ID, task, diagram, [], 99);
    expect(tooHigh.maxTurns).toBe(MAX_DEFENSE_TURNS);
  });
});

describe("defense prompt builders", () => {
  const diagram: DesignDiagram = { nodes: [{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }], edges: [] };

  it("buildDefenseAskPrompt() renders the task and diagram", () => {
    const prompt = buildDefenseAskPrompt(task, diagram, []);
    expect(prompt).toContain("URL shortener");
    expect(prompt).toContain('"Client" [client]');
    expect(prompt).toContain("nothing yet");
  });

  it("buildDefenseAskPrompt() renders prior turns", () => {
    const prompt = buildDefenseAskPrompt(task, diagram, [{ q: "Why a cache?", a: "For read-heavy traffic." }]);
    expect(prompt).toContain("Why a cache?");
    expect(prompt).toContain("For read-heavy traffic.");
  });

  it("buildDefenseReviewPrompt() renders the full discussion", () => {
    const transcript = [{ q: "Q1", a: "A1" }];
    const prompt = buildDefenseReviewPrompt(task, diagram, transcript);
    expect(prompt).toContain("Q1");
    expect(prompt).toContain("A1");
  });
});
