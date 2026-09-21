// Business logic for every way a vacancy gets created outside the plain "+ Add vacancy" form
// fill-in-by-hand path: the single-add route's own dedupe+enrichment (createVacancyWithDedupe,
// also reused by the MCP `add_vacancy` tool so the two never drift apart — see mcp-tools.ts),
// the pasted-HTML bulk import (DOU export / any page with vacancy links), and the
// job-tracker.json import/sync format. Extracted from vacancies.routes.ts so this is
// unit-testable without an Express request/response — the routes now just parse the request and
// delegate here.
import { recordStatusChange } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow } from "../../db/types.js";
import { embed, embeddingsAvailable } from "../../llm/embeddings.js";
import { contextLogger } from "../../core/logger.js";
import { HttpError } from "../../core/http.js";
import { assertSafeVacancyUrl, parseJsonVacancyItem, type JsonVacancyItem } from "../../shared/validation.js";
import { findSimhashDuplicate } from "../jobs/job-dedupe.js";
import { getCompanyById, upsertCompanyEnrichment } from "../companies/companies.repo.js";
import {
  quickAnalyze,
  tryAutoEnrichStack,
  safeFetchVacancyPage,
  extractVacancyFacts,
  extractDouLocationHint,
  companyFromDouUrl,
} from "./vacancy-analysis.service.js";
import { vacancyEmbeddingText } from "./vacancy-text.js";
import {
  listVacancies,
  getVacancy,
  findVacancyByUrl,
  findVacancyByCompanyPosition,
  createVacancy,
  createVacancyMinimal,
  createVacancyFromJson,
  updateVacancyFromJson,
  updateVacancyEnrichment,
  updateVacancyImportedTitle,
  updateVacancyEmbedding,
  type NewVacancy,
} from "./vacancies.repo.js";

// How many of a user's own most-recent vacancies to scan for a possible SimHash duplicate on
// add/import — a duplicate is virtually always something added recently, so this bounds the
// check's cost independent of how large a user's full history gets.
const DEDUPE_CHECK_LIMIT = 300;

/** Same pattern as contacts.routes.ts' own assertOwnCompanyOrNull (deliberately duplicated per
 * module, not shared) — a clean 400 instead of an opaque FK-violation 500, and vacancies.companyId
 * is a plain (non-composite) FK, so this app-level check is what actually stops a cross-tenant
 * link, not just a friendlier error on top of a DB guarantee. */
export async function assertOwnCompanyOrNull(userId: UserId, companyId: number | null | undefined): Promise<void> {
  if (companyId == null) return;
  if (!(await getCompanyById(userId, companyId))) throw new HttpError(400, `Unknown company: ${companyId}`);
}

// Fire-and-forget: recomputes and stores a vacancy's embedding from its own fields (see
// vacancy-text.ts#vacancyEmbeddingText) after a create/update that touched embeddable content.
// Deliberately NOT awaited by any caller — the request that triggers this responds immediately;
// a slow or failed embeddings call must never add latency to saving a vacancy. `embed()` itself
// already never throws (llm/embeddings.ts), so nothing here needs a try/catch of its own.
export function embedVacancyInBackground(
  userId: UserId,
  id: number,
  v: { position: string; company: string; level: string; stack: string[]; notes: string },
): void {
  if (!embeddingsAvailable()) return;
  const text = vacancyEmbeddingText(v);
  if (!text) return;
  void embed(userId, text, "vacancy-embedding").then((vector) => {
    if (vector) void updateVacancyEmbedding(userId, id, vector);
  });
}

export interface CreateVacancyWithDedupeResult {
  vacancy: VacancyRow;
  possibleDuplicateOf: { id: number; company: string; position: string } | null;
}

/**
 * The single-vacancy creation path shared by POST /vacancies (vacancies.routes.ts) and the MCP
 * `add_vacancy` tool (modules/mcp/mcp-tools.ts) — one place for "create a vacancy the way this
 * app actually does it", so the MCP path never silently drifts into a thinner copy that skips the
 * SimHash near-duplicate heads-up or the auto-enrichment-from-URL both callers want. Does NOT
 * validate `input.companyId` belongs to this user — callers that accept an untrusted companyId
 * (currently only the HTTP route) must call assertOwnCompanyOrNull() themselves first.
 */
