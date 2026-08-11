import { describe, expect, it } from "vitest";
import { meetingProviderLabel, normalizeMeetingUrl } from "./meeting-link";

describe("normalizeMeetingUrl", () => {
  it("keeps a full https link as-is", () => {
    expect(normalizeMeetingUrl("https://meet.google.com/jxs-ewjz-onf?hs=224")).toBe("https://meet.google.com/jxs-ewjz-onf?hs=224");
  });

  it("adds https:// to the scheme-less form these providers print in their own UI", () => {
    expect(normalizeMeetingUrl("meet.google.com/jxs-ewjz-onf")).toBe("https://meet.google.com/jxs-ewjz-onf");
    expect(normalizeMeetingUrl("acme.zoom.us/j/98765")).toBe("https://acme.zoom.us/j/98765");
  });

  it("trims surrounding whitespace, which a paste routinely carries", () => {
    expect(normalizeMeetingUrl("  https://zoom.us/j/1  ")).toBe("https://zoom.us/j/1");
  });

  it("returns empty for an empty or whitespace-only value", () => {
    expect(normalizeMeetingUrl("")).toBe("");
    expect(normalizeMeetingUrl("   ")).toBe("");
  });

  it("rejects a non-http(s) scheme instead of prefixing it into a valid-looking URL", () => {
    // The bug this guards: prefixing unconditionally turns "javascript:alert(1)" into
    // "https://javascript:alert(1)", which parses fine and would then be rendered as an href.
    expect(normalizeMeetingUrl("javascript:alert(1)")).toBe("");
    expect(normalizeMeetingUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(normalizeMeetingUrl("mailto:someone@example.com")).toBe("");
  });

  it("returns empty for something that can't be a URL at all", () => {
    expect(normalizeMeetingUrl("https://")).toBe("");
  });
});

describe("meetingProviderLabel", () => {
  it("names the well-known providers", () => {
    expect(meetingProviderLabel("https://meet.google.com/jxs-ewjz-onf")).toBe("Google Meet");
    expect(meetingProviderLabel("https://zoom.us/j/98765")).toBe("Zoom");
    expect(meetingProviderLabel("https://teams.microsoft.com/l/meetup-join/xyz")).toBe("Microsoft Teams");
    expect(meetingProviderLabel("https://whereby.com/acme")).toBe("Whereby");
  });

  it("matches a provider's subdomains, which is how Zoom and Webex hand out rooms", () => {
    expect(meetingProviderLabel("https://acme.zoom.us/j/98765")).toBe("Zoom");
    expect(meetingProviderLabel("https://acme.webex.com/meet/recruiter")).toBe("Webex");
  });

  it("does not let a lookalike host claim a provider's name", () => {
    expect(meetingProviderLabel("https://notzoom.us/j/1")).toBe("notzoom.us");
    expect(meetingProviderLabel("https://zoom.us.evil.example/j/1")).toBe("zoom.us.evil.example");
  });

  it("falls back to the hostname for a self-hosted or unknown provider", () => {
    expect(meetingProviderLabel("https://call.acme.dev/room/42")).toBe("call.acme.dev");
    expect(meetingProviderLabel("https://www.example.com/room")).toBe("example.com");
  });

  it("returns empty for a value that isn't a usable link, so the caller renders nothing", () => {
    expect(meetingProviderLabel("")).toBe("");
    expect(meetingProviderLabel("javascript:alert(1)")).toBe("");
  });
});
