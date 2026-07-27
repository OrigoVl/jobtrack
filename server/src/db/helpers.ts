// Дрібні хелпери навколо SQLite-рядків, спільні для кількох доменних роутерів.

export const j = (s: string | null | undefined): string[] => JSON.parse(s || "[]");

export const withStack = <T extends { stack: string }>(row: T): Omit<T, "stack"> & { stack: string[] } => ({
  ...row,
  stack: j(row.stack),
});
