// Contract tests for getDynamicResources(): the static guide (resources.data.ts) gets ranked
// and flagged against the caller's own profile skills + vacancy-derived demand, with a
// deterministic offline fallback for the personalized "focus" note — mirrors
// knowledge.service.test.ts's offline-fallback contract, one level up (whole sections, not a
// single tech's learn/resources).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

vi.mock("../../db/index.js", () => ({
  getProfile: vi.fn(),
  getKvJson: vi.fn(async () => null),
  setKvJson: vi.fn(),
}));
vi.mock("../../shared/demand.js", () => ({ demandMap: vi.fn(), gapPriorityMap: vi.fn() }));
vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import { getProfile, getKvJson, setKvJson } from "../../db/index.js";
import { demandMap, gapPriorityMap } from "../../shared/demand.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { getDynamicResources, getFocusOverride, setFocusOverride } from "./resources.service.js";

const getProfileMock = vi.mocked(getProfile);
const getKvJsonMock = vi.mocked(getKvJson);
const setKvJsonMock = vi.mocked(setKvJson);
const demandMapMock = vi.mocked(demandMap);
const gapPriorityMapMock = vi.mocked(gapPriorityMap);
const llmAvailableMock = vi.mocked(llmAvailable);
const chatJsonMock = vi.mocked(chatJson);

