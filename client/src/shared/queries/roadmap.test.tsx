import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useSetRoadmapStatus, useSetSkillLevel } from "./roadmap";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { RoadmapData } from "../types";

vi.mock("../api", () => ({
  api: {
    setRoadmapStatus: vi.fn(),
    setSkillLevel: vi.fn(),
    roadmap: vi.fn(),
  },
}));

import { api } from "../api";

function makeFixture(overrides: Partial<RoadmapData["groups"][0]["nodes"][0]> = {}): RoadmapData {
  return {
    groups: [
      {
        group: "Frontend",
        nodes: [
          {
            tech: "React",
            group: "Frontend",
            demand: 10,
            known: true,
            status: "todo",
            learn: [],
            resources: [],
            drillsTotal: 0,
            drillsSolved: 0,
            level: 40,
            levelAuto: 40,
            levelManual: null,
            levelParts: { status: 0, drills: null, recall: null },
            cardsTotal: 0,
            cardsGraded: 0,
            practiceCat: "React",
            practiceShared: false,
            ...overrides,
          },
        ],
      },
    ],
    progress: { done: 0, learning: 0, total: 1 },
  };
}

describe("useSetRoadmapStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the status change optimistically before the request resolves", async () => {
    let resolveRequest: (v: { ok: boolean }) => void = () => {};
    vi.mocked(api.setRoadmapStatus).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    vi.mocked(api.roadmap).mockResolvedValue(makeFixture({ status: "done" }));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetRoadmapStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ tech: "React", status: "done" });
    });

    // The optimistic update is applied synchronously, before the server responds.
    await waitFor(() => {
      const cached = queryClient.getQueryData<RoadmapData>(queryKeys.roadmap);
      expect(cached?.groups[0].nodes[0].status).toBe("done");
      expect(cached?.progress.done).toBe(1);
    });

    resolveRequest({ ok: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Status feeds into the server-computed level (skill-level.ts) — the client doesn't duplicate
    // that formula, so the roadmap query must be invalidated once the mutation settles (there's no
    // active useRoadmap() observer in this test, so it's marked stale rather than actually refetched).
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.roadmap)?.isInvalidated).toBe(true));
  });

  it("rolls back the optimistic update when the request fails", async () => {
    vi.mocked(api.setRoadmapStatus).mockRejectedValue(new Error("network down"));
    vi.mocked(api.roadmap).mockResolvedValue(makeFixture());

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetRoadmapStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ tech: "React", status: "done" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<RoadmapData>(queryKeys.roadmap);
    expect(cached?.groups[0].nodes[0].status).toBe("todo");
    expect(cached?.progress.done).toBe(0);
  });
});

describe("useSetSkillLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically sets both level and levelManual before the request resolves", async () => {
    let resolveRequest: (v: { ok: boolean; levels: Record<string, number> }) => void = () => {};
    vi.mocked(api.setSkillLevel).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetSkillLevel(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ tech: "React", level: 90 });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<RoadmapData>(queryKeys.roadmap);
      expect(cached?.groups[0].nodes[0].level).toBe(90);
      expect(cached?.groups[0].nodes[0].levelManual).toBe(90);
    });

    resolveRequest({ ok: true, levels: { React: 90 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("clearing the override (level: null) optimistically resets to the node's own levelAuto", async () => {
    let resolveRequest: (v: { ok: boolean; levels: Record<string, number> }) => void = () => {};
    vi.mocked(api.setSkillLevel).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, makeFixture({ level: 90, levelManual: 90, levelAuto: 40 }));
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetSkillLevel(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ tech: "React", level: null });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<RoadmapData>(queryKeys.roadmap);
      expect(cached?.groups[0].nodes[0].level).toBe(40);
      expect(cached?.groups[0].nodes[0].levelManual).toBeNull();
    });

    resolveRequest({ ok: true, levels: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back the optimistic update when the request fails", async () => {
    vi.mocked(api.setSkillLevel).mockRejectedValue(new Error("network down"));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetSkillLevel(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ tech: "React", level: 90 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<RoadmapData>(queryKeys.roadmap);
    expect(cached?.groups[0].nodes[0].level).toBe(40);
    expect(cached?.groups[0].nodes[0].levelManual).toBeNull();
  });
});
