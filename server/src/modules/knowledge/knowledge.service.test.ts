// Contract test for the offline fallback at the service level (not just the LLM client): when
// llmAvailable() returns false, getDynamicKnowledge() must transparently return static content
// from knowledge-base.ts (source: "static", focus: null) and NOT touch the kv cache or chat().
//
// Both db/index.js and llm/index.js are fully mocked — the test is isolated from real
// node:sqlite (which vitest can't transform transitively) and from the network, and checks
// only knowledge.service.ts's own branching logic on the llmAvailable() flag.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/index.js", () => ({
  getKvJson: vi.fn(() => null),
  setKvJson: vi.fn(),
}));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import { getDynamicKnowledge } from "./knowledge.service.js";
import { getKvJson } from "../../db/index.js";
import { chatJson, llmAvailable } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

describe("getDynamicKnowledge() offline fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns static knowledge-base content without touching kv cache or chat()", async () => {
    const result = await getDynamicKnowledge(BOOTSTRAP_USER_ID, "React", {
      profile: { skills: ["JavaScript"], domain: "Frontend" },
      demand: { React: 5 },
    });

    expect(result.source).toBe("static");
    expect(result.focus).toBeNull();
    expect(result.learn.length).toBeGreaterThan(0);
    expect(getKvJson).not.toHaveBeenCalled();
    expect(chatJson).not.toHaveBeenCalled();
  });
});

// Prompt-grounding: getDynamicKnowledge() already computes `base = kbFor(tech, track)` for its
// own offline fallback — these tests prove that same curated content also reaches the LLM prompt
// (not just the fallback path), and that an uncurated tech (no real knowledge-base.ts entry)
// doesn't pollute the prompt with kbFor()'s generic "start with the docs" filler.
describe("getDynamicKnowledge() online — grounds the prompt in the curated knowledge base", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(getKvJson).mockResolvedValue(null);
    vi.mocked(chatJson).mockResolvedValue({
      focus: "Focus on hooks.",
      learn: ["Hooks basics"],
      resources: [],
    });
  });

  it("includes curated learn bullets and resources in the prompt for a real KB entry", async () => {
    await getDynamicKnowledge(BOOTSTRAP_USER_ID, "React", {
      profile: { skills: ["JavaScript"], domain: "Frontend" },
      demand: { React: 5 },
    });

    expect(chatJson).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(chatJson).mock.calls[0]![2] as string;
    expect(prompt).toContain("Reference material");
    expect(prompt).toContain("Hooks");
    expect(prompt).toContain("react.dev");
  });

  it("does not add a grounding block for a tech with no curated entry", async () => {
    await getDynamicKnowledge(BOOTSTRAP_USER_ID, "SomeMadeUpFrameworkXYZ", {
      profile: { skills: [], domain: "Frontend" },
      demand: {},
    });

    const prompt = vi.mocked(chatJson).mock.calls[0]![2] as string;
    expect(prompt).not.toContain("Reference material");
  });
});
