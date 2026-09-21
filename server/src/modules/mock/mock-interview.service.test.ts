// Contract test for the offline fallback (llmAvailable() === false must NEVER touch chatJson()),
// plus the ask/review mode split and failure handling — same mocking shape as
// contacts-outreach.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import { runInterviewTurn, buildVacancyContext, clampReview } from "./mock-interview.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { Profile, VacancyRow } from "../../db/types.js";

const profile: Profile = { skills: ["React", "TypeScript"], cvText: "", domain: "Frontend Engineer" };
const vacancy: VacancyRow = {
  id: 1,
  company: "Acme",
  position: "Senior React Developer",
  level: "Senior",
  salary: "",
  location: null,
  workMode: null,
  employmentType: null,
  url: "",
  status: "Applied",
  fit: "high",
  applied: "",
  next: "",
  nextAction: "",
  notes: "Focus on performance.",
  stack: ["React", "TypeScript"],
  created: "",
  companyId: null,
  favorite: false,
  coverLetter: "",
  coverLetterDetails: "",
};

describe("runInterviewTurn()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns a terminal offline result without calling chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const result = await runInterviewTurn(BOOTSTRAP_USER_ID, vacancy, profile, { vacancyId: 1, transcript: [], maxTurns: 6 });
    expect(result).toEqual({ offline: true, done: true, question: "", review: null, turnNumber: 1, maxTurns: 6 });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("ask mode: returns the next question with done:false while transcript.length < maxTurns", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ question: "Tell me about a challenging bug you fixed." });
    const result = await runInterviewTurn(BOOTSTRAP_USER_ID, vacancy, profile, {
      vacancyId: 1,
      transcript: [{ q: "Tell me about yourself", a: "I'm a developer." }],
      maxTurns: 6,
    });
    expect(result).toEqual({
      done: false,
      question: "Tell me about a challenging bug you fixed.",
      review: null,
      turnNumber: 2,
      maxTurns: 6,
    });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "fast" });
  });

  it("review mode: once transcript.length reaches maxTurns, asks for a holistic review instead of another question", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({
      score: 85,
      verdict: "Strong candidate.",
      good: ["Clear communication"],
      missed: [],
      tip: "Practice system design.",
    });
    const transcript = Array.from({ length: 3 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const result = await runInterviewTurn(BOOTSTRAP_USER_ID, vacancy, profile, { vacancyId: 1, transcript, maxTurns: 3 });
    expect(result.done).toBe(true);
    expect(result.review).toEqual({
      score: 85,
      verdict: "Strong candidate.",
      good: ["Clear communication"],
      missed: [],
      tip: "Practice system design.",
    });
    expect(vi.mocked(chatJson).mock.calls[0]![4]).toMatchObject({ tier: "smart" });
  });

  it("chatJson() returning null in ask mode is retryable, not terminal", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const result = await runInterviewTurn(BOOTSTRAP_USER_ID, vacancy, profile, { vacancyId: 1, transcript: [], maxTurns: 6 });
    expect(result).toEqual({ offline: true, retryable: true, done: false, question: "", review: null, turnNumber: 1, maxTurns: 6 });
  });

  it("chatJson() returning null in review mode is also retryable", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    const transcript = Array.from({ length: 6 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const result = await runInterviewTurn(BOOTSTRAP_USER_ID, vacancy, profile, { vacancyId: 1, transcript, maxTurns: 6 });
    expect(result.offline).toBe(true);
    expect(result.retryable).toBe(true);
    expect(result.done).toBe(false);
  });

  it("clamps maxTurns to [MIN_TURNS, MAX_TURNS] regardless of input", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    const tooLow = await runInterviewTurn(BOOTSTRAP_USER_ID, null, profile, { vacancyId: null, transcript: [], maxTurns: 1 });
    expect(tooLow.maxTurns).toBe(3);
    const tooHigh = await runInterviewTurn(BOOTSTRAP_USER_ID, null, profile, { vacancyId: null, transcript: [], maxTurns: 99 });
    expect(tooHigh.maxTurns).toBe(10);
  });
});

describe("clampReview()", () => {
  it("clamps and rounds an out-of-range score", () => {
    expect(clampReview({ score: 150, verdict: "", good: [], missed: [], tip: "" }).score).toBe(100);
    expect(clampReview({ score: -10, verdict: "", good: [], missed: [], tip: "" }).score).toBe(0);
    expect(clampReview({ score: 72.6, verdict: "", good: [], missed: [], tip: "" }).score).toBe(73);
  });
});

describe("buildVacancyContext()", () => {
  it("builds a vacancy-scoped context from position/company/level/stack/notes", () => {
    const context = buildVacancyContext(vacancy, profile);
    expect(context).toContain("Senior React Developer @ Acme");
    expect(context).toContain("Level: Senior");
    expect(context).toContain("Stack: React, TypeScript");
    expect(context).toContain("Focus on performance.");
  });

  it("falls back to a general interview using the candidate's profile when there's no vacancy", () => {
    const context = buildVacancyContext(null, profile);
    expect(context).toContain("Frontend Engineer");
    expect(context).toContain("React, TypeScript");
  });

  it("falls back to a generic domain when the profile has neither domain nor skills", () => {
    const context = buildVacancyContext(null, { skills: [], cvText: "" });
    expect(context).toContain("software");
  });
});
