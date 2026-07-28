import { describe, expect, it } from "vitest";
import { buildIdf, filterWeakMatches, jobDocument, rankByTfidf, tfidfScore, tokenize } from "./job-ranking.js";

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
    // "react" appears in all 3 documents — low IDF; "docker" — in only one — higher.
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
  // A real case this fixes: DOU vacancies ALWAYS have tags:[] (the raw XML feed has no
  // tags) — the old matchCount (tag-based) sorting couldn't rank them at all. TF-IDF also
  // builds the document from POSITION — so a DOU vacancy with a relevant title now gets
  // a real score, not always 0.
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

describe("filterWeakMatches()", () => {
  it("drops jobs scoring far below the top match (e.g. an irrelevant 'Office Assistant' role)", () => {
    const ranked = [
      { position: "Senior React Developer", _score: 0.9 },
      { position: "React Engineer", _score: 0.6 },
      { position: "Remote Office Assistant", _score: 0.01 },
    ];
    const filtered = filterWeakMatches(ranked);
    expect(filtered.map((j) => j.position)).toEqual(["Senior React Developer", "React Engineer"]);
  });

  it("returns everything unfiltered when the top score is 0 (no relevance signal at all)", () => {
    const ranked = [
      { position: "A", _score: 0 },
      { position: "B", _score: 0 },
    ];
    expect(filterWeakMatches(ranked)).toHaveLength(2);
  });

  it("returns everything unfiltered rather than an empty list if all scores are below the threshold", () => {
    const ranked = [
      { position: "A", _score: 0.001 },
      { position: "B", _score: 0.0009 },
    ];
    expect(filterWeakMatches(ranked)).toHaveLength(2);
  });

  it("handles an empty list", () => {
    expect(filterWeakMatches([])).toEqual([]);
  });
});
