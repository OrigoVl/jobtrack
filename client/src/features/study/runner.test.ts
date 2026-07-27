import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runJs } from "./runner";

// runJs() створює РЕАЛЬНИЙ Web Worker — jsdom (середовище для юніт-тестів, див. vitest.config.ts)
// його не реалізує, а перевіряти справжній нескінченний цикл у e2e недетерміновано (реальний
// busy-loop у CI/sandboxed середовищі з малою к-стю ядер конкурує за CPU з самим браузером —
// див. коментар у e2e/study-js-sandbox.spec.ts). Тут мокаємо глобальний Worker повністю
// контрольованим фейком, щоб детерміновано й швидко (без реального очікування 3с) перевірити
// САМЕ ту частину контракту, яка тут найважливіша: таймаут форсовано вбиває воркер і резолвить
// рівно один раз, навіть якщо повідомлення від воркера все ж прийде "запізно".
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
  // Тестовий хелпер (не частина реального Worker API) — симулює відповідь воркера.
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
    expect(result.error).toMatch(/ліміт часу виконання/);
    expect(result.logs).toEqual([]);
  });

  it("does not resolve a second time if the worker responds AFTER the timeout already fired", async () => {
    const promise = runJs("while (true) {}");
    const worker = FakeWorker.instances[0]!;

    await vi.advanceTimersByTimeAsync(3000);
    const timedOutResult = await promise;
    // Пізня відповідь воркера — має бути безпечно ігнорована (worker уже terminate()-нутий,
    // а Promise уже settled): без "settled"-флагу в runner.ts друга відповідь спробувала б
    // резолвнути вже вирішений Promise (безпечний no-op у специфікації Promise, але семантично
    // означав би "забули прибрати обробники" — таймер і слухач лишились би живими).
    worker.respond({ logs: ["too late"], error: null, ms: 9999 });

    expect(timedOutResult.error).toMatch(/ліміт часу виконання/);
  });

  it("passes the raw code string to the worker unmodified", () => {
    void runJs("console.log(42)");
    const worker = FakeWorker.instances[0]!;
    expect(worker.posted).toEqual(["console.log(42)"]);
  });
});
