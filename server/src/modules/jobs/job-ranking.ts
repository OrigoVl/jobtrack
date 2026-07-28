// TF-IDF ranking of external vacancies (Remotive/Arbeitnow/DOU) by relevance to the candidate's
// skills. `/jobs/search` used to sort only by `matchCount` — a plain count of vacancy tags that
// match the profile's skills. Two problems with that:
//   1. DOU doesn't return tags at all (RawJob.tags is always []) — DOU vacancies ALWAYS had
//      matchCount=0 and effectively weren't sorted by relevance at all, just feed order.
//   2. All matches weigh the same: a match on "JavaScript" (present in almost every vacancy)
//      weighs the same as a match on a rare niche skill.
// TF-IDF builds the vacancy's document from its POSITION+tags (not just tags) — so DOU vacancies
// now also get a relevance signal from the title text — and weighs rare terms higher than
// frequent ones (classic IDF: log(N / (1 + number of documents containing the term))).
export interface RankableJob {
  position: string;
  tags: string[];
}

// The character class deliberately includes Cyrillic letters (а-я, і, ї, є, ґ) — vacancy titles
// on Ukrainian boards can be in Ukrainian even though the app's UI is English.
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zа-яіїєґ0-9+.#]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export function jobDocument(job: RankableJob): string[] {
  return tokenize(`${job.position} ${job.tags.join(" ")}`);
}

/** The IDF table over the document corpus (one vacancy = one document). */
export function buildIdf(documents: string[][]): Map<string, number> {
  const docCount = documents.length || 1;
  const containing = new Map<string, number>();
  for (const doc of documents) {
    for (const term of new Set(doc)) {
      containing.set(term, (containing.get(term) || 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, n] of containing) {
    // +1 in the denominator (standard smoothing) — avoids division by zero and too sharp a
    // rise in IDF for terms that appear in exactly one document of the corpus.
    idf.set(term, Math.log(docCount / (1 + n)) + 1);
  }
  return idf;
}

/**
 * A vacancy's TF-IDF score relative to a set of query terms (the candidate's skills, already
 * tokenized/lowercased). Term Frequency (TF) — how many times the term appears in the vacancy's
 * document; multiplied by that term's IDF from the corpus.
 */
export function tfidfScore(job: RankableJob, queryTerms: string[], idf: Map<string, number>): number {
  if (!queryTerms.length) return 0;
  const doc = jobDocument(job);
  if (!doc.length) return 0;
  const tf = new Map<string, number>();
  for (const term of doc) tf.set(term, (tf.get(term) || 0) + 1);
  let score = 0;
  for (const term of queryTerms) {
    const count = tf.get(term);
    if (!count) continue;
    score += (count / doc.length) * (idf.get(term) || 1);
  }
  return score;
}

/**
 * Ranks a list of vacancies by relevance to the candidate's skills. IDF is computed over the
 * COMBINED corpus of all sources (passed in `documents`), so a term's "rarity" is judged against
 * everything currently being shown, not just one source.
 */
export function rankByTfidf<T extends RankableJob>(jobs: T[], allDocuments: string[][], skills: string[]): (T & { _score: number })[] {
  const idf = buildIdf(allDocuments);
  const queryTerms = skills.flatMap((s) => tokenize(s));
  return jobs.map((job) => ({ ...job, _score: tfidfScore(job, queryTerms, idf) })).sort((a, b) => b._score - a._score);
}

const WEAK_MATCH_RELATIVE_THRESHOLD = 0.12;

/**
 * Filters out vacancies whose relevance score is far below the best match in this result set —
 * e.g. a broad "fullstack" search pulling in a "Remote Office Assistant" with only an
 * incidental token overlap. The cutoff is RELATIVE to this search's own top score (not a fixed
 * absolute number), so it adapts to how strong the best matches actually are. Falls back to
 * returning the list unfiltered if the threshold would wipe out everything (e.g. every job
 * scored 0 because the candidate has no skills in their profile yet) — showing something
 * unranked beats showing nothing.
 */
export function filterWeakMatches<T extends { _score: number }>(ranked: T[], relativeThreshold = WEAK_MATCH_RELATIVE_THRESHOLD): T[] {
  if (!ranked.length) return ranked;
  const top = ranked[0]!._score;
  if (top <= 0) return ranked;
  const kept = ranked.filter((j) => j._score >= top * relativeThreshold);
  return kept.length ? kept : ranked;
}
