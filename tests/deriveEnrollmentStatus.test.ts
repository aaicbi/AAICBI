import { describe, it, expect } from "vitest";
import { deriveEnrollmentStatus } from "../src/lib/courseAccess";

describe("deriveEnrollmentStatus", () => {
  it("returns COMPLETED when completedAt is set, regardless of other fields", () => {
    expect(
      deriveEnrollmentStatus({ completedAt: new Date(), accessRevokedAt: new Date(), unlockedAt: new Date() })
    ).toBe("COMPLETED");
    expect(deriveEnrollmentStatus({ completedAt: new Date(), accessRevokedAt: null, unlockedAt: null })).toBe(
      "COMPLETED"
    );
  });

  it("returns EXPIRED when accessRevokedAt is set and not completed", () => {
    expect(
      deriveEnrollmentStatus({ completedAt: null, accessRevokedAt: new Date(), unlockedAt: new Date() })
    ).toBe("EXPIRED");
  });

  it("returns AWAITING_UNLOCK when unlockedAt is null and access hasn't been revoked", () => {
    expect(deriveEnrollmentStatus({ completedAt: null, accessRevokedAt: null, unlockedAt: null })).toBe(
      "AWAITING_UNLOCK"
    );
  });

  it("returns ACTIVE for a genuinely live enrollment", () => {
    expect(
      deriveEnrollmentStatus({ completedAt: null, accessRevokedAt: null, unlockedAt: new Date() })
    ).toBe("ACTIVE");
  });
});
