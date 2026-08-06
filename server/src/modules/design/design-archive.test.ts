import { describe, expect, it } from "vitest";
import {
  appendDesignArchive,
  designArchiveEntryFromGrade,
  removeDesignArchiveEntry,
  updateDesignArchiveEntry,
  MAX_DESIGN_ARCHIVE,
  type DesignArchiveEntry,
} from "./design-archive.js";
import type { DesignDiagram, DesignGrade, DesignTask } from "./design.service.js";

const task: DesignTask = {
  title: "Design a URL shortener",
  scenario: "Users submit long URLs and get back a short code.",
  requirements: ["Handle 1000 req/s"],
  constraints: ["Small team"],
  difficulty: "medium",
};
const diagram: DesignDiagram = {
  nodes: [{ id: "n1", kind: "service", label: "API", x: 0, y: 0 }],
  edges: [],
};
const grade: DesignGrade = {
  score: 80,
  summary: "Solid start",
  criteria: [{ title: "Has a database", met: true, note: "ok" }],
  strengths: ["Clear API layer"],
  missed: ["No cache"],
  tip: "Add a cache",
};

describe("designArchiveEntryFromGrade()", () => {
  it("bundles task/diagram/grade with an id and timestamp", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const entry = designArchiveEntryFromGrade(task, diagram, grade, at);
    expect(entry.task).toEqual(task);
    expect(entry.diagram).toEqual(diagram);
    expect(entry.grade).toEqual(grade);
    expect(entry.gradedAt).toBe(at);
    expect(entry.id).toMatch(/^design-arch-/);
  });
});

const entry = (id: string, gradedAt = "2026-01-01T00:00:00.000Z"): DesignArchiveEntry => ({
  id,
  task,
  diagram,
  grade,
  gradedAt,
});

describe("appendDesignArchive()", () => {
  it("prepends the new entry (newest first)", () => {
    const result = appendDesignArchive([entry("old")], entry("new"));
    expect(result.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("caps the list at MAX_DESIGN_ARCHIVE", () => {
    const full = Array.from({ length: MAX_DESIGN_ARCHIVE }, (_, i) => entry(`e${i}`));
    const result = appendDesignArchive(full, entry("newest"));
    expect(result.length).toBe(MAX_DESIGN_ARCHIVE);
    expect(result[0]!.id).toBe("newest");
    expect(result.find((e) => e.id === `e${MAX_DESIGN_ARCHIVE - 1}`)).toBeUndefined();
  });
});

describe("removeDesignArchiveEntry()", () => {
  it("removes the matching entry by id", () => {
    const result = removeDesignArchiveEntry([entry("a"), entry("b")], "a");
    expect(result.map((e) => e.id)).toEqual(["b"]);
  });

  it("is a no-op when the id isn't found", () => {
    const history = [entry("a")];
    expect(removeDesignArchiveEntry(history, "nope")).toEqual(history);
  });
});

describe("updateDesignArchiveEntry()", () => {
  it("patches task title/scenario without touching diagram/grade", () => {
    const result = updateDesignArchiveEntry([entry("a")], "a", { title: "New title" });
    expect(result).not.toBeNull();
    expect(result![0]!.task.title).toBe("New title");
    expect(result![0]!.task.scenario).toBe(task.scenario);
    expect(result![0]!.diagram).toEqual(diagram);
    expect(result![0]!.grade).toEqual(grade);
  });

  it("patches grade summary/tip without touching criteria", () => {
    const result = updateDesignArchiveEntry([entry("a")], "a", { summary: "Updated summary" });
    expect(result![0]!.grade.summary).toBe("Updated summary");
    expect(result![0]!.grade.criteria).toEqual(grade.criteria);
  });

  it("returns null when the id isn't found", () => {
    expect(updateDesignArchiveEntry([entry("a")], "nope", { title: "x" })).toBeNull();
  });
});
