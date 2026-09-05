import { describe, it, expect } from "vitest";
import { validateAvatarFile } from "../src/lib/avatar";

describe("validateAvatarFile", () => {
  it("accepts a normal JPG under the size limit", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: 500_000 })).toBeNull();
  });

  it("accepts PNG and WEBP too", () => {
    expect(validateAvatarFile({ type: "image/png", size: 500_000 })).toBeNull();
    expect(validateAvatarFile({ type: "image/webp", size: 500_000 })).toBeNull();
  });

  it("rejects a disallowed type like PDF or GIF", () => {
    expect(validateAvatarFile({ type: "application/pdf", size: 500_000 })).not.toBeNull();
    expect(validateAvatarFile({ type: "image/gif", size: 500_000 })).not.toBeNull();
  });

  it("rejects a file over 5MB", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: 6 * 1024 * 1024 })).not.toBeNull();
  });

  it("accepts a file at exactly the boundary", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });
});
