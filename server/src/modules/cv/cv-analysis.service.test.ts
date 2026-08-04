// Contract tests for matchCv()'s offline/fallback heuristic — specifically that it blends
// semanticFit (embeddings) into the keyword-overlap score instead of relying on shared tokens
// alone, and that semanticFit is attached to the response on every path (LLM success included),
// not just the offline one. matchCv has no OTHER direct tests — the LLM-success JSON-shape path
// is a thin chatJson wrapper, already covered indirectly via cv-tailor.service.test.ts's mocks.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));
vi.mock("../../llm/embeddings.js", () => ({
  semanticSimilarity: vi.fn(),
}));

import { matchCv } from "./cv-analysis.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { semanticSimilarity } from "../../llm/embeddings.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

const CV_TEXT = "Built REST APIs and dashboards with Node.js and React for three years.";
const JOB_TITLE = "Backend Engineer";
const JOB_TEXT = "Looking for someone with Node.js, PostgreSQL, and Docker experience.";

describe("matchCv() offline heuristic", () => {
  it("falls back to pure keyword overlap when embeddings are unavailable (semanticFit stays null)", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    vi.mocked(semanticSimilarity).mockResolvedValue(null);

    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    expect(result.offline).toBe(true);
    expect(result.semanticFit).toBeNull();
    // "Node.js" is the only shared token out of ["Node.js", "PostgreSQL", "Docker", "Backend", "Engineer", ...]
    // — a low but non-zero pure-keyword score.
    expect(result.score).toBeGreaterThan(0);
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("blends a high semanticFit upward, above the pure-keyword score", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    vi.mocked(semanticSimilarity).mockResolvedValue(null);
    const { score: keywordOnlyScore } = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    vi.mocked(semanticSimilarity).mockResolvedValue(0.95);
    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    expect(result.semanticFit).toBe(0.95);
    expect(result.score).toBeGreaterThan(keywordOnlyScore);
  });

  it("blends a low semanticFit downward, below the pure-keyword score", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    vi.mocked(semanticSimilarity).mockResolvedValue(null);
    const { score: keywordOnlyScore } = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    vi.mocked(semanticSimilarity).mockResolvedValue(0.05);
    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    expect(result.semanticFit).toBe(0.05);
    expect(result.score).toBeLessThan(keywordOnlyScore);
  });

  it("keeps the score within 0-100 even with semanticFit blended in", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);
    vi.mocked(semanticSimilarity).mockResolvedValue(1);

    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("still falls back to the heuristic (with the same 'llm-failed' verdict) when chatJson returns null", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);
    vi.mocked(semanticSimilarity).mockResolvedValue(0.6);

    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    expect(result.offline).toBe(true);
    expect(result.semanticFit).toBe(0.6);
    expect(result.verdict).toContain("AI didn't respond");
  });

  it("attaches semanticFit to a successful LLM result too, not just the offline path", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({
      score: 80,
      verdict: "Good fit.",
      matched: ["Node.js"],
      missing: ["Docker"],
      suggestions: [],
      tailoredSummary: "Tailored.",
    });
    vi.mocked(semanticSimilarity).mockResolvedValue(0.72);

    const result = await matchCv(BOOTSTRAP_USER_ID, CV_TEXT, JOB_TITLE, JOB_TEXT);

    expect(result.offline).toBe(false);
    expect(result.semanticFit).toBe(0.72);
    expect(result.score).toBe(80);
  });
});
