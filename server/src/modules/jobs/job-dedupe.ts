// SimHash — near-duplicate detection for external vacancies. Deduplication in /jobs/search used
// to be based only on the EXACT URL (`seen.has(j.url)`) — the same vacancy, posted by a company
// simultaneously on Remotive, Arbeitnow, and their own site (different URLs, almost the same
// text), showed up in the list once per source that picked it up. SimHash is a classic
// information-retrieval technique (Charikar, 2002; the same approach Google uses to deduplicate
// pages during indexing) for quickly detecting textually similar documents without a pairwise
// O(n²) comparison of the full text: each document is compressed into a single 64-bit
// "fingerprint", and similar documents have FEW differing bits (a small Hamming distance) —
// unlike cryptographic hashes, where a 1-character difference flips ~half the bits.
const HASH_BITS = 64;
// How many of the 64 bits can differ for two documents to still be considered "the same
// posting". Picked empirically on short text (company+position, ~4-8 tokens): the same vacancy,
// slightly reworded by a different aggregator (an added "(remote)", "position", "full-time"
// instead of "fulltime") gives a distance of ~8-10; GENUINELY different vacancies (a different
// role or a different company) — 16+. A threshold of 12 sits in the gap between these two clusters.
const HAMMING_THRESHOLD = 12;

// Deliberately includes the Cyrillic letter ranges (а-я, і, ї, є, ґ) — job postings on Ukrainian
// boards (DOU etc.) can have company/position names in Ukrainian even though the app's UI is English.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-zа-яіїєґ0-9]+/gi) || [];
}

// FNV-1a (64-bit) — a simple, fast, deterministic string hash. Not cryptographic (and doesn't
// need to be) — we only need uniform bit dispersion for a given term here.
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
 * The SimHash fingerprint of a text: every unique term votes (+weight/-weight by frequency) on
 * each of its 64 bits; the final bit is 1 if the sum of votes is positive. Similar texts (shared
 * terms) produce similar fingerprints even with different word order or minor edits.
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

/** Number of differing bits between two fingerprints — the standard SimHash proximity metric. */
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
 * Removes near-duplicate vacancies (the same position, almost the same text, from different
 * aggregators) — keeps the FIRST occurrence in input array order. O(n²) Hamming-distance
 * comparisons — acceptable for hundreds of vacancies per request (this app's real scale);
 * for tens of thousands, LSH bucketing would be needed — unnecessary complexity here.
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
