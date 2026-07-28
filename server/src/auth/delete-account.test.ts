// Full end-to-end verification of self-service account deletion (Phase 7) against a real
// Express+better-auth+Drizzle stack (PGlite-backed) — same pattern as
// security/cross-tenant-isolation.test.ts. Extracts the confirmation token directly from the
// `verification` table instead of parsing a log line: RESEND_API_KEY isn't set in tests, so
// sendEmail() only logs the link (see auth/email.ts) — reading the row the request itself wrote
// is simpler and doesn't couple the test to log formatting.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import { createTestDb } from "../db/test-db.js";
import { eq, like } from "drizzle-orm";

const PORT = 58733; // fixed, distinct from cross-tenant-isolation.test.ts's 58732
process.env.PORT = String(PORT);
const BASE_URL = `http://localhost:${PORT}`;

let server: Server;

async function registerAndSignIn(email: string): Promise<string> {
  const password = "password1234";
  await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name: "Test User" }),
  });
  const { default: db } = await import("../db/client.js");
  const { user } = await import("../db/schema/index.js");
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
  });
  return signIn.headers.get("set-cookie")!.split(";")[0]!;
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

describe("self-service account deletion (PGlite, real HTTP)", () => {
  it("request → email-confirmation token → confirm deletes the user AND cascades to their vacancies", async () => {
    const cookie = await registerAndSignIn("delete-me@example.test");

    const vacancyRes = await fetch(`${BASE_URL}/api/vacancies`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ company: "Acme", position: "Engineer" }),
    });
    expect(vacancyRes.status).toBe(201);

    const requestDelete = await fetch(`${BASE_URL}/api/auth/delete-user`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: BASE_URL },
      body: "{}",
    });
    expect(requestDelete.status).toBe(200);
    const requestBody = (await requestDelete.json()) as { success: boolean; message: string };
    expect(requestBody).toEqual({ success: true, message: "Verification email sent" });

    const { default: db } = await import("../db/client.js");
    const { verification, user, vacancies } = await import("../db/schema/index.js");
    const [row] = await db.select().from(verification).where(like(verification.identifier, "delete-account-%"));
    expect(row).toBeTruthy();
    const token = row!.identifier.replace("delete-account-", "");

    const confirm = await fetch(`${BASE_URL}/api/auth/delete-user/callback?token=${token}`, {
      headers: { cookie, origin: BASE_URL },
      redirect: "manual",
    });
    expect(confirm.status).toBe(200);
    const confirmBody = (await confirm.json()) as { success: boolean; message: string };
    expect(confirmBody).toEqual({ success: true, message: "User deleted" });

    const [deletedUser] = await db.select().from(user).where(eq(user.email, "delete-me@example.test"));
    expect(deletedUser).toBeUndefined();
    const remainingVacancies = await db.select().from(vacancies);
    expect(remainingVacancies).toEqual([]); // ON DELETE CASCADE removed it along with the user row
  });

  it("a stale/unknown token is rejected, not silently accepted", async () => {
    const cookie = await registerAndSignIn("still-here@example.test");
    const res = await fetch(`${BASE_URL}/api/auth/delete-user/callback?token=not-a-real-token`, { headers: { cookie, origin: BASE_URL } });
    expect(res.status).toBe(404);
    const { default: db } = await import("../db/client.js");
    const { user } = await import("../db/schema/index.js");
    const [stillThere] = await db.select().from(user).where(eq(user.email, "still-here@example.test"));
    expect(stillThere).toBeTruthy();
  });
});
