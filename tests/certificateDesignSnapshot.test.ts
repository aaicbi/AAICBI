import { describe, it, expect } from "vitest";
import { parseCertificateDesignSnapshot } from "@/lib/certificateDesignSnapshot";

describe("parseCertificateDesignSnapshot", () => {
  it("treats a missing or malformed value as no snapshot", () => {
    expect(parseCertificateDesignSnapshot(null)).toBeNull();
    expect(parseCertificateDesignSnapshot("x")).toBeNull();
    expect(parseCertificateDesignSnapshot({ version: 2, template: null })).toBeNull();
    expect(parseCertificateDesignSnapshot({ version: 1 })).toBeNull();
  });

  it("keeps 'issued with the default design' distinct from 'no snapshot'", () => {
    expect(parseCertificateDesignSnapshot({ version: 1, template: null })).toEqual({ version: 1, template: null });
  });

  it("returns a frozen template design as stored", () => {
    const snap = { version: 1, template: { trainingOrganizationId: "o1", organizationName: "Org", logoUrl: null, signatoryName: null, signatoryTitle: null, primaryColor: "#016B61", accentColor: "#D99A34", layoutJson: null } };
    expect(parseCertificateDesignSnapshot(snap)).toEqual(snap);
  });
});
