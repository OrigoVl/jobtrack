import express from "express";
import { HttpError, authed } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { getProfile } from "../../db/index.js";
import { parseContactInput, parseEnrichmentQuery, parsePostingContactsInput } from "../../shared/validation.js";
import { getCompanyById } from "../companies/companies.repo.js";
import { getVacancy } from "../vacancies/vacancies.repo.js";
import { listContacts, getContact, createContact, updateContact, deleteContact } from "./contacts.repo.js";
import { draftOutreachMessage, type OutreachKind } from "./contacts-outreach.service.js";
import { enrichContacts } from "./enrichment/enrichment.service.js";
import { extractPostingContacts } from "./enrichment/posting-contacts.js";
import { ENRICHMENT_PROVIDERS } from "./enrichment/enrichment-providers.js";
import type { UserId } from "../../db/user-id.js";

const r = express.Router();

/** Same "clean 400, not an opaque FK-violation 500" pattern as calendar.routes.ts'
 * assertOwnVacancyOrNull — the composite FK (schema/app.ts) is still the structural guarantee,
 * this is just a friendlier error for the common case of a bad/foreign id. */
async function assertOwnCompanyOrNull(userId: UserId, companyId: number | null | undefined): Promise<void> {
  if (companyId == null) return;
  if (!(await getCompanyById(userId, companyId))) throw new HttpError(400, `Unknown company: ${companyId}`);
}

/** Same pattern as calendar.routes.ts' assertOwnVacancyOrNull — contacts.vacancyId is a plain
 * (non-composite) FK, so this app-level check is what actually stops a cross-tenant link, not
 * just a friendlier error on top of a DB guarantee. */
async function assertOwnVacancyOrNull(userId: UserId, vacancyId: number | null | undefined): Promise<void> {
  if (vacancyId == null) return;
  if (!(await getVacancy(userId, vacancyId))) throw new HttpError(400, `Unknown vacancy: ${vacancyId}`);
}

// ---------- contacts (networking tracker) ----------
r.get(
  "/contacts",
  authed(async (userId, _req, res) => {
    res.json(await listContacts(userId));
  }),
);

r.post(
  "/contacts",
  authed(async (userId, req, res) => {
    const b = parseContactInput(req.body, { partial: false });
    if (!b.name) throw new HttpError(400, "Contact name is required", null, "CONTACT_NAME_REQUIRED");
    await assertOwnCompanyOrNull(userId, b.companyId);
    await assertOwnVacancyOrNull(userId, b.vacancyId);
    const contact = await createContact(userId, {
      name: b.name,
      role: b.role!,
      companyId: b.companyId ?? null,
      vacancyId: b.vacancyId ?? null,
      email: b.email!,
      linkedinUrl: b.linkedinUrl!,
      notes: b.notes!,
      lastContactAt: b.lastContactAt!,
    });
    res.status(201).json(contact);
  }),
);

r.put(
  "/contacts/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    if (!(await getContact(userId, id))) throw new HttpError(404, "Contact not found", null, "CONTACT_NOT_FOUND");
    const b = parseContactInput(req.body, { partial: true });
    if (Object.prototype.hasOwnProperty.call(b, "companyId")) await assertOwnCompanyOrNull(userId, b.companyId);
    if (Object.prototype.hasOwnProperty.call(b, "vacancyId")) await assertOwnVacancyOrNull(userId, b.vacancyId);
    res.json(await updateContact(userId, id, b));
  }),
);

r.delete(
  "/contacts/:id",
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    const deleted = await deleteContact(userId, id);
    res.json({ ok: true, deleted });
  }),
);

// ---------- LLM: outreach/follow-up message draft ----------
r.post(
  "/contacts/:id/outreach",
  aiLimiter,
  authed(async (userId, req, res) => {
    const id = Number(req.params.id);
    const contact = await getContact(userId, id);
    if (!contact) throw new HttpError(404, "Contact not found", null, "CONTACT_NOT_FOUND");
    const kind: OutreachKind = req.body?.kind === "followup" ? "followup" : "intro";
    const [profile, company, vacancy] = await Promise.all([
      getProfile(userId),
      contact.companyId != null ? getCompanyById(userId, contact.companyId) : Promise.resolve(undefined),
      contact.vacancyId != null ? getVacancy(userId, contact.vacancyId) : Promise.resolve(undefined),
    ]);
    const result = await draftOutreachMessage(userId, profile, contact, kind, {
      companyName: company?.name,
      vacancyPosition: vacancy?.position,
    });
    res.json(result);
  }),
);

// ---------- contact enrichment (Hunter.io/Apollo.io/Snov.io + keyless pattern-guess fallback) ----------
r.post(
  "/contacts/enrich",
  aiLimiter,
  authed(async (userId, req, res) => {
    const q = parseEnrichmentQuery(req.body);
    // A companyId was given but no explicit domain — resolve one from that company's own
    // `website`, and default companyName from it too, so the client doesn't have to duplicate a
    // company's name/website into every enrichment request by hand.
    const companyIdRaw = (req.body as Record<string, unknown> | null)?.companyId;
    if (!q.domain && companyIdRaw != null && companyIdRaw !== "") {
      const companyId = Number(companyIdRaw);
      if (Number.isInteger(companyId) && companyId > 0) {
        const company = await getCompanyById(userId, companyId);
        if (company?.website) q.domain = company.website;
        if (company?.name && !q.companyName) q.companyName = company.name;
      }
    }
    res.json(await enrichContacts(userId, q));
  }),
);

// ---------- exact contacts stated in a posting's own text (no guessing — posting-contacts.ts) ----------
r.post(
  "/contacts/extract",
  aiLimiter,
  authed(async (userId, req, res) => {
    const input = parsePostingContactsInput(req.body);
    let text = input.text;
    if (input.vacancyId) {
      // getVacancy() is userId-scoped, so a foreign/unknown id reads as "not found" rather than
      // leaking another account's posting text into this user's extraction.
      const vacancy = await getVacancy(userId, input.vacancyId);
      if (!vacancy) throw new HttpError(404, "Vacancy not found");
      text = [vacancy.notes, vacancy.position, vacancy.company].filter(Boolean).join("\n");
    }
    res.json({ contacts: await extractPostingContacts(userId, text) });
  }),
);

r.post(
  "/contacts/enrich/reveal",
  aiLimiter,
  authed(async (_userId, req, res) => {
    const providerName = (req.body as Record<string, unknown> | null)?.provider;
    const provider = ENRICHMENT_PROVIDERS.find((p) => p.name === providerName);
    if (!provider?.reveal) throw new HttpError(400, "Unknown or non-revealing provider");
    const revealId = String((req.body as Record<string, unknown> | null)?.revealId ?? "");
    res.json(await provider.reveal(revealId));
  }),
);

export default r;
