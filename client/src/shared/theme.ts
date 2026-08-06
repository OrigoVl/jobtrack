// Light/dark theme — mirrors i18n/index.ts's own bootstrap pattern (read a persisted
// preference synchronously, apply it before React's first paint to avoid a flash of the wrong
// theme, only persist on an EXPLICIT user choice). The actual color tokens already exist as CSS
// custom properties keyed off `:root[data-theme="dark"]` (see index.css/tailwind.config.js) —
// this module is just the one place that decides which value that attribute holds.
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "jobtrack.theme";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  // No explicit choice saved yet — follow the OS preference (like i18n's browser-language
  // detection), fully overridable via the switcher afterward, without writing it to storage:
  // if the user never touches the switcher, a later OS-level theme change should still be
  // picked up on the next load instead of being frozen at whatever we happened to guess first.
  return systemTheme();
}

// Applied at import time (see main.tsx's import order) — before React mounts, so the very first
// paint already uses the right theme instead of flashing light-then-dark.
document.documentElement.setAttribute("data-theme", initialTheme());

// Most consumers are pure CSS reading the `data-theme` attribute and don't need this at all, but
// a few (e.g. design-canvas.tsx's React Flow `colorMode`) read the theme into JS/prop state, so a
// change from one useTheme() instance (the switcher) must be visible to every other instance —
// hence the small pub/sub below instead of each hook call owning fully independent local state.
const listeners = new Set<(theme: Theme) => void>();

function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((listener) => listener(theme));
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light");
  useEffect(() => {
    listeners.add(setThemeState);
    return () => {
      listeners.delete(setThemeState);
    };
  }, []);
  return [theme, setTheme];
}
