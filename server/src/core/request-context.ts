// Наскрізна кореляція логів одного HTTP-запиту через AsyncLocalStorage: код, який не має
// прямого доступу до `req` (LLM-клієнт, сервіси, викликані глибоко в стеку) все одно може
// підписати свої логи тим самим reqId, що й pino-http — критично для діагностики (напр.
// "LLM timeout" у проді: без reqId незрозуміло, до якого запиту користувача це відноситься).
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContextStore {
  reqId: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

/** Виконує `fn` у контексті конкретного запиту — викликається один раз із middleware в app.ts. */
export function runWithRequestContext<T>(reqId: string, fn: () => T): T {
  return storage.run({ reqId }, fn);
}

/** reqId поточного запиту, якщо виконується всередині `runWithRequestContext` (інакше undefined). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.reqId;
}
