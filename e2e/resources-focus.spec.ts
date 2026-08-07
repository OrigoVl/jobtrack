import { test, expect } from "@playwright/test";

// The focus note is normally derived (profile skills + gaps from tracked vacancies — see
// server/src/modules/resources/resources.service.ts), so this spec seeds a vacancy with a stack
// to guarantee the suggestion chips have something to offer, and resets the override up front:
// the e2e account is shared, and a previous run of THIS spec would otherwise leave a custom
// focus behind and make the "starts on auto" half of the flow untestable.
test.beforeEach(async ({ page }) => {
  await page.request.post("/api/vacancies", {
    data: { company: "E2E Focus Seed", position: "Seed", stack: ["Kafka", "Kubernetes", "GraphQL"] },
  });
  await page.request.put("/api/resources/focus", { data: { text: "" } });
});

test("replaces the generated focus with your own text and puts it back on auto", async ({ page }) => {
  await page.goto("/resources");

  const card = page.getByText("Your focus:").locator("..");
  await expect(card).toBeVisible();
  const generated = ((await card.textContent()) ?? "").trim();
  expect(generated).not.toContain("custom");

  await page.getByRole("button", { name: "Edit" }).click();
  const field = page.getByRole("textbox", { name: "Your focus" });
  await expect(field).toBeVisible();

  // A suggestion only PREFILLS the field — which techs make the top 5 depends on every vacancy in
  // the shared DB, so this asserts the prefill mechanism, not one particular tech.
  const suggestion = page.getByRole("group", { name: "Suggestions:" }).getByRole("button").first();
  const tech = ((await suggestion.textContent()) ?? "").trim();
  expect(tech).not.toBe("");
  await suggestion.click();
  await expect(field).toHaveValue(`This week — focus on ${tech}.`);

  // ...and the user can then write something else entirely over it.
  await field.fill("Finish the pipeline course before Friday.");
  const [saved] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/resources/focus") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Save" }).click(),
  ]);
  expect(saved.ok()).toBeTruthy();

  await expect(card).toContainText("Finish the pipeline course before Friday.");
  await expect(card).toContainText("custom");

  await page.reload();
  await expect(page.getByText("Finish the pipeline course before Friday.")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("textbox", { name: "Your focus" })).toHaveValue("Finish the pipeline course before Friday.");
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/resources/focus") && r.request().method() === "PUT"),
    page.getByRole("button", { name: "Back to auto" }).click(),
  ]);

  await expect(page.getByText("Finish the pipeline course before Friday.")).toBeHidden();
  await expect(page.getByText("Your focus:")).toBeVisible();
});
