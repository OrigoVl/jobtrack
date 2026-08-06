// getDynamicProjects() branching: offline fallback, no-gaps fallback, cache hit, a fresh AI
// generation, and the per-slot fallback when the LLM returns something chatJson's schema/repair
// couldn't salvage. Both db/index.js and llm/index.js are fully mocked — isolated from real
// node:sqlite and the network, same approach as knowledge.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock's factory is hoisted above any top-level const — vi.hoisted() runs alongside it so
// these are safe to reference inside the factories below (same fix knowledge.service.test.ts
// avoids needing by inlining vi.fn() calls directly; here the fns are also reused in assertions).
const { getKvJson, setKvJson, llmAvailable, chatJson } = vi.hoisted(() => ({
  getKvJson: vi.fn(),
  setKvJson: vi.fn(),
  llmAvailable: vi.fn(() => true),
  chatJson: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({ getKvJson, setKvJson }));
vi.mock("../../llm/index.js", () => ({ llmAvailable, chatJson }));

import { getDynamicProjects } from "./projects.service.js";
import { PROJECTS } from "./projects.data.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

// Most cases below pass the same map as both `demand` and `gapPriority` — these tests aren't
// about the set-cover math itself (shared/demand.test.ts's computeGapPriority() job), only about
// getDynamicProjects()'s own branching given an already-ranked gap list. The dedicated
// "ranks by gapPriority, not demand" test is the one that proves the two inputs are independent.
describe("getDynamicProjects()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmAvailable.mockReturnValue(true);
    getKvJson.mockResolvedValue(null);
  });

  it("falls back to the static ladder without touching kv cache or chat() when the LLM is offline", async () => {
    llmAvailable.mockReturnValue(false);
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: [] },
      demand: { React: 5 },
      gapPriority: { React: 5 },
    });
    expect(result).toEqual({ projects: PROJECTS, personalized: false });
    expect(getKvJson).not.toHaveBeenCalled();
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("falls back to the static ladder when the candidate's skills already cover all market demand", async () => {
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: ["React", "TypeScript"] },
      demand: { React: 5, TypeScript: 3 },
      gapPriority: {},
    });
    expect(result).toEqual({ projects: PROJECTS, personalized: false });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("returns a cached personalized project without calling chat() again", async () => {
    getKvJson.mockResolvedValue({ name: "Cached Idea", subtitle: "sub", goal: "goal", tech: ["React", "Redux"], dod: ["Ship it"] });
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: [] },
      demand: { React: 4 },
      gapPriority: { React: 4 },
    });
    expect(chatJson).not.toHaveBeenCalled();
    expect(result.personalized).toBe(true);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).toMatchObject({ id: "p-react", name: "Cached Idea", personalized: true });
    expect(result.projects[0]?.dod).toEqual([{ id: "p-react-dod-0", text: "Ship it" }]);
  });

  it("generates and caches a fresh personalized project when nothing is cached yet", async () => {
    chatJson.mockResolvedValue({ name: "Bridge Builder", subtitle: "sub", goal: "goal", tech: ["React", "GraphQL"], dod: ["A", "B"] });
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: ["React"] },
      demand: { GraphQL: 6 },
      gapPriority: { GraphQL: 6 },
    });
    expect(chatJson).toHaveBeenCalledTimes(1);
    expect(setKvJson).toHaveBeenCalledTimes(1);
    expect(result.projects[0]).toMatchObject({ id: "p-graphql", name: "Bridge Builder", personalized: true });
  });

  it("falls back to the matching static project by position when the LLM returns nothing usable", async () => {
    chatJson.mockResolvedValue(null);
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: [] },
      demand: { React: 5 },
      gapPriority: { React: 5 },
    });
    expect(setKvJson).not.toHaveBeenCalled();
    expect(result.projects[0]).toEqual(PROJECTS[0]);
    expect(result.personalized).toBe(false);
  });

  it("mixes personalized and static-fallback cards, and reports personalized:true if any slot succeeded", async () => {
    chatJson.mockResolvedValueOnce({ name: "Idea A", subtitle: "s", goal: "g", tech: ["React"], dod: ["A"] }).mockResolvedValueOnce(null);
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: [] },
      demand: { React: 5, Vue: 4 },
      gapPriority: { React: 5, Vue: 4 },
    });
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]?.personalized).toBe(true);
    expect(result.projects[1]).toEqual(PROJECTS[1]);
    expect(result.personalized).toBe(true);
  });

  it("picks and orders gap projects by gapPriority, NOT by raw demand — the two can disagree", async () => {
    getKvJson.mockResolvedValue({ name: "Idea", subtitle: "s", goal: "g", tech: ["X"], dod: ["A"] });
    // Docker has more raw mentions (demand), but AWS is the higher set-cover priority — the
    // generated project order (and which techs get a slot at all when capped) must follow
    // gapPriority.
    const result = await getDynamicProjects(BOOTSTRAP_USER_ID, {
      profile: { skills: [] },
      demand: { Docker: 10, AWS: 4 },
      gapPriority: { Docker: 1, AWS: 9 },
    });
    expect(result.projects.map((p) => p.id)).toEqual(["p-aws", "p-docker"]);
  });
});