describe("getDynamicResources()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmAvailableMock.mockReturnValue(false);
  });

  it("prepends a synthesized 'for you' group and ranks React to the top of the static guide when React is a gap", async () => {
    getProfileMock.mockResolvedValue({ skills: ["Vue", "Node.js"], cvText: "", domain: "Frontend" });
    demandMapMock.mockResolvedValue({ React: 8, Vue: 2 });
    // gapPriority never includes a known skill's own key (unlike raw demand, which counts every
    // mention regardless) — Vue is known, so only React shows up here, same as real semantics.
    gapPriorityMapMock.mockResolvedValue({ React: 8 });

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    // A brand-new group synthesized from the roadmap's own curated React resources — real content,
    // not just a reordering of the static guide.
    expect(result.bestPractices[0]!.group).toContain("For you");
    expect(result.bestPractices[0]!.links.length).toBeGreaterThan(0);
    // The static guide itself keeps all 5 groups, just reordered — React/Frontend now on top of those.
    const staticGroups = result.bestPractices.slice(1);
    expect(staticGroups).toHaveLength(5);
    expect(staticGroups[0]!.group).toBe("React / Frontend");
    expect(staticGroups[0]!.gapTechs).toContain("React");
    expect(result.focus).toContain("React");
    // The checklist gets a prepended, gap-specific action too (not present in the static list at all).
    expect(result.checklist[0]!.text).toContain("React");
    expect(result.checklist[0]!.relevant).toBe(true);
  });

  it("keeps the guide's original order when there is no vacancy data yet", async () => {
    getProfileMock.mockResolvedValue({ skills: [], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({});
    gapPriorityMapMock.mockResolvedValue({});

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.bestPractices.map((g) => g.group)).toEqual([
      "JavaScript / TypeScript",
      "Node.js / Backend",
      "React / Frontend",
      "Architecture, Databases, System Design",
      "Interview Preparation",
    ]);
    expect(result.focus).toMatch(/add vacancies/i);
    // The manual-override lookup is the ONLY kv read on this path — with no gaps there's nothing
    // to cache a generated focus/actions for.
    expect(getKvJsonMock).toHaveBeenCalledExactlyOnceWith(BOOTSTRAP_USER_ID, "resources-focus-override");
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("reorders the static checklist by relevance and prepends a synthesized gap action", async () => {
    getProfileMock.mockResolvedValue({ skills: [], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({ Docker: 5 });
    gapPriorityMapMock.mockResolvedValue({ Docker: 5 });

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    // Prepended synthesized action (not part of the static 17-item guide).
    expect(result.checklist[0]!.text).toContain("Docker");
    expect(result.checklist[0]!.relevant).toBe(true);
    // The static Docker item(s) are now ranked above unrelated ones, but the guide's own items
    // are all still present underneath.
    const staticChecklist = result.checklist.slice(1);
    expect(staticChecklist).toHaveLength(17);
    const dockerItem = staticChecklist.find((c) => c.text.startsWith("Docker:"));
    expect(dockerItem?.relevant).toBe(true);
    expect(staticChecklist[0]!.text.startsWith("Docker:")).toBe(true);
  });

  it("says there are no major gaps when demand is fully covered by profile skills", async () => {
    getProfileMock.mockResolvedValue({ skills: ["React", "Vue", "Docker"], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({ React: 3 });
    gapPriorityMapMock.mockResolvedValue({});

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.focus).toMatch(/no major gaps/i);
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("uses the LLM-personalized focus and checklist action, caching both, when available", async () => {
    getProfileMock.mockResolvedValue({ skills: ["Vue"], cvText: "", domain: "Frontend" });
    demandMapMock.mockResolvedValue({ React: 9 });
    gapPriorityMapMock.mockResolvedValue({ React: 9 });
    llmAvailableMock.mockReturnValue(true);
    // Called in order: getFocusNote() first, then getPersonalizedActions().
    chatJsonMock
      .mockResolvedValueOnce({ focus: "Spend this week on React — it dominates your pipeline." })
      .mockResolvedValueOnce({ actions: ["Build a tiny React counter app with TanStack Query."] });

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.focus).toBe("Spend this week on React — it dominates your pipeline.");
    expect(result.checklist[0]!.text).toBe("Build a tiny React counter app with TanStack Query.");
    expect(setKvJsonMock).toHaveBeenCalledTimes(2);
  });

  it("offers the top 5 gaps as focus suggestions while still personalizing on the top 3", async () => {
    getProfileMock.mockResolvedValue({ skills: [], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({});
    gapPriorityMapMock.mockResolvedValue({ React: 9, Docker: 8, AWS: 7, GraphQL: 6, Redis: 5, Kafka: 4 });

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.focusSuggestions).toEqual(["React", "Docker", "AWS", "GraphQL", "Redis"]);
    // The sections themselves keep acting on the top 3 only — suggestions are a wider menu.
    expect(result.focus).toBe("Priority: React, Docker, AWS — these show up often in your vacancies but aren't in your profile yet.");
    expect(result.focusCustom).toBe(false);
  });

  it("lets a user-set focus win over the generated one, without spending an LLM call on it", async () => {
    getProfileMock.mockResolvedValue({ skills: ["Vue"], cvText: "", domain: "Frontend" });
    demandMapMock.mockResolvedValue({ React: 9 });
    gapPriorityMapMock.mockResolvedValue({ React: 9 });
    llmAvailableMock.mockReturnValue(true);
    getKvJsonMock.mockImplementation(async (_userId, key) =>
      key === "resources-focus-override" ? { text: "Finish the Kafka course." } : null,
    );
    chatJsonMock.mockResolvedValue({ actions: ["Build a tiny React counter app."] });

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.focus).toBe("Finish the Kafka course.");
    expect(result.focusCustom).toBe(true);
    // Only getPersonalizedActions() called the LLM — the focus note never ran.
    expect(chatJsonMock).toHaveBeenCalledTimes(1);
    // Still suggests gaps, so the edit UI has something to offer next time.
    expect(result.focusSuggestions).toEqual(["React"]);
  });

  it("treats a blank override as no override at all", async () => {
    getProfileMock.mockResolvedValue({ skills: [], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({});
    gapPriorityMapMock.mockResolvedValue({});
    getKvJsonMock.mockImplementation(async (_userId, key) => (key === "resources-focus-override" ? { text: "   " } : null));

    const result = await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(result.focusCustom).toBe(false);
    expect(result.focus).toMatch(/add vacancies/i);
  });
});

// Prompt-grounding: getFocusNote()/getPersonalizedActions() already had a deterministic offline
// fallback pulling straight from kbFor()'s curated `learn` bullets — these tests prove the same
// curated content also reaches both LLM prompts (not just the fallback), and that a gap tech with
// no real knowledge-base.ts entry doesn't add a useless grounding block.
describe("getDynamicResources() — grounds the focus/actions prompts in the curated knowledge base", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmAvailableMock.mockReturnValue(true);
  });

  it("includes curated topics for a gap that has a real KB entry", async () => {
    getProfileMock.mockResolvedValue({ skills: ["Vue"], cvText: "", domain: "Frontend" });
    demandMapMock.mockResolvedValue({ React: 9 });
    gapPriorityMapMock.mockResolvedValue({ React: 9 });
    chatJsonMock
      .mockResolvedValueOnce({ focus: "Spend this week on React." })
      .mockResolvedValueOnce({ actions: ["Build a tiny React app."] });

    await getDynamicResources(BOOTSTRAP_USER_ID, false);

    expect(chatJsonMock).toHaveBeenCalledTimes(2);
    const focusPrompt = chatJsonMock.mock.calls[0]![2] as string;
    const actionsPrompt = chatJsonMock.mock.calls[1]![2] as string;
    expect(focusPrompt).toContain("Reference material");
    expect(focusPrompt).toContain("React:");
    expect(actionsPrompt).toContain("Reference material");
    expect(actionsPrompt).toContain("React:");
  });

  it("does not add a grounding block for a gap tech with no curated entry", async () => {
    getProfileMock.mockResolvedValue({ skills: [], cvText: "", domain: "" });
    demandMapMock.mockResolvedValue({ SomeMadeUpTechXYZ: 9 });
    gapPriorityMapMock.mockResolvedValue({ SomeMadeUpTechXYZ: 9 });
    chatJsonMock.mockResolvedValueOnce({ focus: "Spend this week on it." }).mockResolvedValueOnce({ actions: ["Practice it."] });

    await getDynamicResources(BOOTSTRAP_USER_ID, false);

    const focusPrompt = chatJsonMock.mock.calls[0]![2] as string;
    const actionsPrompt = chatJsonMock.mock.calls[1]![2] as string;
    expect(focusPrompt).not.toContain("Reference material");
    expect(actionsPrompt).not.toContain("Reference material");
  });
});

describe("setFocusOverride()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the trimmed text and reads it back", async () => {
    const stored = await setFocusOverride(BOOTSTRAP_USER_ID, "  Ship the CI/CD pipeline.  ");

    expect(stored).toBe("Ship the CI/CD pipeline.");
    expect(setKvJsonMock).toHaveBeenCalledWith(BOOTSTRAP_USER_ID, "resources-focus-override", { text: "Ship the CI/CD pipeline." });
  });

  it("caps an over-long override instead of rejecting it", async () => {
    const stored = await setFocusOverride(BOOTSTRAP_USER_ID, "x".repeat(500));

    expect(stored).toHaveLength(300);
  });

  it("clears back to auto on a blank text", async () => {
    const stored = await setFocusOverride(BOOTSTRAP_USER_ID, "   ");

    expect(stored).toBe("");
    expect(setKvJsonMock).toHaveBeenCalledWith(BOOTSTRAP_USER_ID, "resources-focus-override", { text: "" });
  });

  it("reports an empty override as none", async () => {
    getKvJsonMock.mockResolvedValue({ text: "" });

    expect(await getFocusOverride(BOOTSTRAP_USER_ID)).toBe("");
  });
});
