// Classic dynamic-programming Levenshtein distance (min. number of character
// insertions/deletions/substitutions to turn one string into another) — used for tolerance
// to typos/spelling variations (e.g. "Dockrr" -> "Docker") where the exact regex dictionary
// (tech-dict.ts) would find nothing.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // A single 1D row instead of a full matrix — O(min(m,n)) memory instead of O(m*n),
  // not critical for short words (tech names), but the habit doesn't hurt.
  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(prevRow[j]! + 1, currentRow[j - 1]! + 1, prevRow[j - 1]! + cost));
    }
    prevRow = currentRow;
  }
  return prevRow[b.length]!;
}

/**
 * Maximum allowed distance for a word of length `length` to still be considered "the same
 * word with a typo" — the longer the word, the more typos are naturally tolerable without
 * losing confidence (1 typo per ~5 characters — a conservative threshold, less aggressive
 * than typical spell-checker defaults, to avoid false positives on short words).
 */
export function maxTypoDistance(length: number): number {
  if (length <= 3) return 0; // short words — false positives too likely, don't tolerate any typos at all
  if (length <= 5) return 1;
  return 2;
}

/** true if `word` is `candidate` with no more than `maxTypoDistance` typos. */
export function isFuzzyMatch(word: string, candidate: string): boolean {
  if (Math.abs(word.length - candidate.length) > maxTypoDistance(Math.max(word.length, candidate.length))) return false;
  return levenshtein(word, candidate) <= maxTypoDistance(candidate.length);
}
