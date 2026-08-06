import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useGenerateDesignTask, useGradeDesign } from "./design";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { DesignExercise, DesignGrade, DesignTask } from "../types";

vi.mock("../api", () => ({
  api: {
    designTask: vi.fn(),
    designGrade: vi.fn(),
  },
}));

import { api } from "../api";

const task: DesignTask = {
  title: "URL shortener",
  scenario: "Design a service that shortens long URLs.",
  requirements: ["Handle 1000 req/s"],
  constraints: [],
  difficulty: "medium",
};

describe("useGenerateDesignTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds the current-exercise cache with the new task and an empty diagram on success", async () => {
    vi.mocked(api.designTask).mockResolvedValue({ offline: false, task });

    const queryClient = createTestQueryClient();
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useGenerateDesignTask(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<DesignExercise>(queryKeys.designCurrent)).toEqual({
      task,
      diagram: { nodes: [], edges: [] },
      grade: null,
    });
  });

  it("leaves the cache untouched when the AI is offline (no task generated)", async () => {
    vi.mocked(api.designTask).mockResolvedValue({ offline: true, task: null });

    const queryClient = createTestQueryClient();
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useGenerateDesignTask(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<DesignExercise>(queryKeys.designCurrent)).toBeUndefined();
  });
});

describe("useGradeDesign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the task/diagram/grade as the current exercise on success", async () => {
    const grade: DesignGrade = { score: 80, summary: "Good.", criteria: [], strengths: [], missed: [], tip: "" };
    vi.mocked(api.designGrade).mockResolvedValue(grade);
    const diagram = { nodes: [{ id: "1", kind: "client" as const, label: "Client", x: 0, y: 0 }], edges: [] };

    const queryClient = createTestQueryClient();
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useGradeDesign(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ task, diagram });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<DesignExercise>(queryKeys.designCurrent)).toEqual({ task, diagram, grade });
  });

  it("invalidates the history cache on success (server appends an entry per grade)", async () => {
    const grade: DesignGrade = { score: 80, summary: "Good.", criteria: [], strengths: [], missed: [], tip: "" };
    vi.mocked(api.designGrade).mockResolvedValue(grade);
    const diagram = { nodes: [], edges: [] };

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { Wrapper } = createQueryWrapper(queryClient);
    const { result } = renderHook(() => useGradeDesign(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ task, diagram });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.designHistory });
  });
});
