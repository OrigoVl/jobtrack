// Класична динамічно-програмна відстань Левенштейна (мін. к-сть вставок/видалень/замін
// символів, щоб перетворити один рядок на інший) — використовується для толерантності до
// друкарських помилок/варіацій написання (напр. "Дockrr" → "Docker") там, де точний
// regex-словник (tech-dict.ts) нічого не знайде.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Один вимірний рядок замість повної матриці — O(min(m,n)) пам'яті замість O(m*n),
  // не критично для коротких слів (назви технологій), але звичка не шкодить.
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
 * Максимально допустима відстань для слова довжиною `length`, щоб вважати його "тим самим
 * словом з друкарською помилкою" — чим довше слово, тим більше друкарських помилок природньо
 * допустиме без втрати впевненості (1 помилка на ~5 символів — консервативна межа, менш
 * агресивна за типові spell-checker дефолти, щоб не плодити фолс-позитиви на коротких словах).
 */
export function maxTypoDistance(length: number): number {
  if (length <= 3) return 0; // короткі слова — фолс-позитиви надто ймовірні, взагалі не толеруємо
  if (length <= 5) return 1;
  return 2;
}

/** true, якщо `word` — це `candidate` з не більш ніж `maxTypoDistance` друкарськими помилками. */
export function isFuzzyMatch(word: string, candidate: string): boolean {
  if (Math.abs(word.length - candidate.length) > maxTypoDistance(Math.max(word.length, candidate.length))) return false;
  return levenshtein(word, candidate) <= maxTypoDistance(candidate.length);
}