export async function createVacancyWithDedupe(userId: UserId, input: NewVacancy): Promise<CreateVacancyWithDedupeResult> {
  // Checked against the list BEFORE inserting (so the new row never matches itself) — advisory
  // only (see job-dedupe.ts#findSimhashDuplicate), never blocks the save: two postings that read
  // as "similar" (the same company re-hiring for the same role) can be genuinely distinct.
  // Bounded to the most recent DEDUPE_CHECK_LIMIT vacancies (listVacancies already orders by id
  // desc) rather than the whole table — a duplicate is virtually always something added recently.
  const possibleDuplicate =
    input.company || input.position
      ? findSimhashDuplicate(
          { company: input.company, position: input.position },
          await listVacancies(userId, { limit: DEDUPE_CHECK_LIMIT, offset: 0 }),
        )
      : undefined;
  const id = await createVacancy(userId, input);
  await recordStatusChange(userId, id, input.status);
  // Auto-enrichment: if a vacancy is added right away with a URL and no explicit stack — try
  // pulling the stack/level/fit from the vacancy text (any public https host, best-effort — see
  // tryAutoEnrichStack).
  if (input.url && input.stack.length === 0) {
    const enrichment = await tryAutoEnrichStack(userId, input.url);
    if (enrichment) {
      await updateVacancyEnrichment(userId, id, { stack: enrichment.techs, level: enrichment.level || input.level, fit: enrichment.fit });
    }
  }
  const row = await getVacancy(userId, id);
  embedVacancyInBackground(userId, id, row!);
  return {
    vacancy: row!,
    possibleDuplicateOf: possibleDuplicate
      ? { id: possibleDuplicate.id, company: possibleDuplicate.company, position: possibleDuplicate.position }
      : null,
  };
}

export interface DouImportLink {
  url: string;
  company: string;
}

export interface ImportLinks {
  douLinks: DouImportLink[];
  genericLinks: string[];
}

/**
 * Pure regex extraction of every vacancy link worth importing out of pasted HTML/text — a DOU
 * export's `/companies/<slug>/vacancies/<id>` links (whose URL structure gives us the employer
 * name for free) plus any other https:// link (a Djinni/LinkedIn/robota.ua search results page, a
 * list kept in a note, etc.). No I/O — safe to unit-test directly, unlike
 * importVacanciesFromHtml() below (which needs a DB).
 */
