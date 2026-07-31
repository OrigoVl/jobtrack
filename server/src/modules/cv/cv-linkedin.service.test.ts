// Contract test for the offline fallback (llmAvailable() === false must NEVER touch chatJson()),
// plus the "LLM produced a usable result" and "LLM produced garbage, fall back anyway" paths —
// same shape as knowledge.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import { optimizeLinkedInProfile } from "./cv-linkedin.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { Profile } from "../../db/types.js";

const profile: Profile = { skills: ["React", "TypeScript", "Node.js"], cvText: "5 years building web apps.", domain: "Frontend Engineer" };

describe("optimizeLinkedInProfile()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns a templated headline/about and never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const result = await optimizeLinkedInProfile(BOOTSTRAP_USER_ID, profile);

    expect(result.offline).toBe(true);
    expect(result.headline).toBe("Frontend Engineer | React · TypeScript · Node.js");
    expect(result.about).toContain("Frontend Engineer");
    expect(result.about).toContain("React, TypeScript, Node.js");
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("offline with no domain/skills still returns something usable, not empty strings", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const result = await optimizeLinkedInProfile(BOOTSTRAP_USER_ID, { skills: [], cvText: "" });

    expect(result.offline).toBe(true);
    expect(result.headline.trim().length).toBeGreaterThan(0);
    expect(result.about.trim().length).toBeGreaterThan(0);
  });

  it("online: returns the LLM's headline/about with offline:false when it validates", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ headline: "Frontend Engineer @ Acme", about: "I build delightful web experiences." });

    const result = await optimizeLinkedInProfile(BOOTSTRAP_USER_ID, profile);

    expect(result).toEqual({ headline: "Frontend Engineer @ Acme", about: "I build delightful web experiences.", offline: false });
  });

  it("online but chatJson returns null (LLM failure/invalid JSON after self-repair) — falls back to offline", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);

    const result = await optimizeLinkedInProfile(BOOTSTRAP_USER_ID, profile);

    expect(result.offline).toBe(true);
    expect(result.headline).toBe("Frontend Engineer | React · TypeScript · Node.js");
  });

  it('passes feature: "linkedin-optimize" to chatJson, following this codebase\'s per-call-site tagging convention', async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ headline: "H", about: "A" });

    await optimizeLinkedInProfile(BOOTSTRAP_USER_ID, profile);

    const options = vi.mocked(chatJson).mock.calls[0]?.[4];
    expect(options).toEqual(expect.objectContaining({ feature: "linkedin-optimize" }));
  });
});
