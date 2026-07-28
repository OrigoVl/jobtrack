import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runJs } from "./runner";

// runJs() creates a REAL Web Worker — jsdom (the unit test environment, see vitest.config.ts)
// doesn't implement it, and testing a real infinite loop in e2e would be non-deterministic (a
// real busy-loop in a CI/sandboxed environment with few cores competes for CPU with the browser
// itself — see the comment in e2e/study-js-sandbox.spec.ts). Here we mock the global Worker with
// a fully controlled fake, to deterministically and quickly (without a real 3s wait) check
// exactly the part of the contract that matters most here: the timeout forcibly kills the worker
// and resolves exactly once, even if a message from the worker still arrives "too late".
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;
  posted: unknown[] = [];

  constructor(public url: string) {
    FakeWorker.instances.push(this);
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  terminate(): void {
    this.terminated = true;
  }
  // Test helper (not part of the real Worker API) — simulates the worker's response.
  respond(result: { logs: string[]; error: string | null; ms: number }): void {
    this.onmessage?.({ data: result } as MessageEvent);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:fake-url"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("runJs()", () => {
  it("resolves with the worker's result and terminates it when the worker responds in time", async () => {
    const promise = runJs("console.log(1)");
    const worker = FakeWorker.instances[0]!;
    worker.respond({ logs: ["1"], error: null, ms: 5 });

    const result = await promise;

    expect(result).toEqual({ logs: ["1"], error: null, ms: 5 });
    expect(worker.terminated).toBe(true);
  });

  it("terminates the worker and resolves with a timeout error if it never responds (simulates an infinite loop)", async () => {
    const promise = runJs("while (true) {}");
    const worker = FakeWorker.instances[0]!;

    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(worker.terminated).toBe(true);
    expect(result.error).toMatch(/Execution time limit exceeded/);
    expect(result.logs).toEqual([]);
  });

  it("does not resolve a second time if the worker responds AFTER the timeout already fired", async () => {
    const promise = runJs("while (true) {}");
    const worker = FakeWorker.instances[0]!;

    await vi.advanceTimersByTimeAsync(3000);
    const timedOutResult = await promise;
    // A late worker response — should be safely ignored (the worker is already terminate()'d
    // and the Promise is already settled): without the "settled" flag in runner.ts, the second
    // response would try to resolve an already-settled Promise (a safe no-op per the Promise
    // spec, but semantically it would mean "forgot to clean up the handlers" — the timer and
    // listener would stay alive).
    worker.respond({ logs: ["too late"], error: null, ms: 9999 });

    expect(timedOutResult.error).toMatch(/Execution time limit exceeded/);
  });

  it("passes the raw code string to the worker unmodified", () => {
    void runJs("console.log(42)");
    const worker = FakeWorker.instances[0]!;
    expect(worker.posted).toEqual(["console.log(42)"]);
  });
});
