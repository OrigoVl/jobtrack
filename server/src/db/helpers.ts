// Small helpers around SQLite rows, shared across several domain routers.

export const j = (s: string | null | undefined): string[] => JSON.parse(s || "[]");

export const withStack = <T extends { stack: string }>(row: T): Omit<T, "stack"> & { stack: string[] } => ({
  ...row,
  stack: j(row.stack),
});
