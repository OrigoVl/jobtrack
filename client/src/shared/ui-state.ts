import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

/**
 * A minimal external store for persistent (within-SPA-session) tab UI state —
 * filters, form drafts, card indices, etc. It used to live as a single `ui` object inside
 * StoreContext: changing ANY key (e.g. "study.index" on one tab) re-rendered absolutely every
 * component subscribed to useStore(), even on other tabs.
 *
 * useSyncExternalStore subscribes each useUi(key) call only to changes of THAT specific
 * key — changing "jobs.page" no longer touches components reading "study.mode".
 * No Context provider — a module singleton is enough for a single SPA app.
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
