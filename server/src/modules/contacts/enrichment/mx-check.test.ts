// The distinction that carries this module is "no" vs "don't know": a resolver hiccup must never
// read as "this domain can't receive mail", because the UI warns on the former and stays silent on
// the latter — and warning about an address the posting actually stated is the worst outcome here.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveMx, lookup } = vi.hoisted(() => ({ resolveMx: vi.fn(), lookup: vi.fn() }));

vi.mock("node:dns/promises", () => ({ default: { resolveMx, lookup } }));

function dnsError(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

describe("checkMailDomain()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a domain with MX records as accepting mail", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.acme.com", priority: 10 }]);
    const { checkMailDomain } = await import("./mx-check.js");

    expect(await checkMailDomain("acme.com")).toBe("accepts-mail");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("accepts a domain with no MX but an address record (RFC 5321 implicit MX)", async () => {
    resolveMx.mockRejectedValue(dnsError("ENODATA"));
    lookup.mockResolvedValue({ address: "203.0.113.4", family: 4 });
    const { checkMailDomain } = await import("./mx-check.js");

    expect(await checkMailDomain("small-shop.example")).toBe("accepts-mail");
  });

  it("reports a domain that does not resolve at all as taking no mail", async () => {
    resolveMx.mockRejectedValue(dnsError("ENOTFOUND"));
    const { checkMailDomain } = await import("./mx-check.js");

    expect(await checkMailDomain("typo-domain.example")).toBe("no-mail");
  });

  it("reports 'unknown' — never 'no-mail' — when the resolver itself fails", async () => {
    resolveMx.mockRejectedValue(dnsError("ESERVFAIL"));
    const { checkMailDomain } = await import("./mx-check.js");

    expect(await checkMailDomain("acme.com")).toBe("unknown");
  });

  it("reports 'unknown' for input that isn't a domain", async () => {
    const { checkMailDomain } = await import("./mx-check.js");

    expect(await checkMailDomain("")).toBe("unknown");
    expect(await checkMailDomain("localhost")).toBe("unknown");
    expect(resolveMx).not.toHaveBeenCalled();
  });
});

describe("checkMailDomains()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks each distinct domain up exactly once, however many addresses share it", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.acme.com", priority: 10 }]);
    const { checkMailDomains } = await import("./mx-check.js");

    const map = await checkMailDomains(["a@acme.com", "b@ACME.com", "c@other.example"]);

    expect(resolveMx).toHaveBeenCalledTimes(2);
    expect(map.get("acme.com")).toBe("accepts-mail");
    expect(map.get("other.example")).toBe("accepts-mail");
  });

  it("ignores entries that aren't addresses", async () => {
    const { checkMailDomains } = await import("./mx-check.js");

    expect(await checkMailDomains(["@handle", ""])).toEqual(new Map());
    expect(resolveMx).not.toHaveBeenCalled();
  });
});
