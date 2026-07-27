// Перетворює довільний текст (назву технології/теми) у безпечний id-фрагмент.
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
