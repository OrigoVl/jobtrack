// Pulls the contact details a job posting ALREADY STATES out of its own text — the recruiter's
// address, Telegram handle or LinkedIn profile, written there by the person who wants to be
// contacted. This is the deliberate opposite of the email-pattern guessing this module replaces:
// nothing here is inferred, so every result is an address someone actually published.
//
// Two properties follow from "never guess", and both are enforced below rather than assumed:
//
// 1. VERBATIM ONLY. Every email/handle/URL returned must appear character-for-character in the
//    source text (verbatimOnly()). The LLM pass can find and label contacts the regexes miss —
//    "надсилайте резюме Ірині" next to an address three lines down — but it can never introduce
//    an address that isn't in the posting. That kills both plausible-looking hallucinations and
//    the prompt-injection case where the posting text itself instructs the model to emit some
//    other address.
// 2. NOT CACHED. chat()'s `cache` option defaults to false and is deliberately left off: a hit
//    would put a named recruiter's address into llm_cache, whose TTL is 90 days. Third-party
//    personal data does not belong in a 90-day cache (the retired enrichment cache held exactly
//    this class of data at 7 days for that reason — see db/schema/app.ts#enrichmentCache), and
//    extraction is cheap and runs once per vacancy on demand, so there is nothing to buy here.
import { z } from "zod";
import { chatJson, llmAvailable, quoteUntrustedText } from "../../../llm/index.js";
import type { UserId } from "../../../db/user-id.js";

export type PostingContactChannel = "email" | "telegram" | "linkedin";

export interface PostingContact {
  /** "" when the text gives an address with no name attached — common, and still useful. */
  name: string;
  title: string;
  channel: PostingContactChannel;
  /** The address/handle/URL exactly as it appears in the posting. */
  value: string;
}

// Deliberately conservative: a trailing dot or comma is punctuation, not part of the address, and
// the TLD floor of 2 keeps "v1.2" style noise out.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Both spellings UA postings use: a bare @handle, and a t.me/ link. Telegram handles are 5-32
// chars of [A-Za-z0-9_], which also stops this from swallowing the local part of an email.
const TELEGRAM_RE = /(?:(?:https?:\/\/)?t\.me\/|@)([a-z0-9_]{5,32})\b/gi;
const LINKEDIN_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-z0-9\-_%]+\/?/gi;

/** Labels that introduce a contact person, in both languages this app serves. Used to attach a
 * name to a nearby address — the LLM does this far better, this is the offline floor. */
const NAME_LABEL_RE =
  /(?:контактна особа|контактне лице|рекрутер(?:ка)?|звертайтесь до|пиши(?:те)?|recruiter|contact person|contact|reach out to)\s*[:—–-]?\s*([A-ZА-ЯЄІЇҐ][a-zа-яєіїґ'’-]+(?:\s+[A-ZА-ЯЄІЇҐ][a-zа-яєіїґ'’-]+)?)/gi;

/** An email whose local part is a role, not a person — worth showing, but never worth labelling
 * with a person's name picked up from elsewhere in the text. */
const ROLE_LOCAL_PARTS = new Set([
  "hr",
  "jobs",
  "job",
  "career",
  "careers",
  "recruiting",
  "recruitment",
  "info",
  "hello",
  "contact",
  "cv",
  "work",
]);

function isRoleAddress(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return ROLE_LOCAL_PARTS.has(local);
}

