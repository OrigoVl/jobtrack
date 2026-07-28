import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useSetPlanDay } from "./plan21";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { Plan21Data } from "../types";

vi.mock("../api", () => ({
  api: {
    setPlanDay: vi.fn(),
  },
}));

import { api } from "../api";

const plan21Fixture: Plan21Data = {
  phases: [
    {
      id: "phase-1",
      title: "Phase 1",
      range: "1-7",
      days: [{ id: "day-1", day: 1, theory: "Basics", practice: "Practice" }],
    },
  ],
  progress: { "day-1": false },
};

describe("useSetPlanDay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the day done optimistically before the server responds", async () => {
    let resolveRequest: (v: { ok: boolean }) => void = () => {};
    vi.mocked(api.setPlanDay).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.plan21, plan21Fixture);
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useSetPlanDay(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ dayId: "day-1", done: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<Plan21Data>(queryKeys.plan21)?.progress["day-1"]).toBe(true);
    });

    resolveRequest({ ok: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("reverts to the previous progress map when the request fails", async () => {
    vi.mocked(api.setPlanDay).mockRejectedValue(new Error("network down"));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.plan21, plan21Fixture);
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useSetPlanDay(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ dayId: "day-1", done: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<Plan21Data>(queryKeys.plan21)?.progress["day-1"]).toBe(false);
  });
});
