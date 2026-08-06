export interface RunResult {
  logs: string[];
  error: string | null;
  ms: number;
}

// Maximum execution time for code in the sandbox, before it's forcibly killed (worker.terminate()).
// This isn't primarily a defense against malicious code (this is a single-user local app), but
// against an infinite loop — either our own or LLM-generated (the LLM occasionally makes a
// mistake and emits a `sol` with a bug like `while (i < arr.length)` with no i++). Previously
// (new Function on the main thread, with no real timeout at all) an error like that hung the
// whole tab with no way out but a force-quit.
const EXECUTION_TIMEOUT_MS = 3000;

// The worker's code is a string, not a separate file: the sandbox is spun up once per click and
// should be as simple as possible (no separate static worker-bundle entry in the Vite build).
// The Worker is an ISOLATED context: no window/document/localStorage/cookies from the main page,
// so even code from an LLM-generated task (which we do NOT review before showing it to the user)
// can't read or change the app's state — it can only compute something and return console.log output.
const WORKER_SOURCE = `
self.onmessage = (e) => {
  const logs = [];
  const capture = (...args) => {
    logs.push(args.map((v) => {
      if (typeof v === "string") return v;
      if (v instanceof Error) return v.name + ": " + v.message;
      try { return JSON.stringify(v, (_k, x) => (x === undefined ? "undefined" : x), 2) ?? String(v); }
      catch { return String(v); }
    }).join(" "));
  };
  self.console = { log: capture, info: capture, warn: capture, error: capture, debug: capture };
  const start = performance.now();
  try {
    const fn = new Function("\\"use strict\\";\\n" + e.data);
    fn();
    self.postMessage({ logs, error: null, ms: Math.round(performance.now() - start) });
  } catch (err) {
    const message = err && err.name ? err.name + ": " + err.message : String(err);
    self.postMessage({ logs, error: message, ms: Math.round(performance.now() - start) });
  }
};
`;

/**
 * Runs arbitrary JS code in a real sandbox (a Web Worker — a separate thread/context with no
 * access to the main page's DOM/window/localStorage) with a hard timeout: if the code doesn't
 * finish within EXECUTION_TIMEOUT_MS (e.g. an infinite loop), the worker is forcibly killed
 * (`terminate()`) and an error is returned — instead of hanging the tab.
 */
export function runJs(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "application/javascript" }));
    const worker = new Worker(blobUrl);
    const start = performance.now();
    let settled = false;

    const finish = (result: RunResult): void => {
      if (settled) return; // prevent both onmessage and onTimeout from resolving the result
      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      finish({
        logs: [],
        error: `Execution time limit exceeded (${EXECUTION_TIMEOUT_MS} ms) — possibly an infinite loop.`,
        ms: Math.round(performance.now() - start),
      });
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<RunResult>) => finish(e.data);
    // onerror — a syntax error WHILE COMPILING the worker's own code, or an uncaught exception
    // outside the worker's try/catch (e.g. a bug in WORKER_SOURCE itself) — shouldn't happen in
    // theory, but without a handler a case like this would hang silently until the timeout.
    worker.onerror = (e: ErrorEvent) => finish({ logs: [], error: `${e.message}`, ms: Math.round(performance.now() - start) });

    worker.postMessage(code);
  });
}
