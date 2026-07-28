import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useSetRoadmapStatus } from "./roadmap";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { RoadmapData } from "../types";

vi.mock("../api", () => ({
  api: {
    setRoadmapStatus: vi.fn(),
  },
}));

import { api } from "../api";

const roadmapFixture: RoadmapData = {
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
        },
      ],
    },
  ],
  progress: { done: 0, learning: 0, total: 1 },
};

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

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, roadmapFixture);
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
  });

  it("rolls back the optimistic update when the request fails", async () => {
    vi.mocked(api.setRoadmapStatus).mockRejectedValue(new Error("network down"));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.roadmap, roadmapFixture);
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