function dedupeByValue(contacts: PostingContact[]): PostingContact[] {
  const seen = new Set<string>();
  const out: PostingContact[] = [];
  for (const c of contacts) {
    const key = `${c.channel}|${c.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * The offline floor: everything findable without an LLM. Pure, no I/O — this is what runs when no
 * API key is configured, and it's also the seed the LLM pass merges into.
 *
 * A single name label in the text is attached to non-role addresses only, and only when the text
 * names exactly one person — with two or more candidates there's no reliable way to tell which
 * address belongs to whom, and a confidently wrong pairing is worse than no name at all.
 */
export function findContactsInText(text: string): PostingContact[] {
  const src = String(text ?? "");
  if (!src.trim()) return [];

  const names = [...src.matchAll(NAME_LABEL_RE)].map((m) => m[1]!.trim()).filter(Boolean);
  const soleName = new Set(names.map((n) => n.toLowerCase())).size === 1 ? names[0]! : "";

  const emails = [...src.matchAll(EMAIL_RE)].map((m) => m[0]);
  const telegrams = [...src.matchAll(TELEGRAM_RE)].map((m) => `@${m[1]}`);
  const linkedins = [...src.matchAll(LINKEDIN_RE)].map((m) => m[0]);

  // A Telegram match is dropped when the same run of characters is really part of an address the
  // email regex already claimed ("@example" inside "hr@example.com").
  const emailBlob = emails.join(" ").toLowerCase();
  const realTelegrams = telegrams.filter((h) => !emailBlob.includes(h.slice(1).toLowerCase()));

  return dedupeByValue([
    ...emails.map((value) => ({ name: isRoleAddress(value) ? "" : soleName, title: "", channel: "email" as const, value })),
    ...realTelegrams.map((value) => ({ name: soleName, title: "", channel: "telegram" as const, value })),
    ...linkedins.map((value) => ({ name: soleName, title: "", channel: "linkedin" as const, value })),
  ]);
}

const ExtractedSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().catch(""),
        title: z.string().catch(""),
        channel: z.enum(["email", "telegram", "linkedin"]),
        value: z.string(),
      }),
    )
    .catch([]),
});

/** Drops anything the model returned whose value isn't literally present in the source text. This
 * is the invariant that makes the whole feature "exact, never guessed" — see the file header. */
function verbatimOnly(contacts: PostingContact[], source: string): PostingContact[] {
  const haystack = source.toLowerCase();
  return contacts.filter((c) => {
    const value = c.value.trim();
    if (!value) return false;
    // A Telegram handle is legitimately written as "@name", "t.me/name" or bare "name" — compare
    // on the handle itself so a normalized "@name" still counts as present.
    const needle = c.channel === "telegram" ? value.replace(/^@/, "") : value;
    return haystack.includes(needle.toLowerCase());
  });
}

const SYSTEM =
  "You extract contact details that a job posting explicitly states. " +
  "Return ONLY contacts whose email address, Telegram handle or LinkedIn URL appears verbatim in the posting. " +
  "Never invent, complete or guess an address. If the posting names the person an address belongs to, include that name and their job title. " +
  "If no contact details are stated, return an empty list.";

/**
 * Full extraction: the deterministic pass always, plus an LLM pass when a key is configured. The
 * LLM's job is attribution — matching "send your CV to Iryna" to the address further down, and
 * reading a job title off the surrounding sentence — not finding addresses the regexes can't see.
 *
 * Merge order puts the LLM's richer entries first so its name/title survive dedupe, but since both
 * passes are filtered through verbatimOnly() the VALUE always comes from the posting either way.
 */
export async function extractPostingContacts(userId: UserId, text: string): Promise<PostingContact[]> {
  const src = String(text ?? "");
  const offline = findContactsInText(src);
  if (!llmAvailable() || src.trim().length < 30) return offline;

  const out = await chatJson(
    userId,
    SYSTEM,
    `Extract the stated contact details from this job posting.\n\n${quoteUntrustedText("JOB POSTING", src.slice(0, 12000))}`,
    ExtractedSchema,
    { feature: "posting-contacts", maxTokens: 700, temperature: 0 },
  );
  if (!out) return offline;

  const fromLlm = verbatimOnly(
    out.contacts.map((c) => ({
      name: c.name.trim().slice(0, 200),
      title: c.title.trim().slice(0, 160),
      channel: c.channel,
      value: c.value.trim(),
    })),
    src,
  );
  return dedupeByValue([...fromLlm, ...offline]);
}
