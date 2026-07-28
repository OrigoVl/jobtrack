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

  it("an unauthenticated request never reaches another user's data — it's rejected before any query runs", async () => {
    const noAuthVacancies = await fetch(`${BASE_URL}/api/vacancies`);
    expect(noAuthVacancies.status).toBe(401);
    const noAuthProfile = await fetch(`${BASE_URL}/api/profile`);
    expect(noAuthProfile.status).toBe(401);
  });
});
