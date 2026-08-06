// The only prior coverage of this module was indirect (vacancy-analysis.service.test.ts, which
// mocks llmAvailable() to false) — the AI-merge branch (regex + LLM skills, dedupe, cap at 25)
// never actually ran in CI. These tests exercise extractSkills()/detectDomain() directly, both
// offline and with a mocked chatJson(), including the cache read/write paths.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));
vi.mock("../db/llm-cache.js", () => ({
  getLlmCache: vi.fn(() => null),
  setLlmCache: vi.fn(),
}));

import { extractSkills, detectDomain } from "./skill-extraction.js";
import { llmAvailable, chatJson } from "../llm/index.js";
import { getLlmCache, setLlmCache } from "../db/llm-cache.js";
import { BOOTSTRAP_USER_ID } from "../db/user-id.js";

const VACANCY_TEXT = "We need a Backend Engineer experienced with Node.js, PostgreSQL, and Docker for our growing team.";

describe("extractSkills()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLlmCache).mockResolvedValue(null);
  });

  it("offline: returns only regex/tech-dictionary matches, never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL", "Docker"]));
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("short text (<30 chars): returns regex matches without calling the LLM, even if available", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);

    const skills = await extractSkills(BOOTSTRAP_USER_ID, "React job");

    expect(chatJson).not.toHaveBeenCalled();
    expect(skills).toEqual(expect.any(Array));
  });

  it("cache hit: returns the cached skill list and never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(getLlmCache).mockResolvedValue({ skills: ["Cached Skill A", "Cached Skill B"] });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills).toEqual(["Cached Skill A", "Cached Skill B"]);
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("merges regex + AI skills and de-duplicates case-insensitively", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    // "node.js" (lowercase) duplicates a regex match ("Node.js") — the regex spelling should win
    // (dedupe() keeps the FIRST occurrence, and regex results are concatenated before AI ones).
    vi.mocked(chatJson).mockResolvedValue({ skills: ["node.js", "Kubernetes", "  Terraform  "] });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills.filter((s) => s.toLowerCase() === "node.js")).toEqual(["Node.js"]);
    expect(skills).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(setLlmCache).toHaveBeenCalledWith(expect.stringMatching(/^skx:/), { skills });
  });

  it("falls back to regex-only results (without caching) when the AI returns no skills", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ skills: [] });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL", "Docker"]));
    expect(setLlmCache).not.toHaveBeenCalled();
  });

  it("falls back to regex-only results when the AI call itself fails (chatJson returns null)", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL", "Docker"]));
    expect(setLlmCache).not.toHaveBeenCalled();
  });

  it("caps the merged result at 25 skills", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ skills: Array.from({ length: 40 }, (_, i) => `AI Skill ${i}`) });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills.length).toBeLessThanOrEqual(25);
  });
});

describe("detectDomain()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLlmCache).mockResolvedValue(null);
  });

  const CV_TEXT = "Five years of experience building web applications with React, Node.js, and PostgreSQL.";

  it("offline: guesses a coarse domain from CV text (regex-only), never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    // CV_TEXT mentions both React (Frontend) and Node.js/PostgreSQL (Backend) tech-dict cats.
    expect(await detectDomain(BOOTSTRAP_USER_ID, CV_TEXT)).toBe("Full-Stack Developer");
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("offline: resolves a non-software track from an explicit keyword signal", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    expect(await detectDomain(BOOTSTRAP_USER_ID, "5 years as a QA Automation Engineer testing web apps.")).toBe("QA Engineer");
  });

  it("offline: falls back to a plain 'Software Developer' label with no recognizable tech", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    expect(await detectDomain(BOOTSTRAP_USER_ID, "Five years of experience leading engineering teams and shipping products.")).toBe(
      "Software Developer",
    );
  });

  it("short text (<30 chars): returns an empty string without calling the LLM", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);

    expect(await detectDomain(BOOTSTRAP_USER_ID, "Frontend dev")).toBe("");
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("cache hit: returns the cached domain and never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(getLlmCache).mockResolvedValue({ domain: "Cached Domain" });

    expect(await detectDomain(BOOTSTRAP_USER_ID, CV_TEXT)).toBe("Cached Domain");
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("returns the AI-detected domain, trimmed, and caches it", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ domain: "  Backend Engineer  " });

    const domain = await detectDomain(BOOTSTRAP_USER_ID, CV_TEXT);

    expect(domain).toBe("Backend Engineer");
    expect(setLlmCache).toHaveBeenCalledWith(expect.stringMatching(/^domain:/), { domain: "Backend Engineer" });
  });

  it("does not cache an empty AI response", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ domain: "" });

    expect(await detectDomain(BOOTSTRAP_USER_ID, CV_TEXT)).toBe("");
    expect(setLlmCache).not.toHaveBeenCalled();
  });

  it("caps the domain at 80 characters", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ domain: "D".repeat(200) });

    const domain = await detectDomain(BOOTSTRAP_USER_ID, CV_TEXT);
    expect(domain.length).toBe(80);
  });
});
