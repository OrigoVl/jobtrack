import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useSetDrillStatus } from "./study";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { StudyState } from "../types";

vi.mock("../api", () => ({
  api: {
    setDrillStatus: vi.fn(),
  },
}));

import { api } from "../api";

const studyFixture: StudyState = {
  due: [],
  total: 0,
  learned: 0,
  streak: { current: 0, longest: 0, lastActiveDate: "" },
  drills: [{ id: "drill-1", cat: "JS", lvl: "easy", q: "?", sol: "...", exp: "..." }],
  drillProgress: {},
};

describe("useSetDrillStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the drill solved optimistically and invalidates the roadmap cache on success", async () => {
    vi.mocked(api.setDrillStatus).mockResolvedValue({ ok: true });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.study, studyFixture);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useSetDrillStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ id: "drill-1", status: "solved" });
    });

    // The card is optimistically marked solved before the server responds.
    await waitFor(() => {
      expect(queryClient.getQueryData<StudyState>(queryKeys.study)?.drillProgress["drill-1"]).toBe("solved");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The roadmap shows a counter of solved drills — that needs to be invalidated too.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.roadmap });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.drillArchive });
  });

  it("rolls back drillProgress when the server call fails", async () => {
    vi.mocked(api.setDrillStatus).mockRejectedValue(new Error("network down"));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.study, studyFixture);
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useSetDrillStatus(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ id: "drill-1", status: "solved" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<StudyState>(queryKeys.study)?.drillProgress["drill-1"]).toBeUndefined();
  });
});
