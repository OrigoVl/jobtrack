// Deterministic, keyless email-pattern guessing — backs providers/pattern-guess.ts, the fallback
// that keeps contact enrichment useful with zero API keys configured. Pure function, no I/O.
export interface GuessedEmail {
  email: string;
  pattern: string;
  confidence: number;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercases, strips diacritics, and drops anything outside [a-z] per token — good enough for a
 * "first.last@domain" style guess, not a full name-parsing library. */
function tokenize(fullName: string): string[] {
  return stripDiacritics(fullName)
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
}

/**
 * Guesses common corporate email patterns for a person at `domain`, in DESCENDING confidence
 * order. Multi-part names use the FIRST token as the given name and the LAST token as the
 * surname (middle names/initials are ignored — there's no reliable way to know which convention a
 * specific company's email scheme follows). A single-token name can only produce "first@domain".
 */
export function guessEmails(fullName: string, domain: string): GuessedEmail[] {
  const name = String(fullName ?? "").trim();
  const dom = String(domain ?? "").trim();
  if (!name || !dom) return [];

  const tokens = tokenize(name);
  if (tokens.length === 0) return [];

  const first = tokens[0]!;
  if (tokens.length === 1) {
    return [{ email: `${first}@${dom}`, pattern: "first", confidence: 40 }];
  }

  const last = tokens[tokens.length - 1]!;
  return [
    { email: `${first}.${last}@${dom}`, pattern: "first.last", confidence: 55 },
    { email: `${first}@${dom}`, pattern: "first", confidence: 40 },
    { email: `${first[0]}${last}@${dom}`, pattern: "flast", confidence: 35 },
    { email: `${first[0]}.${last}@${dom}`, pattern: "f.last", confidence: 30 },
    { email: `${first}${last}@${dom}`, pattern: "firstlast", confidence: 25 },
    { email: `${first}_${last}@${dom}`, pattern: "first_last", confidence: 20 },
    { email: `${last}${first[0]}@${dom}`, pattern: "lastf", confidence: 15 },
  ];
}
