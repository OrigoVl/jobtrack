// The safety properties are the ones worth pinning here — a scanner that can be talked into
// fetching an internal address, or into reading a path the site asked it to leave alone, is worse
// than no scanner. The pure parsers are tested directly; the fetch path is driven through a stubbed
// global fetch so no test touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailsInHtml, findContactsOnSite, isPathAllowed, parseRobots } from "./company-site.js";

describe("parseRobots()", () => {
  it("reads the rules for the '*' group and ignores other agents' groups", () => {
    const rules = parseRobots(`
User-agent: GPTBot
Disallow: /

User-agent: *
Disallow: /admin
Allow: /careers
    `);

    expect(rules.disallow).toEqual(["/admin"]);
    expect(rules.allow).toEqual(["/careers"]);
  });

  it("ignores comments and an empty Disallow (which means 'nothing is disallowed')", () => {
    const rules = parseRobots("User-agent: *\nDisallow:   # everything is fine\n");
    expect(rules.disallow).toEqual([]);
  });
});

describe("isPathAllowed()", () => {
  it("blocks a path under a Disallow prefix", () => {
    expect(isPathAllowed("/team", parseRobots("User-agent: *\nDisallow: /team"))).toBe(false);
  });

  it("lets a more specific Allow win over a blanket Disallow", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /\nAllow: /careers");
    expect(isPathAllowed("/careers", rules)).toBe(true);
    expect(isPathAllowed("/team", rules)).toBe(false);
  });

  it("allows everything when there are no rules", () => {
    expect(isPathAllowed("/careers", parseRobots(""))).toBe(true);
  });
});

describe("emailsInHtml()", () => {
  it("takes addresses from mailto: links and from body text, without duplicates", () => {
    const html = `<a href="mailto:jobs@acme.test">Write us</a> or hr@acme.test, or jobs@acme.test again`;
    expect(emailsInHtml(html)).toEqual(["jobs@acme.test", "hr@acme.test"]);
  });

  it("strips trailing punctuation and decodes a percent-encoded mailto", () => {
    expect(emailsInHtml("Contact hr@acme.test.")).toEqual(["hr@acme.test"]);
    expect(emailsInHtml('<a href="mailto:hr%40acme.test">x</a>')).toEqual(["hr@acme.test"]);
  });

  it("drops template placeholders, tooling addresses and image filenames", () => {
    const html = `your@email.com f00b4r@sentry.io logo@2x.png name@example.com real@acme.test`;
    expect(emailsInHtml(html)).toEqual(["real@acme.test"]);
  });
});

describe("findContactsOnSite()", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function htmlResponse(body: string, status = 200) {
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
          controller.close();
        },
      }),
    };
  }

  function redirectResponse(location: string) {
    return { status: 302, ok: false, headers: new Headers({ location }), body: null };
  }

  it("collects addresses from the pages it reads, tagged with the page", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) return htmlResponse("");
      if (url.endsWith("/careers")) return htmlResponse('<a href="mailto:jobs@acme.test">jobs</a>');
      return htmlResponse("nothing here");
    });

    const result = await findContactsOnSite("acme.test");

    expect(result.contacts).toEqual([{ email: "jobs@acme.test", page: "/careers" }]);
    expect(result.blockedByRobots).toBe(false);
  });

  it("does not fetch a path robots.txt disallows", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) return htmlResponse("User-agent: *\nDisallow: /team");
      return htmlResponse("hr@acme.test");
    });

    await findContactsOnSite("acme.test");

    const fetched = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(fetched.some((u) => u.endsWith("/team"))).toBe(false);
    expect(fetched.some((u) => u.endsWith("/careers"))).toBe(true);
  });

  it("reports blockedByRobots when every candidate path is off limits", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/robots.txt") ? htmlResponse("User-agent: *\nDisallow: /") : htmlResponse("hr@acme.test"),
    );

    const result = await findContactsOnSite("acme.test");

    expect(result.blockedByRobots).toBe(true);
    expect(result.contacts).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // robots.txt only
  });

  it("refuses to follow a redirect that points at an internal address", async () => {
    // The classic SSRF shape: a public host answers 302 to the cloud metadata endpoint. Following
    // redirects manually is what lets the guard see — and reject — that second URL.
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) return htmlResponse("");
      return redirectResponse("http://169.254.169.254/latest/meta-data/");
    });

    const result = await findContactsOnSite("acme.test");

    expect(result.contacts).toEqual([]);
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes("169.254.169.254"))).toBe(true);
  });

  it("never requests a non-https or internal origin in the first place", async () => {
    expect(await findContactsOnSite("localhost")).toEqual({ contacts: [], pagesRead: [], blockedByRobots: false });
    expect(await findContactsOnSite("")).toEqual({ contacts: [], pagesRead: [], blockedByRobots: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives a site that is down or answers with an error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await findContactsOnSite("acme.test");

    expect(result.contacts).toEqual([]);
    expect(result.pagesRead).toEqual([]);
  });
});
