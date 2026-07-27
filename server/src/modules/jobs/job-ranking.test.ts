import { describe, expect, it } from "vitest";
import { buildIdf, jobDocument, rankByTfidf, tfidfScore, tokenize } from "./job-ranking.js";

describe("tokenize()", () => {
  it("lowercases and splits on non-word characters, dropping single-char tokens", () => {
    expect(tokenize("React.js, TypeScript & Node.js!")).toEqual(["react.js", "typescript", "node.js"]);
  });

  it("keeps + and # so 'C++' / 'C#' style tokens are not mangled", () => {
    expect(tokenize("C++ developer with C#")).toEqual(["c++", "developer", "with", "c#"]);
  });
});

describe("buildIdf()", () => {
  it("gives a rare term a higher weight than a term present in every document", () => {
    const docs = [
      ["react", "typescript", "docker"],
      ["react", "python"],
      ["react", "go"],
    ];
    const idf = buildIdf(docs);
    // "react" з'являється в усіх 3 документах — низька IDF; "docker" — лише в одному — вища.
    expect(idf.get("docker")!).toBeGreaterThan(idf.get("react")!);
  });
});

describe("tfidfScore()", () => {
  const idf = buildIdf([
    ["senior", "react", "typescript", "developer"],
    ["react", "developer"],
    ["python", "developer"],
  ]);

  it("scores zero for a job whose document shares no terms with the query", () => {
    expect(tfidfScore({ position: "Python Developer", tags: [] }, ["react", "typescript"], idf)).toBe(0);
  });

  it("scores a job higher when it matches a rarer query term than a common one", () => {
    const matchesRareTerm = tfidfScore({ position: "Senior TypeScript Engineer", tags: [] }, ["typescript"], idf);
    const matchesCommonTerm = tfidfScore({ position: "Developer role", tags: [] }, ["developer"], idf);
    expect(matchesRareTerm).toBeGreaterThan(matchesCommonTerm);
  });

  it("returns 0 for an empty query (no candidate skills known)", () => {
    expect(tfidfScore({ position: "React Developer", tags: ["React"] }, [], idf)).toBe(0);
  });
});

describe("jobDocument()", () => {
  it("combines position and tags into one tokenized document", () => {
    expect(jobDocument({ position: "React Developer", tags: ["TypeScript", "Docker"] })).toEqual([
      "react",
      "developer",
      "typescript",
      "docker",
    ]);
  });
});

describe("rankByTfidf() — the actual fix for DOU jobs never being ranked", () => {
  // Реальний випадок, який зараз ламається: DOU-вакансії ЗАВЖДИ мають tags:[] (сирий
  // XML-фід не містить тегів) — старе сортування за matchCount (тегами) не могло їх
  // ранжувати взагалі. TF-IDF рахує документ з POSITION теж — тож DOU-вакансія з
  // релевантним заголовком тепер отримує реальний score, не завжди 0.
  it("ranks a DOU-style job (no tags) above an irrelevant job purely from its title text", () => {
    const relevantDou = { position: "Senior React TypeScript Developer", tags: [] as string[] };
    const irrelevant = { position: "Java Backend Engineer", tags: [] as string[] };
    const documents = [jobDocument(relevantDou), jobDocument(irrelevant)];
    const ranked = rankByTfidf([irrelevant, relevantDou], documents, ["React", "TypeScript"]);
    expect(ranked[0]?.position).toBe("Senior React TypeScript Developer");
    expect(ranked[0]?._score).toBeGreaterThan(0);
  });

  it("returns all input jobs, unchanged aside from the added _score field and sort order", () => {
    const jobs = [
      { position: "A", tags: ["x"] },
      { position: "B", tags: ["y"] },
    ];
    const ranked = rankByTfidf(jobs, jobs.map(jobDocument), ["x"]);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((j) => typeof j._score === "number")).toBe(true);
  });
});
