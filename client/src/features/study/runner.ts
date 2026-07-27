export interface RunResult {
  logs: string[];
  error: string | null;
  ms: number;
}

// Максимальний час виконання коду в пісочниці, перш ніж її форсовано вбити (worker.terminate()).
// Потрібен насамперед НЕ проти зловмисного коду (це однокористувацький локальний застосунок),
// а проти нескінченного циклу — власного чи згенерованого LLM (LLM іноді помиляється й видає
// `sol` з багом типу `while (i < arr.length)` без i++). Раніше (new Function на головному потоці,
// без жодного реального таймауту) така помилка вішала всю вкладку без порятунку крім force-quit.
const EXECUTION_TIMEOUT_MS = 3000;

// Код воркера — рядок, а не окремий файл: пісочниця запускається одноразово на клік і має бути
// максимально простою (без окремого запису у Vite-збірку статичного worker-бандла). Worker —
// ІЗОЛЬОВАНИЙ контекст: немає window/document/localStorage/cookies головної сторінки, тож навіть
// код із LLM-згенерованого завдання (яке ми НЕ переглядаємо перед показом користувачу) не може
// прочитати чи змінити стан застосунку — лише порахувати щось і повернути console.log-виведення.
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
 * Запускає довільний JS-код у справжній пісочниці (Web Worker — окремий потік/контекст без
 * доступу до DOM/window/localStorage головної сторінки) з жорстким таймаутом: якщо код не
 * завершився за EXECUTION_TIMEOUT_MS (напр. нескінченний цикл), воркер форсовано вбивається
 * (`terminate()`) і повертається помилка — замість підвішування вкладки.
 */
export function runJs(code: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "application/javascript" }));
    const worker = new Worker(blobUrl);
    const start = performance.now();
    let settled = false;

    const finish = (result: RunResult): void => {
      if (settled) return; // не даємо onmessage і onTimeout обом резолвнути результат
      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      finish({ logs: [], error: `⏱ Перевищено ліміт часу виконання (${EXECUTION_TIMEOUT_MS} мс) — можливо, нескінченний цикл.`, ms: Math.round(performance.now() - start) });
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<RunResult>) => finish(e.data);
    // onerror — синтаксична помилка ПРИ КОМПІЛЯЦІЇ коду воркера самого чи неперехоплений
    // виняток поза try/catch воркера (напр. помилка в самому WORKER_SOURCE) — теоретично
    // не повинно траплятись, але без обробника такий випадок завис би до таймауту мовчки.
    worker.onerror = (e: ErrorEvent) => finish({ logs: [], error: `${e.message}`, ms: Math.round(performance.now() - start) });

    worker.postMessage(code);
  });
}
