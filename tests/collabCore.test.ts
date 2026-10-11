import { describe, expect, it } from "vitest";
import { canCollaborate, hashToken, linkState, newToken, ownerOnlyFieldsIn } from "@/lib/collab/core";

const base = { expiresAt: new Date(Date.now() + 1000), revokedAt: null as Date | null, useCount: 0, maxUses: 10 };

describe("share links", () => {
  it("makes long unguessable tokens and stores only a hash", () => {
    const a = newToken(), b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
    expect(hashToken(a)).toBe(hashToken(a));
  });
  it("works until it expires, is cancelled or used up", () => {
    expect(linkState(base)).toBe("ok");
    expect(linkState({ ...base, expiresAt: new Date(Date.now() - 1) })).toBe("expired");
    expect(linkState({ ...base, revokedAt: new Date() })).toBe("revoked");
    expect(linkState({ ...base, useCount: 10 })).toBe("used_up");
  });
  it("only staff, instructors and organizations can join; trainees and others cannot", () => {
    for (const r of ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]) expect(canCollaborate(r)).toBe(true);
    for (const r of ["TRAINEE", "EMPLOYER", "INVESTOR"]) expect(canCollaborate(r)).toBe(false);
  });
  it("keeps publishing, pricing and the certificate with the owner", () => {
    expect(ownerOnlyFieldsIn({ title: "x", description: "y" })).toEqual([]);
    expect(ownerOnlyFieldsIn({ title: "x", status: "PUBLISHED", priceKobo: 100 }).sort()).toEqual(["priceKobo", "status"]);
  });
});
