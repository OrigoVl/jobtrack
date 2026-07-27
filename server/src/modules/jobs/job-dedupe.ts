// SimHash — near-duplicate detection для зовнішніх вакансій. Раніше дедуплікація в
// /jobs/search рахувалась лише по ТОЧНОМУ URL (`seen.has(j.url)`) — та сама вакансія,
// опублікована компанією одночасно на Remotive, Arbeitnow і власному сайті (різні URL,
// майже той самий текст), проходила в список стільки разів, скільки джерел її підхопили.
// SimHash — класична техніка з інформаційного пошуку (Charikar, 2002; той самий підхід,
// що Google використовує для дедуплікації сторінок при індексації) для швидкого виявлення
// текстово-схожих документів без парної O(n²) порівняння повного тексту: кожен документ
// стискається в один 64-бітний "відбиток", і схожі документи мають МАЛО різних бітів
// (мала відстань Геммінга) — на відміну від криптографічних хешів, де 1 символ різниці
// перевертає ~половину бітів.
const HASH_BITS = 64;
// Скільки з 64 бітів можуть відрізнятись, щоб два документи все ще вважались "тим самим
// оголошенням". Підібрано емпірично на короткому тексті (company+position, ~4-8 токенів):
// та сама вакансія, злегка переформульована іншим агрегатором (доданий "(remote)", "position",
// "full-time" замість "fulltime") дає дистанцію ~8-10; ГЕНУЇННО різні вакансії (інша посада
// або інша компанія) — 16+. Порі=12 лежить у розриві між цими двома кластерами.
const HAMMING_THRESHOLD = 12;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-zа-яіїєґ0-9]+/gi) || [];
}

// FNV-1a (64-bit) — простий, швидкий, детермінований хеш рядка. Не криптографічний (і не
// повинен бути) — тут потрібна лише рівномірна дисперсія бітів для конкретного терміну.
function fnv1a64(str: string): bigint {
  const PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }
  return hash;
}

/**
 * SimHash-відбиток тексту: кожен унікальний термін голосує (+вага/-вага за частотою) за
 * кожен зі своїх 64 бітів; фінальний біт = 1, якщо сума голосів позитивна. Схожі тексти
 * (спільні терміни) дають схожі відбитки навіть при різному порядку слів чи дрібних правках.
 */
export function simhash(text: string): bigint {
  const freq = new Map<string, number>();
  for (const term of tokenize(text)) freq.set(term, (freq.get(term) || 0) + 1);
  const votes = new Array<number>(HASH_BITS).fill(0);
  for (const [term, weight] of freq) {
    const h = fnv1a64(term);
    for (let bit = 0; bit < HASH_BITS; bit++) {
      const bitIsSet = (h >> BigInt(bit)) & 1n;
      votes[bit] = (votes[bit] ?? 0) + (bitIsSet ? 1 : -1) * weight;
    }
  }
  let fingerprint = 0n;
  for (let bit = 0; bit < HASH_BITS; bit++) {
    if (votes[bit]! > 0) fingerprint |= 1n << BigInt(bit);
  }
  return fingerprint;
}

/** К-сть відмінних бітів між двома відбитками — стандартна метрика близькості для SimHash. */
export function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}

export interface DedupableJob {
  company: string;
  position: string;
}

/**
 * Прибирає near-duplicate вакансії (одна й та сама позиція, майже той самий текст, з різних
 * агрегаторів) — лишає ПЕРШЕ входження в порядку вхідного масиву. O(n²) порівнянь відстані
 * Геммінга — прийнятно для сотень вакансій за запит (реальний масштаб цього застосунку);
 * для десятків тисяч знадобилось би LSH-бакетування, тут це була б надлишкова складність.
 */
export function dedupeBySimhash<T extends DedupableJob>(jobs: T[]): T[] {
  const kept: bigint[] = [];
  const result: T[] = [];
  for (const job of jobs) {
    const fingerprint = simhash(`${job.company} ${job.position}`);
    if (kept.some((h) => hammingDistance(h, fingerprint) <= HAMMING_THRESHOLD)) continue;
    kept.push(fingerprint);
    result.push(job);
  }
  return result;
}
