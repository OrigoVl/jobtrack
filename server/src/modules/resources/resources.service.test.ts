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
import { getDynamicResources } from "./resources.service.js";

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
    expect(getKvJsonMock).not.toHaveBeenCalled();
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
});
