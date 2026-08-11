// Contract test for the offline fallback (llmAvailable() === false must NEVER touch chatJson()),
// plus the "LLM produced a usable result" and "LLM produced garbage, fall back anyway" paths —
// same shape as cv-linkedin.service.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  llmAvailable: vi.fn(() => false),
  chatJson: vi.fn(),
}));

import { draftOutreachMessage } from "./contacts-outreach.service.js";
import { llmAvailable, chatJson } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import type { Profile } from "../../db/types.js";
import type { Contact } from "./contacts.repo.js";

const profile: Profile = { skills: ["React", "TypeScript"], cvText: "5 years building web apps.", domain: "Frontend Engineer" };

const contact: Contact = {
  id: 1,
  name: "Ada Lovelace",
  role: "Engineering Manager",
  companyId: null,
  vacancyId: null,
  email: "ada@example.test",
  linkedinUrl: "",
  notes: "Met at a meetup",
  source: "manual",
  lastContactAt: "",
};

describe("draftOutreachMessage()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offline: returns a templated intro message addressed by first name and never calls chatJson()", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const result = await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "intro");

    expect(result.offline).toBe(true);
    expect(result.message).toContain("Hi Ada");
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("offline: a followup message reads as a nudge, not a fresh introduction", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const result = await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "followup");

    expect(result.offline).toBe(true);
    expect(result.message).toContain("follow up");
  });

  it("offline: mentions the company/vacancy context when provided", async () => {
    vi.mocked(llmAvailable).mockReturnValue(false);

    const result = await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "intro", {
      companyName: "Acme",
      vacancyPosition: "Backend Engineer",
    });

    expect(result.message).toContain("Acme");
    expect(result.message).toContain("Backend Engineer");
  });

  it("online: returns the LLM's message with offline:false when it validates", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ message: "Hi Ada, I'd love to connect about the role at Acme." });

    const result = await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "intro", { companyName: "Acme" });

    expect(result).toEqual({ message: "Hi Ada, I'd love to connect about the role at Acme.", offline: false });
  });

  it("online but chatJson returns null (LLM failure/invalid JSON after self-repair) — falls back to offline", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue(null);

    const result = await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "intro");

    expect(result.offline).toBe(true);
    expect(result.message).toContain("Hi Ada");
  });

  it("does not request caching — regenerating should be able to return a different variant", async () => {
    vi.mocked(llmAvailable).mockReturnValue(true);
    vi.mocked(chatJson).mockResolvedValue({ message: "Hi Ada!" });

    await draftOutreachMessage(BOOTSTRAP_USER_ID, profile, contact, "intro");

    const options = vi.mocked(chatJson).mock.calls[0]![4];
    expect(options?.cache).toBeFalsy();
  });
});
