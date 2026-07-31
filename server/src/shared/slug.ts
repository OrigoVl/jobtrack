import { randomBytes } from "crypto";

// Converts arbitrary text (a technology/topic name) into a safe id fragment.
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Short, unguessable, URL-safe random id — for public share links (modules/cv-shares/), where
// the slug itself (not a session/auth check) is the only thing standing between "anyone with
// the link" and "no one". Node's built-in crypto, no new dependency (e.g. nanoid) needed for
// something this small. base64url (RFC 4648 §5) is already URL-safe (`-`/`_` instead of `+`/`/`,
// no padding) — no extra encoding step. 9 random bytes -> 12 base64url characters, ~72 bits of
// entropy: enough that guessing one is not a realistic attack, short enough to look like a normal
// share link (compare Google Docs' ~44-char ids, which optimize for global uniqueness at a much
// bigger scale than one app's CVs).
export const randomSlug = (bytes = 9): string => randomBytes(bytes).toString("base64url");
