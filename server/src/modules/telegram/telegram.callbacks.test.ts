// Callback data is attacker-supplied in practice: anyone who can talk to the bot can send an
// arbitrary `callback_data` string. Decoding must therefore reject everything it doesn't
// positively recognize, rather than best-effort parsing it.
import { describe, expect, it } from "vitest";
import { decodeCallback, encodeStatusCallback, vacancyButtons, DISMISS_CALLBACK } from "./telegram.callbacks.js";

describe("encode/decode round-trip", () => {
  it("round-trips every status that has a button", () => {
    for (const status of ["Applied", "Rejected", "Offer", "Paused"] as const) {
      expect(decodeCallback(encodeStatusCallback(1234, status))).toEqual({ type: "status", vacancyId: 1234, status });
    }
  });

  it("throws for a status with no button rather than emitting an undecodable payload", () => {
    expect(() => encodeStatusCallback(1, "Take-home task")).toThrow();
  });

  it("stays within the Bot API's 64-byte callback_data limit even for a large id", () => {
    expect(Buffer.byteLength(encodeStatusCallback(2_147_483_647, "Applied"))).toBeLessThanOrEqual(64);
  });
});

describe("decodeCallback()", () => {
  it("recognizes the dismiss token", () => {
    expect(decodeCallback(DISMISS_CALLBACK)).toEqual({ type: "dismiss" });
  });

  it("returns null for anything malformed, unknown, or missing", () => {
    for (const input of [undefined, "", "v:", "v:abc:a", "v:1:zz", "v:1:q", "nonsense", "v:1:a:extra"]) {
      expect(decodeCallback(input)).toBeNull();
    }
  });

  it("rejects a negative id rather than passing it through to a query", () => {
    expect(decodeCallback("v:-1:a")).toBeNull();
  });
});

describe("vacancyButtons()", () => {
  it("lays out two rows so labels stay readable on a narrow screen", () => {
    const rows = vacancyButtons(7);
    expect(rows).toHaveLength(2);
    expect(rows.flat()).toHaveLength(4);
  });

  it("produces only decodable payloads", () => {
    for (const button of vacancyButtons(7).flat()) {
      expect(decodeCallback(button.callbackData)).not.toBeNull();
    }
  });
});
