// The single most expensive class of bug this migration could introduce: one user's request
// returning another user's data. This exercises the REAL app (real Express routing, real
// better-auth sessions, real Drizzle queries) end-to-end over actual HTTP — not a mocked
// approximation of it — against a disposable PGlite-backed Postgres (real Postgres semantics,
// no Docker required).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import { createTestDb } from "../db/test-db.js";

const PORT = 58732; // fixed — must match env.auth.baseUrl's default (http://localhost:PORT),
// or better-auth rejects every request for an untrusted Origin.
process.env.PORT = String(PORT);
const BASE_URL = `http://localhost:${PORT}`;

let server: Server;

interface Session {
  email: string;
  cookie: string;
}

async function registerAndSignIn(email: string): Promise<Session> {
  const password = "password1234";
  const signUp = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name: "Test User" }),
  });
  expect(signUp.ok).toBe(true);

  const { default: db } = await import("../db/client.js");
  const { user } = await import("../db/schema/index.js");
  const { eq } = await import("drizzle-orm");
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

  const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
  });
  expect(signIn.ok).toBe(true);
  const cookie = signIn.headers.get("set-cookie")!.split(";")[0]!;
  return { email, cookie };
}

async function api(session: Session, path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: session.cookie, ...init.headers },
  });
}

beforeAll(async () => {
  const testDb = await createTestDb();
  vi.doMock("../db/client.js", () => ({ default: testDb }));

  const { app } = await import("../app.js");
  server = app.listen(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
}, 20_000);

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("cross-tenant isolation (PGlite, real HTTP)", () => {
  it("neither user's vacancies/companies/profile are visible to the other, across create/list/get/update/delete", async () => {
    const alice = await registerAndSignIn("alice@example.test");
    const bob = await registerAndSignIn("bob@example.test");

    // Each creates their own data.
    const aliceVacancyRes = await api(alice, "/vacancies", {
      method: "POST",
      body: JSON.stringify({ company: "Alice Co", position: "Engineer" }),
    });
    expect(aliceVacancyRes.status).toBe(201);
    const aliceVacancy = (await aliceVacancyRes.json()) as { id: number };

    const bobVacancyRes = await api(bob, "/vacancies", {
      method: "POST",
      body: JSON.stringify({ company: "Bob Co", position: "Designer" }),
    });
    expect(bobVacancyRes.status).toBe(201);
    const bobVacancy = (await bobVacancyRes.json()) as { id: number };

    await api(alice, "/companies", { method: "POST", body: JSON.stringify({ name: "Alice's Client", notes: "secret notes" }) });
    await api(bob, "/companies", { method: "POST", body: JSON.stringify({ name: "Bob's Client", notes: "other secret" }) });

    await api(alice, "/profile", { method: "PUT", body: JSON.stringify({ domain: "Alice's role" }) });
    await api(bob, "/profile", { method: "PUT", body: JSON.stringify({ domain: "Bob's role" }) });

    // Lists only ever show the caller's own rows.
    const aliceVacancies = (await (await api(alice, "/vacancies")).json()) as { company: string }[];
    const bobVacancies = (await (await api(bob, "/vacancies")).json()) as { company: string }[];
    expect(aliceVacancies.map((v) => v.company)).toEqual(["Alice Co"]);
    expect(bobVacancies.map((v) => v.company)).toEqual(["Bob Co"]);

    const aliceCompanies = (await (await api(alice, "/companies")).json()) as { name: string }[];
    const bobCompanies = (await (await api(bob, "/companies")).json()) as { name: string }[];
    expect(aliceCompanies.map((c) => c.name)).toEqual(["Alice's Client"]);
    expect(bobCompanies.map((c) => c.name)).toEqual(["Bob's Client"]);

    // Profiles never leak into each other, even though both were created via the same
    // "PUT /profile merges with the existing profile" endpoint.
    const aliceProfile = (await (await api(alice, "/profile")).json()) as { domain: string };
    const bobProfile = (await (await api(bob, "/profile")).json()) as { domain: string };
    expect(aliceProfile.domain).toBe("Alice's role");
    expect(bobProfile.domain).toBe("Bob's role");

    // Reading/mutating another user's resource BY ID must behave as "not found", not "found
    // and returns/changes it" — a repository-layer leak (missing WHERE user_id) would make
    // these succeed instead.
    const bobReadsAlicesVacancy = await api(bob, `/vacancies/${aliceVacancy.id}`, {
      method: "PUT",
      body: JSON.stringify({ notes: "hijacked" }),
    });
    expect(bobReadsAlicesVacancy.status).toBe(404);
    const aliceVacancyUnchanged = (await (await api(alice, `/vacancies`)).json()) as { id: number; notes: string }[];
    expect(aliceVacancyUnchanged.find((v) => v.id === aliceVacancy.id)?.notes).not.toBe("hijacked");

    const aliceDeletesBobsVacancy = await api(alice, `/vacancies/${bobVacancy.id}`, { method: "DELETE" });
    const aliceDeleteBody = (await aliceDeletesBobsVacancy.json()) as { deleted: number };
    expect(aliceDeleteBody.deleted).toBe(0); // scoped delete affected zero rows, not Bob's vacancy
    const bobVacancyStillThere = (await (await api(bob, "/vacancies")).json()) as { id: number }[];
    expect(bobVacancyStillThere.some((v) => v.id === bobVacancy.id)).toBe(true);
  });

  it("neither user's calendar events are visible to the other, and a manual event can't be linked to the other's vacancy", async () => {
    const carol = await registerAndSignIn("carol@example.test");
    const dave = await registerAndSignIn("dave@example.test");

    const carolVacancyRes = await api(carol, "/vacancies", {
      method: "POST",
      body: JSON.stringify({ company: "Carol Co", position: "Engineer" }),
    });
    const carolVacancy = (await carolVacancyRes.json()) as { id: number };

    const carolEventRes = await api(carol, "/calendar/events", {
      method: "POST",
      body: JSON.stringify({ title: "Carol's interview", startAt: "2026-09-01T10:00:00.000Z", type: "interview" }),
    });
    expect(carolEventRes.status).toBe(201);
    const carolEvent = (await carolEventRes.json()) as { id: number };

    const daveEventRes = await api(dave, "/calendar/events", {
      method: "POST",
      body: JSON.stringify({ title: "Dave's reminder", startAt: "2026-09-02T10:00:00.000Z", type: "reminder" }),
    });
    const daveEvent = (await daveEventRes.json()) as { id: number };

    // Lists only ever show the caller's own rows.
    const carolEvents = (await (await api(carol, "/calendar/events")).json()) as { title: string }[];
    const daveEvents = (await (await api(dave, "/calendar/events")).json()) as { title: string }[];
    expect(carolEvents.map((e) => e.title)).toEqual(["Carol's interview"]);
    expect(daveEvents.map((e) => e.title)).toEqual(["Dave's reminder"]);

    // Dave can't link his own event to Carol's vacancy — a clean 400, not a leak/crash.
    const daveLinksCarolsVacancy = await api(dave, `/calendar/events/${daveEvent.id}`, {
      method: "PUT",
      body: JSON.stringify({ vacancyId: carolVacancy.id }),
    });
    expect(daveLinksCarolsVacancy.status).toBe(400);

    // Editing/deleting another user's event by id behaves as "not found"/"affected nothing".
    const daveEditsCarolsEvent = await api(dave, `/calendar/events/${carolEvent.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: "hijacked" }),
    });
    expect(daveEditsCarolsEvent.status).toBe(404);

    const daveDeletesCarolsEvent = await api(dave, `/calendar/events/${carolEvent.id}`, { method: "DELETE" });
    const daveDeleteBody = (await daveDeletesCarolsEvent.json()) as { deleted: number };
    expect(daveDeleteBody.deleted).toBe(0);
    const carolEventStillThere = (await (await api(carol, "/calendar/events")).json()) as { id: number }[];
    expect(carolEventStillThere.some((e) => e.id === carolEvent.id)).toBe(true);
  });

  it("neither user's contacts are visible to the other, and a contact can't be linked to the other's company", async () => {
    const erin = await registerAndSignIn("erin@example.test");
    const frank = await registerAndSignIn("frank@example.test");

    const erinCompanyRes = await api(erin, "/companies", { method: "POST", body: JSON.stringify({ name: "Erin's Co" }) });
    expect(erinCompanyRes.ok).toBeTruthy();
    const erinCompanies = (await (await api(erin, "/companies")).json()) as { id: number }[];
    const erinCompanyId = erinCompanies[0]!.id;

    const erinContactRes = await api(erin, "/contacts", { method: "POST", body: JSON.stringify({ name: "Erin's contact" }) });
    expect(erinContactRes.status).toBe(201);
    const erinContact = (await erinContactRes.json()) as { id: number };

    const frankContactRes = await api(frank, "/contacts", { method: "POST", body: JSON.stringify({ name: "Frank's contact" }) });
    const frankContact = (await frankContactRes.json()) as { id: number };

    const erinContacts = (await (await api(erin, "/contacts")).json()) as { name: string }[];
    const frankContacts = (await (await api(frank, "/contacts")).json()) as { name: string }[];
    expect(erinContacts.map((c) => c.name)).toEqual(["Erin's contact"]);
    expect(frankContacts.map((c) => c.name)).toEqual(["Frank's contact"]);

    // Frank can't link his own contact to Erin's company — a clean 400, not a leak/crash.
    const frankLinksErinsCompany = await api(frank, `/contacts/${frankContact.id}`, {
      method: "PUT",
      body: JSON.stringify({ companyId: erinCompanyId }),
    });
    expect(frankLinksErinsCompany.status).toBe(400);

    const frankEditsErinsContact = await api(frank, `/contacts/${erinContact.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: "hijacked" }),
    });
    expect(frankEditsErinsContact.status).toBe(404);

    const frankDeletesErinsContact = await api(frank, `/contacts/${erinContact.id}`, { method: "DELETE" });
    const frankDeleteBody = (await frankDeletesErinsContact.json()) as { deleted: number };
    expect(frankDeleteBody.deleted).toBe(0);
  });

  it("a public CV share link only ever serves its OWN owner's doc, and never leaks after being disabled", async () => {
    const gina = await registerAndSignIn("gina@example.test");
    const heidi = await registerAndSignIn("heidi@example.test");

    await api(gina, "/cv/doc", { method: "PUT", body: JSON.stringify({ name: "Gina Public", title: "Engineer" }) });
    await api(heidi, "/cv/doc", { method: "PUT", body: JSON.stringify({ name: "Heidi Public", title: "Designer" }) });

    const shareRes = await api(gina, "/cv/share", { method: "POST" });
    const share = (await shareRes.json()) as { slug: string; enabled: boolean };

    // No cookie at all — this is the whole point of a PUBLIC share link.
    const publicRes = await fetch(`${BASE_URL}/api/cv/public/${share.slug}`);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as { doc: { name: string } };
    expect(publicBody.doc.name).toBe("Gina Public");
    // Never leaks anything beyond the doc itself (no email/session/other-field keys).
    expect(Object.keys(publicBody)).toEqual(["doc"]);

    // Someone else's random-looking slug never resolves to Gina's (or anyone's) data.
    const wrongSlugRes = await fetch(`${BASE_URL}/api/cv/public/not-a-real-slug`);
    expect(wrongSlugRes.status).toBe(404);

    // Disabling it takes effect immediately, even though the slug itself didn't change.
    await api(gina, "/cv/share", { method: "PUT", body: JSON.stringify({ enabled: false }) });
    const disabledRes = await fetch(`${BASE_URL}/api/cv/public/${share.slug}`);
    expect(disabledRes.status).toBe(404);
  });

  it("an unauthenticated request never reaches another user's data — it's rejected before any query runs", async () => {
    const noAuthVacancies = await fetch(`${BASE_URL}/api/vacancies`);
    expect(noAuthVacancies.status).toBe(401);
    const noAuthProfile = await fetch(`${BASE_URL}/api/profile`);
    expect(noAuthProfile.status).toBe(401);
  });

  it("admin routes (Phase 6) reject a logged-in non-admin with 403, and serve an admin with 200", async () => {
    const regular = await registerAndSignIn("regular@example.test");
    const forbidden = await api(regular, "/admin/overview");
    expect(forbidden.status).toBe(403);

    const admin = await registerAndSignIn("admin@example.test");
    const { default: db } = await import("../db/client.js");
    const { user } = await import("../db/schema/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@example.test"));

    const allowed = await api(admin, "/admin/overview");
    expect(allowed.status).toBe(200);
    const overview = (await allowed.json()) as { totalUsers: number };
    expect(overview.totalUsers).toBeGreaterThanOrEqual(2); // at least alice/bob from the test above, plus these two
  });
});
