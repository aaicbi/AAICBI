import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appUrl } from "@/lib/appUrl";
import { googleRedirectUri } from "@/lib/auth/google";

describe("appUrl & googleRedirectUri", () => {
  const originalEnv = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.APP_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.APP_URL = originalEnv;
    } else {
      delete process.env.APP_URL;
    }
  });

  it("defaults base URL to https://aaicbi.org when APP_URL is not set", () => {
    expect(appUrl("/api/auth/google/callback")).toBe("https://aaicbi.org/api/auth/google/callback");
    expect(googleRedirectUri()).toBe("https://aaicbi.org/api/auth/google/callback");
  });

  it("respects custom APP_URL when set", () => {
    process.env.APP_URL = "https://custom.aaicbi.org";
    expect(appUrl("/api/auth/google/callback")).toBe("https://custom.aaicbi.org/api/auth/google/callback");
    expect(googleRedirectUri()).toBe("https://custom.aaicbi.org/api/auth/google/callback");
  });
});
