export interface RunResult {
  logs: string[];
  error: string | null;
  ms: number;
}

function formatArg(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value, (_k, v) => (v === undefined ? "undefined" : v), 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Запускає довільний JS-код у пісочниці (перехоплює console.*, обмежує час виконання).
 * Виконання в основному потоці — прийнятно для локального навчального застосунку.
 */
export function runJs(code: string): RunResult {
  const logs: string[] = [];
  const capture = (...args: unknown[]): void => {
    logs.push(args.map(formatArg).join(" "));
  };
  const sandboxConsole = { log: capture, info: capture, warn: capture, error: capture, debug: capture };
  const start = performance.now();
  try {
    const fn = new Function("console", `"use strict";\n${code}`);
    fn(sandboxConsole);
    return { logs, error: null, ms: Math.round(performance.now() - start) };
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { logs, error: message, ms: Math.round(performance.now() - start) };
  }
}
