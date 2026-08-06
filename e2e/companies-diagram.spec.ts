import { test, expect } from "@playwright/test";

/**
 * End-to-end test of a company's freeform architecture diagram (reuses the design trainer's
 * canvas, server/src/modules/companies/companies.routes.ts's GET/PUT /companies/:id/diagram).
 * Drag-and-drop onto the canvas isn't exercised here — same "sidestep real HTML5 DnD in e2e"
 * convention as vacancies-kanban.spec.ts — instead this confirms the read/save wiring: the
 * section starts empty, and a diagram saved via the real API round-trips after a reload.
 */
test("company diagram section loads and reflects a saved diagram after reload", async ({ page }) => {
  await page.goto("/companies");

  const name = `E2E Diagram Co ${Date.now()}`;
  await page.getByLabel("Company name").fill(name);
  const [addRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/companies") && r.request().method() === "POST"),
    page.getByRole("button", { name: "+ Add" }).click(),
  ]);
  expect(addRes.ok()).toBeTruthy();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const companies = (await (await page.request.get("/api/companies")).json()) as { id: number; name: string }[];
  const company = companies.find((c) => c.name === name);
  expect(company).toBeTruthy();

  // Opening the section fetches the (currently empty) diagram — confirms the GET wiring and that
  // an empty canvas renders without error.
  const [getRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/companies/${company!.id}/diagram`) && r.request().method() === "GET"),
    page.getByRole("button", { name: `Show system diagram for ${name}` }).click(),
  ]);
  expect(getRes.ok()).toBeTruthy();
  expect(await getRes.json()).toBeNull();

  // Save a diagram directly via the real API (not through drag-and-drop), then confirm it
  // survives a reload and the section reflects it as non-empty.
  const diagram = { nodes: [{ id: "1", kind: "client", label: "Client", x: 0, y: 0 }], edges: [] };
  const putRes = await page.request.put(`/api/companies/${company!.id}/diagram`, { data: diagram });
  expect(putRes.ok()).toBeTruthy();

  await page.reload();
  const [reopenRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/companies/${company!.id}/diagram`) && r.request().method() === "GET"),
    page.getByRole("button", { name: `Show system diagram for ${name}` }).click(),
  ]);
  const reopened = await reopenRes.json();
  expect(reopened.nodes).toHaveLength(1);
  expect(reopened.nodes[0].label).toBe("Client");
});
