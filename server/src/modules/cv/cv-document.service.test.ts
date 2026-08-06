// Regression test for a data-loss bug: parseCvDocFromText() used to coerce a failed chatJson call
// (returns null — no API key, quota/cost cap, provider error, twice-failed JSON validation) into
// `CvDocSchema.parse(out || {})`, which is a fully valid, all-empty, TRUTHY CvDoc. The caller
// (cv.routes.ts's /cv/profiles/:id/doc/generate) then persisted that empty doc as if parsing had
// genuinely succeeded, silently wiping out whatever CV the user already had in the builder.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../llm/index.js", () => ({
  chatJson: vi.fn(),
}));
vi.mock("../../db/index.js", () => ({
  getProfile: vi.fn(),
}));

import { parseCvDocFromText } from "./cv-document.service.js";
import { chatJson } from "../../llm/index.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

const CV_TEXT = "Senior Backend Engineer with five years building Node.js APIs and Postgres-backed services.";

describe("parseCvDocFromText()", () => {
  it("returns null (not an empty doc) when chatJson fails", async () => {
    vi.mocked(chatJson).mockResolvedValue(null);

    const doc = await parseCvDocFromText(BOOTSTRAP_USER_ID, CV_TEXT);

    expect(doc).toBeNull();
  });

  it("returns the parsed doc, with the caller's previousTheme applied, on success", async () => {
    vi.mocked(chatJson).mockResolvedValue({ name: "Alex", title: "Backend Engineer", skills: ["Node.js"] });

    const doc = await parseCvDocFromText(BOOTSTRAP_USER_ID, CV_TEXT, { template: "compact" } as never);

    expect(doc).not.toBeNull();
    expect(doc?.name).toBe("Alex");
    expect(doc?.theme.template).toBe("compact");
  });
});
