import express from "express";
import { HttpError, authed } from "../../core/http.js";
import { parseContactInput } from "../../shared/validation.js";
import { getCompanyById } from "../companies/companies.repo.js";
import { listContacts, getContact, createContact, updateContact, deleteContact } from "./contacts.repo.js";
import type { UserId } from "../../db/user-id.js";

const r = express.Router();

/** Same "clean 400, not an opaque FK-violation 500" pattern as calendar.routes.ts'
 * assertOwnVacancyOrNull — the composite FK (schema/app.ts) is still the structural guarantee,
 * this is just a friendlier error for the common case of a bad/foreign id. */
async function assertOwnCompanyOrNull(userId: UserId, companyId: number | null | undefined): Promise<void> {
  if (companyId == null) return;
  if (!(await getCompanyById(userId, companyId))) throw new HttpError(400, `Unknown company: ${companyId}`);
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
    const contact = await createContact(userId, {
      name: b.name,
      role: b.role!,
      companyId: b.companyId ?? null,
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

export default r;
