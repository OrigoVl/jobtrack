import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./keys";
import { useSetResourcesFocus } from "./resources";
import { createQueryWrapper, createTestQueryClient } from "../../test/query-test-utils";
import type { ResourcesData } from "../types";

vi.mock("../api", () => ({
  api: {
    setResourcesFocus: vi.fn(),
    resources: vi.fn(),
  },
}));

import { api } from "../api";

function makeFixture(overrides: Partial<ResourcesData> = {}): ResourcesData {
  return {
    bestPractices: [],
    platforms: [],
    cheat: [],
    checklist: [],
    focus: "Priority: Kafka — these show up often in your vacancies but aren't in your profile yet.",
    focusCustom: false,
    focusSuggestions: ["Kafka", "Docker"],
    ...overrides,
  };
}

describe("useSetResourcesFocus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("patches the cached focus from the server's echo instead of refetching", async () => {
    vi.mocked(api.setResourcesFocus).mockResolvedValue({ ok: true, focus: "Finish the Kafka course.", focusCustom: true });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.resources, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetResourcesFocus(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate("Finish the Kafka course.");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = queryClient.getQueryData<ResourcesData>(queryKeys.resources);
    expect(cached?.focus).toBe("Finish the Kafka course.");
    expect(cached?.focusCustom).toBe(true);
    // Everything else the page is built from stays untouched by the patch.
    expect(cached?.focusSuggestions).toEqual(["Kafka", "Docker"]);
    expect(queryClient.getQueryState(queryKeys.resources)?.isInvalidated).toBe(false);
  });

  it("refetches instead of patching when the override is cleared back to auto", async () => {
    vi.mocked(api.setResourcesFocus).mockResolvedValue({ ok: true, focus: "", focusCustom: false });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.resources, makeFixture({ focus: "Finish the Kafka course.", focusCustom: true }));
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetResourcesFocus(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate("");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The regenerated automatic focus only exists server-side — the empty `focus` in the response
    // must NOT be written into the cache as if it were the new note.
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.resources)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryData<ResourcesData>(queryKeys.resources)?.focus).toBe("Finish the Kafka course.");
  });

  it("surfaces a failed save as an error without touching the cache", async () => {
    vi.mocked(api.setResourcesFocus).mockRejectedValue(new Error("network down"));

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.resources, makeFixture());
    const { Wrapper } = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useSetResourcesFocus(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate("Finish the Kafka course.");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = queryClient.getQueryData<ResourcesData>(queryKeys.resources);
    expect(cached?.focus).toBe("Priority: Kafka — these show up often in your vacancies but aren't in your profile yet.");
    expect(cached?.focusCustom).toBe(false);
  });
});
