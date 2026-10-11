import { describe, it, expect } from "vitest";
import { checkDecision, checkRequestInput, isOpen, REASON_MAX } from "@/lib/profiles/handleChangeCore";

describe("asking to change a handle", () => {
  const ok = { handle: "@Ada-Obi", reason: "My professional name is Ada Obi." };
  it("accepts a valid new handle with a reason, and normalises it", () => {
    expect(checkRequestInput(ok, "amara-nwosu")).toEqual({ ok: true, handle: "ada-obi", reason: "My professional name is Ada Obi." });
  });
  it("refuses the current handle", () => expect(checkRequestInput({ ...ok, handle: "ada-obi" }, "ada-obi").ok).toBe(false));
  it("refuses a reserved or malformed handle", () => {
    expect(checkRequestInput({ ...ok, handle: "feed" }, "x-person").ok).toBe(false);
    expect(checkRequestInput({ ...ok, handle: "no spaces" }, "x-person").ok).toBe(false);
  });
  it("needs a real reason", () => {
    expect(checkRequestInput({ handle: "ada-obi", reason: "" }, "x-person").ok).toBe(false);
    expect(checkRequestInput({ handle: "ada-obi", reason: "short" }, "x-person").ok).toBe(false);
    expect(checkRequestInput({ handle: "ada-obi", reason: "x".repeat(REASON_MAX + 1) }, "x-person").ok).toBe(false);
    expect(checkRequestInput({ handle: "ada-obi", reason: 5 }, "x-person").ok).toBe(false);
  });
  it("collapses whitespace in the reason", () => {
    const r = checkRequestInput({ handle: "ada-obi", reason: "  I   changed\n my   name  " }, "x-person");
    expect(r.ok && r.reason).toBe("I changed my name");
  });
});

describe("deciding a request", () => {
  it("approval needs no note", () => expect(checkDecision("approve", undefined)).toEqual({ ok: true, note: null }));
  it("a rejection must give a reason", () => {
    expect(checkDecision("reject", "").ok).toBe(false);
    expect(checkDecision("reject", "abc").ok).toBe(false);
    expect(checkDecision("reject", "Too close to an existing organization name.")).toEqual({ ok: true, note: "Too close to an existing organization name." });
  });
  it("only pending requests are open", () => {
    expect(isOpen("PENDING")).toBe(true);
    for (const s of ["APPROVED", "REJECTED", "CANCELLED"]) expect(isOpen(s)).toBe(false);
  });
});
