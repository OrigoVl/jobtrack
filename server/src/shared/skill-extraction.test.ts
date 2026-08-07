// The only prior coverage of this module was indirect (vacancy-analysis.service.test.ts, which
// mocks llmAvailable() to false) — the AI-merge branch (regex + LLM skills, sanitize, cap at 20)
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

  it("offline: drops the tech dictionary's own fuzzy near-misses", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    // extractTechs()'s fuzzy fallback matches on edit distance, so this posting's genuine "SSR"
    // (Nuxt server-side rendering) also matched the dictionary's "SSRF" — which is where the
    // bogus security skill on a Vue/Nuxt vacancy actually came from, LLM or not.
    const skills = await extractSkills(BOOTSTRAP_USER_ID, "Modern stack: Vue.js 3, Nuxt (SSR), TypeScript, SCSS and Vite.");

    expect(skills).toEqual(expect.arrayContaining(["Vue", "Nuxt", "TypeScript"]));
    expect(skills).not.toContain("SSRF");
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

  it("merges regex + AI skills, folding aliases onto one canonical spelling", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    // "node.js" (lowercase) and "NodeJS" both duplicate a regex match ("Node.js") — sanitizeSkills()
    // canonicalizes every spelling to the dictionary's own, so only one chip survives.
    vi.mocked(chatJson).mockResolvedValue({ skills: ["node.js", "NodeJS", "  Docker  "] });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills.filter((s) => s.toLowerCase() === "node.js")).toEqual(["Node.js"]);
    expect(skills.filter((s) => s === "Docker")).toEqual(["Docker"]);
    expect(setLlmCache).toHaveBeenCalledWith(expect.stringMatching(/^skx:/), { skills });
  });

  it("drops an AI-suggested technology the text never mentions, keeping free-form skill phrases", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    // The regression this guards: the model padded a posting's stack with technologies that merely
    // "go with" the ones it saw (Kubernetes/Terraform here, React/Angular on the real DOU page).
    // A free-form phrase outside the tech dictionary is still trusted — see sanitizeSkills().
    vi.mocked(chatJson).mockResolvedValue({ skills: ["Kubernetes", "Terraform", "Code Review"] });

    const skills = await extractSkills(BOOTSTRAP_USER_ID, VACANCY_TEXT);

    expect(skills).not.toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(skills).toEqual(expect.arrayContaining(["Code Review", "Node.js", "PostgreSQL", "Docker"]));
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
