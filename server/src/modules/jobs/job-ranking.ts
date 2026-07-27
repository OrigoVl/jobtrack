// TF-IDF ранжування зовнішніх вакансій (Remotive/Arbeitnow/DOU) за релевантністю до навичок
// кандидата. Раніше `/jobs/search` сортував лише за `matchCount` — простим числом тегів
// вакансії, що збігаються з навичками профілю. Дві проблеми з цим:
//   1. DOU не віддає теги взагалі (RawJob.tags завжди []) — DOU-вакансії ЗАВЖДИ мали
//      matchCount=0 і фактично не сортувались за релевантністю, лише за порядком фіда.
//   2. Усі збіги важать однаково: збіг по "JavaScript" (зустрічається майже в кожній
//      вакансії) важить стільки ж, скільки збіг по рідкісній нішевій навичці.
// TF-IDF рахує документ вакансії з ПОЗИЦІЇ+тегів (а не лише тегів) — тож і DOU-вакансії
// тепер отримують сигнал релевантності з тексту заголовка — і важить рідкісні терміни
// вище за часті (класична IDF: log(N / (1 + к-сть документів з терміном))).
export interface RankableJob {
  position: string;
  tags: string[];
}

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

/** IDF-таблиця по корпусу документів (одна вакансія = один документ). */
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
    // +1 у знаменнику (стандартне smoothing) — уникає ділення на нуль і надто різкого
    // зростання IDF для термінів, що зустрічаються рівно в одному документі корпусу.
    idf.set(term, Math.log(docCount / (1 + n)) + 1);
  }
  return idf;
}

/**
 * TF-IDF score вакансії відносно набору термінів-запитів (навички кандидата, вже
 * токенізовані/у нижньому регістрі). Термін Frequency (TF) — скільки разів термін
 * зустрічається в документі вакансії; множимо на IDF цього терміну з корпусу.
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
 * Ранжує список вакансій за релевантністю до навичок кандидата. IDF рахується по
 * ОБ'ЄДНАНОМУ корпусу всіх джерел (переданих у `documents`), щоб "рідкість" терміну
 * оцінювалась відносно всього, що зараз показуємо, а не лише одного джерела.
 */
export function rankByTfidf<T extends RankableJob>(jobs: T[], allDocuments: string[][], skills: string[]): (T & { _score: number })[] {
  const idf = buildIdf(allDocuments);
  const queryTerms = skills.flatMap((s) => tokenize(s));
  return jobs.map((job) => ({ ...job, _score: tfidfScore(job, queryTerms, idf) })).sort((a, b) => b._score - a._score);
}