export function extractImportLinks(html: string): ImportLinks {
  // Declared fresh per call (not module-level): a `g`-flagged RegExp carries its scan position in
  // mutable `lastIndex` state on the object itself — sharing one module-level instance across
  // concurrent imports (two users, or the same user submitting twice back-to-back) would corrupt
  // that position mid-scan.
  const DOU_VACANCY_RE = /https:\/\/jobs\.dou\.ua\/companies\/([^/"'\s]+)\/vacancies\/(\d+)/g;
  // Any other https:// link. Trailing punctuation (a sentence's closing period, a markdown link's
  // closing paren/bracket) picked up by the greedy match is stripped since it's never actually
  // part of the URL.
  const GENERIC_VACANCY_URL_RE = /https:\/\/[^\s"'<>]+/g;
  const seen = new Set<string>();
  const douLinks: DouImportLink[] = [];

  let douMatch: RegExpExecArray | null;
  while ((douMatch = DOU_VACANCY_RE.exec(html))) {
    const dupId = douMatch[2] ?? "";
    const url = (douMatch[0] ?? "") + "/";
    if (!dupId || seen.has(url)) continue;
    seen.add(url);
    douLinks.push({ url, company: companyFromDouUrl(url) ?? "" });
  }

  // Any https:// link not already captured as a DOU one above. Unlike DOU's URL structure, these
  // don't encode a company name anywhere we can parse for free — extractTitleCompany (called
  // during enrichment) fills them in on a best-effort basis instead.
  const genericLinks: string[] = [];
  let genericMatch: RegExpExecArray | null;
  while ((genericMatch = GENERIC_VACANCY_URL_RE.exec(html))) {
    const raw = (genericMatch[0] ?? "").replace(/[)\].,;:!?]+$/, "");
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    try {
      genericLinks.push(assertSafeVacancyUrl(raw));
    } catch {
      // not a usable https vacancy link (bad host, private/internal address, etc.)
    }
  }

  return { douLinks, genericLinks };
}

export interface ImportFromHtmlResult {
  added: number;
  items: { company: string; url: string }[];
  possibleDuplicates: { company: string; url: string; of: { id: number; company: string; position: string } }[];
}

/**
 * Import vacancies from pasted HTML/text — extract every vacancy link (extractImportLinks above)
 * and immediately auto-enrich each new vacancy from its own page (best-effort, with a polite
 * pause between requests — as in fetch-all-job.ts), so a separate manual "Analyze all" click
 * after import isn't needed. POST /vacancies/import's entire business logic.
 */
export async function importVacanciesFromHtml(userId: UserId, html: string): Promise<ImportFromHtmlResult> {
  const { douLinks, genericLinks } = extractImportLinks(html);
  // `hasCompany: true` for DOU links — the company already came from the URL's own path
  // structure. The *position* is never encoded in either link shape, so extractTitleCompany
  // always runs during enrichment below regardless of this flag — it only gates whether that
  // guess is allowed to also overwrite `company` (never for DOU: the slug-derived name is
  // reliable and shouldn't be clobbered by a possibly-wrong LLM guess).
  const newIds: { id: number; url: string; hasCompany: boolean; isDou: boolean }[] = [];
  const added: { company: string; url: string }[] = [];
  // Snapshot once, before any inserts below — advisory only (see the SimHash comment on
  // createVacancyWithDedupe above). A newly-imported item's `position` is still the "(imported)"
  // placeholder until enrichment runs further down, so a title-based SimHash comparison would be
  // meaningless at this stage; the useful signal here is simply "you already track a vacancy at
  // this company" (same relaxed company-only check the Kanban/table views don't do for you
  // automatically when a company has multiple roles open at once).
  const existingSnapshot = await listVacancies(userId, { limit: DEDUPE_CHECK_LIMIT, offset: 0 });
  const possibleDuplicates: ImportFromHtmlResult["possibleDuplicates"] = [];

  for (const { url, company } of douLinks) {
    if (await findVacancyByUrl(userId, url)) continue;
    const existingAtCompany = existingSnapshot.find((v) => v.company.toLowerCase() === company.toLowerCase());
    const id = await createVacancyMinimal(userId, { company, position: "(imported)", url, status: "Want to apply" });
    await recordStatusChange(userId, id, "Want to apply");
    // The slug-derived name is reliable enough to link for real, not just store as text — same
    // non-destructive upsert the single-vacancy "Add"/"Refresh from link" flows use, so a second
    // import for an employer the user already has notes on never overwrites them.
    if (company) {
      const companyRow = await upsertCompanyEnrichment(userId, { name: company, notes: "", questions: [], website: "" });
      if (companyRow.id) await updateVacancyImportedTitle(userId, id, { companyId: companyRow.id });
    }
    newIds.push({ id, url, hasCompany: true, isDou: true });
    added.push({ company, url });
    if (existingAtCompany) {
      possibleDuplicates.push({
        company,
        url,
        of: { id: existingAtCompany.id, company: existingAtCompany.company, position: existingAtCompany.position },
      });
    }
  }

  for (const url of genericLinks) {
    if (await findVacancyByUrl(userId, url)) continue;
    const id = await createVacancyMinimal(userId, { company: "", position: "(imported)", url, status: "Want to apply" });
    await recordStatusChange(userId, id, "Want to apply");
    newIds.push({ id, url, hasCompany: false, isDou: false });
    added.push({ company: "", url });
  }

  for (const { id, url, hasCompany, isDou } of newIds) {
    const page = await safeFetchVacancyPage(url);
    if (page) {
      const { text, rawHtml } = page;
      const analysis = await quickAnalyze(userId, text);
      await updateVacancyEnrichment(userId, id, { stack: analysis.techs, level: analysis.level || "", fit: analysis.fit });

      // Full structured-facts extraction (company/position/level/salary/location/workMode/
      // employmentType/companyWebsite) — the same richer LLM call fetchVacancyDetails already
      // makes for the single-link "autofill"/"refresh" flow, replacing the narrower
      // extractTitleCompany (company/position only) this used to call. Still a single LLM call
      // either way (cost-neutral), now filling the new columns on every bulk-imported row instead
      // of leaving them blank until a later manual refresh.
      //
      // Deliberately does NOT also call summarizeVacancy() (the notes/questions LLM call) here —
      // that stays exclusive to the single-vacancy create/refresh flow. Auto-generating notes for
      // every row of a multi-link paste would be a surprising amount of prose to review, and would
      // double the LLM cost across what can be many links pasted at once. Don't "fix" this by
      // adding a summarizeVacancy() call back in.
      const facts = await extractVacancyFacts(userId, text);

      // DOU exposes a deterministic location badge in its shared page template (see
      // extractDouLocationHint) — ground truth off the actual markup, computed with no LLM call,
      // so it's filled in even fully offline. Takes priority over the LLM's guess for the same
      // fields rather than being merged with it (same "never let a guess clobber a more reliable
      // already-set value" rule the DOU-derived `company` above follows).
      const douHint = isDou ? extractDouLocationHint(rawHtml) : null;

      // Position is never encoded in the URL either way, so this always runs; only `company` is
      // gated (see `hasCompany`'s own comment above). Each field is only copied over when
      // extraction actually produced something — an empty guess for any field must never
      // overwrite the "(imported)" placeholder (or an already-set value) with blank.
      const title: {
        company?: string;
        position?: string;
        companyId?: number;
        salary?: string;
        location?: string;
        workMode?: string;
        employmentType?: string;
      } = {};
      if (facts?.position) title.position = facts.position;
      if (!hasCompany && facts?.company) {
        title.company = facts.company;
        // Same non-destructive upsert as the DOU branch above — an LLM-guessed name is less
        // certain than a URL-derived one, but still worth linking for real rather than leaving
        // the detail modal's company picker permanently empty for every generic-link import.
        const companyRow = await upsertCompanyEnrichment(userId, {
          name: facts.company,
          notes: "",
          questions: [],
          website: facts.companyWebsite || "",
        });
        if (companyRow.id) title.companyId = companyRow.id;
      }
      if (facts?.salary) title.salary = facts.salary;
      if (facts?.employmentType) title.employmentType = facts.employmentType;
      const location = douHint?.location || facts?.location || "";
      const workMode = douHint?.workMode || facts?.workMode || "";
      if (location) title.location = location;
      if (workMode) title.workMode = workMode;
      await updateVacancyImportedTitle(userId, id, title);
    }
    await new Promise((resolve) => setTimeout(resolve, 400)); // polite pause
  }

  return { added: added.length, items: added, possibleDuplicates };
}

/** Format: an array of {company, pos, level, fit, status, applied, next, notes, url} —
 * compatible with a file the user maintains themselves outside the app (e.g. another AI
 * chat/spreadsheet), so they can "drop" the updated file and sync data without manually retyping
 * it. Upserts by `url` first, then by (company, position) — POST /vacancies/import-json's
 * per-item logic. */
export async function upsertJsonVacancy(userId: UserId, item: JsonVacancyItem): Promise<{ result: "added" | "updated"; id: number }> {
  let existing = item.url ? await findVacancyByUrl(userId, item.url) : undefined;
  if (!existing && item.company && item.position) {
    existing = await findVacancyByCompanyPosition(userId, item.company, item.position);
  }
  if (existing) {
    await updateVacancyFromJson(userId, existing.id, item);
    if (item.status !== existing.status) await recordStatusChange(userId, existing.id, item.status);
    return { result: "updated", id: existing.id };
  }
  const id = await createVacancyFromJson(userId, item);
  await recordStatusChange(userId, id, item.status);
  return { result: "added", id };
}

export interface ImportJsonResult {
  added: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
  possibleDuplicates: { index: number; company: string; position: string; of: { id: number; company: string; position: string } }[];
}

/**
 * POST /vacancies/import-json's entire business logic: parses+validates each raw item (one bad
 * item is recorded in `errors` and skipped, not fatal to the batch), upserts it, and — for newly
 * added items with a URL — auto-enriches the stack the same way a single "Add" with a URL does.
 */
export async function importJsonVacancies(userId: UserId, items: unknown[]): Promise<ImportJsonResult> {
  // Snapshot BEFORE the loop — a possible-duplicate check compares each newly-added item against
  // vacancies that existed before this import started, not against siblings added earlier in the
  // same batch (advisory only, see job-dedupe.ts#findSimhashDuplicate's own doc comment; catching
  // in-batch near-duplicates too would need re-snapshotting after every insert, not worth it for
  // what's already a best-effort heads-up).
  const existingSnapshot = await listVacancies(userId, { limit: DEDUPE_CHECK_LIMIT, offset: 0 });
  let added = 0;
  let updated = 0;
  const errors: ImportJsonResult["errors"] = [];
  const possibleDuplicates: ImportJsonResult["possibleDuplicates"] = [];
  for (const [index, raw] of items.entries()) {
    try {
      const item = parseJsonVacancyItem(raw);
      const dup =
        item.company || item.position
          ? findSimhashDuplicate({ company: item.company, position: item.position }, existingSnapshot)
          : undefined;
      const { result, id } = await upsertJsonVacancy(userId, item);
      if (result === "added") {
        added++;
        if (dup) {
          possibleDuplicates.push({
            index,
            company: item.company,
            position: item.position,
            of: { id: dup.id, company: dup.company, position: dup.position },
          });
        }
      } else updated++;
      // Auto-enrichment only for NEW vacancies with a link: the job-tracker.json format doesn't
      // include a stack, and for existing ones (updated) we don't touch the stack on every
      // resync, so we don't overwrite something that may have already been fine-tuned manually in
      // the app.
      if (result === "added" && item.url) {
        const enrichment = await tryAutoEnrichStack(userId, item.url);
        if (enrichment) {
          await updateVacancyEnrichment(userId, id, {
            stack: enrichment.techs,
            level: enrichment.level || item.level,
            fit: enrichment.fit,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 400)); // polite pause
      }
    } catch (e) {
      errors.push({ index, message: e instanceof HttpError ? e.message : "Unknown error" });
    }
  }
  if (errors.length > 0) {
    contextLogger().warn({ total: items.length, added, updated, failed: errors.length }, "JSON vacancy import: some items failed");
  }
  return { added, updated, skipped: errors.length, errors, possibleDuplicates };
}
