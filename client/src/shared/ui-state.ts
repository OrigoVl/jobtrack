import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

/**
 * Мінімальне зовнішнє сховище персистентного (у межах SPA-сесії) UI-стану вкладок —
 * фільтри, чернетки форм, індекси карток тощо. Раніше жило як один об'єкт `ui` усередині
 * StoreContext: зміна БУДЬ-ЯКОГО ключа (напр. "study.index" на одній вкладці) перерендерювала
 * геть усі компоненти, підписані на useStore(), навіть на інших вкладках.
 *
 * useSyncExternalStore підписує кожен виклик useUi(key) лише на зміни ЦЬОГО конкретного
 * ключа — зміна "jobs.page" більше не чіпає компоненти, що читають "study.mode".
 * Без Context-провайдера — модуль-синглтон, достатньо для одного SPA-застосунку.
 */
class UiStore {
  private state: Record<string, unknown> = {};
  private listeners = new Map<string, Set<Listener>>();

  get<T>(key: string): T | undefined {
    return this.state[key] as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.state[key] = value;
    this.listeners.get(key)?.forEach((l) => l());
  }

  subscribe(key: string, listener: Listener): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }
}

const uiStore = new UiStore();

export function useUi<T>(key: string, initial: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    (onChange) => uiStore.subscribe(key, onChange),
    () => uiStore.get<T>(key) ?? initial,
  );
  const set = useCallback((v: T) => uiStore.set(key, v), [key]);
  return [value, set];
}
