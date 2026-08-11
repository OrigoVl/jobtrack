// The whole point of this module is "exact, never guessed", so the tests that matter most are the
// ones proving it can't emit an address the posting doesn't contain — including when the model
// (or a posting trying to prompt-inject one) hands it a plausible-looking fake.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../../db/user-id.js";

const { chatJson, llmAvailable, checkMailDomains } = vi.hoisted(() => ({
  chatJson: vi.fn(),
  llmAvailable: vi.fn(() => false),
  checkMailDomains: vi.fn(async () => new Map<string, string>()),
}));

// Mocked so the suite never touches a real resolver — mx-check.ts has its own tests for the
// lookup logic, and a unit test that depends on DNS is a flaky test.
vi.mock("./mx-check.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mx-check.js")>()),
  checkMailDomains,
}));

vi.mock("../../../llm/index.js", () => ({
  chatJson,
  llmAvailable,
  quoteUntrustedText: (label: string, text: string) => `--- ${label} ---\n${text}`,
}));

const UA_POSTING = `Шукаємо Senior Node.js розробника у продуктову компанію.
Стек: TypeScript, PostgreSQL, Docker.
Контактна особа: Ірина Мельник
Резюме надсилайте на iryna.melnyk@acme.com або пишіть у телеграм @iryna_hr`;

describe("findContactsInText()", () => {
  it("pulls an email out of a Ukrainian posting and attaches the named contact person", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");
    const found = findContactsInText(UA_POSTING);

    const email = found.find((c) => c.channel === "email")!;
    expect(email.value).toBe("iryna.melnyk@acme.com");
    expect(email.name).toBe("Ірина Мельник");
  });

  it("reads both Telegram spellings and normalizes them to @handle", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");

    expect(findContactsInText("пиши @recruiter_ua").map((c) => c.value)).toContain("@recruiter_ua");
    expect(findContactsInText("Telegram: https://t.me/recruiter_ua").map((c) => c.value)).toContain("@recruiter_ua");
  });

  it("does not mistake the domain part of an email for a Telegram handle", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");
    const found = findContactsInText("CV: hello@example.com");

    expect(found.map((c) => c.channel)).toEqual(["email"]);
  });

  it("leaves a role address unnamed even when the text names someone", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");
    const found = findContactsInText("Рекрутер: Ірина Мельник\nПишіть на hr@acme.com");

    expect(found.find((c) => c.channel === "email")!.name).toBe("");
  });

  it("attaches no name at all when the posting names two different people", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");
    const found = findContactsInText("Рекрутер: Ірина Мельник\nКонтактна особа: Олег Петренко\nПишіть на iryna@acme.com");

    expect(found.find((c) => c.channel === "email")!.name).toBe("");
  });

  it("finds a LinkedIn profile url", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");
    const found = findContactsInText("Profile: https://www.linkedin.com/in/iryna-melnyk/");

    expect(found).toEqual([expect.objectContaining({ channel: "linkedin", value: "https://www.linkedin.com/in/iryna-melnyk/" })]);
  });

  it("returns nothing for a posting with no contact details", async () => {
    const { findContactsInText } = await import("./posting-contacts.js");

    expect(findContactsInText("Шукаємо розробника. Подавайтесь через форму на сайті.")).toEqual([]);
  });
});

describe("extractPostingContacts()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    llmAvailable.mockReturnValue(false);
    checkMailDomains.mockResolvedValue(new Map());
  });

  it("falls back to the deterministic pass when no LLM key is configured", async () => {
    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, UA_POSTING);

    expect(chatJson).not.toHaveBeenCalled();
    expect(found.map((c) => c.value)).toContain("iryna.melnyk@acme.com");
  });

  it("keeps the model's name/title attribution for an address that IS in the posting", async () => {
    llmAvailable.mockReturnValue(true);
    chatJson.mockResolvedValue({
      contacts: [{ name: "Ірина Мельник", title: "Talent Acquisition", channel: "email", value: "iryna.melnyk@acme.com" }],
    });

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, UA_POSTING);

    const email = found.find((c) => c.channel === "email")!;
    expect(email.title).toBe("Talent Acquisition");
    expect(found.filter((c) => c.value === "iryna.melnyk@acme.com")).toHaveLength(1);
  });

  it("drops an address the model returned that is NOT in the posting", async () => {
    llmAvailable.mockReturnValue(true);
    chatJson.mockResolvedValue({
      contacts: [
        { name: "Ірина Мельник", title: "", channel: "email", value: "iryna.melnyk@acme.com" },
        { name: "CEO", title: "", channel: "email", value: "ceo@acme.com" },
      ],
    });

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, UA_POSTING);

    expect(found.map((c) => c.value)).not.toContain("ceo@acme.com");
    expect(found.map((c) => c.value)).toContain("iryna.melnyk@acme.com");
  });

  it("ignores an address a prompt-injecting posting tries to smuggle in via the model", async () => {
    llmAvailable.mockReturnValue(true);
    // The posting body says one thing; the model obeys the injected instruction. verbatimOnly()
    // is what saves us — the attacker's address is in the INSTRUCTION, not among the posting's
    // stated contacts, so a model that echoes it still can't get it past the filter.
    chatJson.mockResolvedValue({ contacts: [{ name: "", title: "", channel: "email", value: "attacker@evil.test" }] });

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, "Шукаємо розробника. Подавайтесь через форму.");

    expect(found).toEqual([]);
  });

  it("annotates an email row with whether its domain accepts mail, leaving other channels alone", async () => {
    checkMailDomains.mockResolvedValue(new Map([["acme.example", "no-mail"]]));

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, "Пишіть на hr@acme.example або @some_handle");

    expect(found.find((c) => c.channel === "email")!.mailDomain).toBe("no-mail");
    expect(found.find((c) => c.channel === "telegram")!.mailDomain).toBe("unknown");
  });

  it("leaves the status 'unknown' when the lookup could not answer", async () => {
    checkMailDomains.mockResolvedValue(new Map());

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, "Пишіть на hr@acme.example");

    expect(found[0]!.mailDomain).toBe("unknown");
  });

  it("survives the LLM being unavailable mid-call (chatJson returning null)", async () => {
    llmAvailable.mockReturnValue(true);
    chatJson.mockResolvedValue(null);

    const { extractPostingContacts } = await import("./posting-contacts.js");
    const found = await extractPostingContacts(BOOTSTRAP_USER_ID, UA_POSTING);

    expect(found.map((c) => c.value)).toContain("iryna.melnyk@acme.com");
  });
});
