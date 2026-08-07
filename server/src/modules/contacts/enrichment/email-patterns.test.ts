import { describe, expect, it } from "vitest";
import { guessEmails } from "./email-patterns.js";

describe("guessEmails()", () => {
  it("returns all 7 patterns in descending confidence order for a two-token name", () => {
    const guesses = guessEmails("Jane Doe", "acme.com");
    expect(guesses.map((g) => g.pattern)).toEqual(["first.last", "first", "flast", "f.last", "firstlast", "first_last", "lastf"]);
    expect(guesses.map((g) => g.email)).toEqual([
      "jane.doe@acme.com",
      "jane@acme.com",
      "jdoe@acme.com",
      "j.doe@acme.com",
      "janedoe@acme.com",
      "jane_doe@acme.com",
      "doej@acme.com",
    ]);
    for (let i = 1; i < guesses.length; i++) {
      expect(guesses[i]!.confidence).toBeLessThan(guesses[i - 1]!.confidence);
    }
  });

  it("uses the LAST token as the surname for a multi-part name", () => {
    const guesses = guessEmails("Anna Maria Garcia", "acme.com");
    expect(guesses[0]!.email).toBe("anna.garcia@acme.com");
  });

  it("only emits 'first@domain' for a single-token name", () => {
    const guesses = guessEmails("Cher", "acme.com");
    expect(guesses).toEqual([{ email: "cher@acme.com", pattern: "first", confidence: 40 }]);
  });

  it("lowercases and strips diacritics", () => {
    const guesses = guessEmails("Émilie Ñúñez", "acme.com");
    expect(guesses[0]!.email).toBe("emilie.nunez@acme.com");
  });

  it("drops non-letter characters from tokens", () => {
    const guesses = guessEmails("Jean-Luc O'Brien", "acme.com");
    // "Jean-Luc" splits into two whitespace tokens ["jean-luc"] since there's no space in
    // "Jean-Luc" itself — the hyphen is stripped, not treated as a separator.
    expect(guesses[0]!.email).toBe("jeanluc.obrien@acme.com");
  });

  it("returns [] for an empty name or empty domain", () => {
    expect(guessEmails("", "acme.com")).toEqual([]);
    expect(guessEmails("Jane Doe", "")).toEqual([]);
    expect(guessEmails("   ", "acme.com")).toEqual([]);
  });
});
