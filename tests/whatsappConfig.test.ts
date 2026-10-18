import { describe, expect, it } from "vitest";
import { checkCredentials, hintOf, keyFrom, missingForEnable, seal, unseal } from "@/lib/notifications/whatsappConfigCore";

const key = keyFrom("a-long-test-secret-of-at-least-thirty-two-characters");

describe("sealing credentials", () => {
  it("gives back what was sealed", () => expect(unseal(seal("EAAG-token-123", key), key)).toBe("EAAG-token-123"));
  it("never stores the text in the clear, and differs each time", () => {
    const a = seal("EAAG-token-123", key), b = seal("EAAG-token-123", key);
    expect(a).not.toContain("EAAG");
    expect(a).not.toBe(b);
  });
  it("refuses a different key, a changed value and junk", () => {
    const s = seal("secret-value", key);
    expect(unseal(s, keyFrom("another-secret-another-secret-another-secret"))).toBeNull();
    expect(unseal(s.slice(0, -2) + "xx", key)).toBeNull();
    expect(unseal("nonsense", key)).toBeNull();
    expect(unseal(undefined, key)).toBeNull();
    expect(unseal(12, key)).toBeNull();
  });
});

describe("hintOf", () => {
  it("shows only the last four characters", () => expect(hintOf("abcdefghijklmnop")).toBe("••••mnop"));
  it("shows nothing of a short value", () => expect(hintOf("abc")).toBe("••••"));
});

describe("checkCredentials", () => {
  const ok = (v: object) => checkCredentials(v as never);
  it("keeps only the fields that were filled in", () => {
    const r = ok({ accessToken: "", phoneNumberId: " 123456789 ", appSecret: undefined });
    expect(r).toEqual({ ok: true, value: { phoneNumberId: "123456789" } });
  });
  it("trims pasted values", () => expect(ok({ accessToken: `  ${"x".repeat(30)}\n` })).toEqual({ ok: true, value: { accessToken: "x".repeat(30) } }));
  it("rejects values that cannot be real", () => {
    for (const bad of [{ accessToken: "short" }, { accessToken: "a".repeat(20) + " b" }, { accessToken: "a".repeat(601) }, { phoneNumberId: "+2348030000000" }, { phoneNumberId: "123" }, { appSecret: "short" }, { verifyToken: "a b c d e f g h" }, { templateLang: "English" }])
      expect(ok(bad).ok).toBe(false);
  });
  it("accepts a language with or without a region", () => {
    expect(ok({ templateLang: "en" }).ok).toBe(true);
    expect(ok({ templateLang: "en_GB" }).ok).toBe(true);
  });
});

describe("missingForEnable", () => {
  it("lists everything missing", () => expect(missingForEnable({ accessToken: false, phoneNumberId: false, appSecret: false })).toHaveLength(3));
  it("is empty when all are saved", () => expect(missingForEnable({ accessToken: true, phoneNumberId: true, appSecret: true })).toEqual([]));
});
