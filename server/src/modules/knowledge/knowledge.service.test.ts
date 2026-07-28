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
import { chatJson } from "../../llm/index.js";

describe("getDynamicKnowledge() offline fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns static knowledge-base content without touching kv cache or chat()", async () => {
    const result = await getDynamicKnowledge("React", {
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
