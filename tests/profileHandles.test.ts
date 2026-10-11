import { describe, it, expect } from "vitest";
import { normalizeHandle, slugifyForHandle, suggestHandle, validateHandle } from "@/lib/profiles/handleCore";

describe("handle rules", () => {
  it("accepts ordinary handles and strips a leading @", () => {
    expect(validateHandle("@Amina_Bello")).toEqual({ ok: true, handle: "amina_bello" });
    expect(validateHandle("nexus-academy")).toEqual({ ok: true, handle: "nexus-academy" });
  });
  it("rejects too short, too long, odd shapes and reserved words", () => {
    for (const bad of ["ab", "a".repeat(31), "-bad", "bad-", "no spaces", "dot.dot", "double--dash", "feed", "ADMIN", "p"]) expect(validateHandle(bad).ok, bad).toBe(false);
    expect(validateHandle(42).ok).toBe(false);
  });
  it("normalises without changing meaning", () => expect(normalizeHandle("  @@Kuda  ")).toBe("kuda"));
});

describe("making handles from names", () => {
  it("slugifies names, removing accents and symbols", () => {
    expect(slugifyForHandle("Nexus Training Academy")).toBe("nexus-training-academy");
    expect(slugifyForHandle("Chidí Okafor!")).toBe("chidi-okafor");
    expect(slugifyForHandle("***")).toBe("");
  });
  it("uses the name when free and numbers it when taken", () => {
    const taken = new Set(["kemi-adeyemi", "kemi-adeyemi-2"]);
    expect(suggestHandle("Ada Obi", (h) => taken.has(h))).toBe("ada-obi");
    expect(suggestHandle("Kemi Adeyemi", (h) => taken.has(h))).toBe("kemi-adeyemi-3");
  });
  it("never suggests a reserved or invalid handle", () => {
    expect(suggestHandle("Admin", () => false)).not.toBe("admin");
    expect(validateHandle(suggestHandle("Admin", () => false)).ok).toBe(true);
    expect(validateHandle(suggestHandle("!!", () => false)).ok).toBe(true);
    expect(validateHandle(suggestHandle("x", () => false)).ok).toBe(true);
  });
  it("keeps long names within the limit even with a number", () => {
    const long = "a".repeat(40);
    const first = suggestHandle(long, () => false);
    const second = suggestHandle(long, (h) => h === first);
    expect(second.length).toBeLessThanOrEqual(30);
    expect(second).not.toBe(first);
  });
});
