import { describe, it, expect } from "vitest";
import { classifyLifecycle } from "../src/lib/analytics/lifecycleCore";

const NOW = new Date("2026-10-01T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("classifyLifecycle", () => {
  it("tags a trainee created within the last 7 days as NEW", () => {
    expect(classifyLifecycle({ createdAt: daysAgo(3), lastLoginAt: daysAgo(1) }, false, NOW)).toBe("NEW");
    expect(classifyLifecycle({ createdAt: daysAgo(7), lastLoginAt: null }, false, NOW)).toBe("NEW");
  });

  it("tags a trainee who logged in within the last 30 days (and isn't NEW) as ACTIVE", () => {
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: daysAgo(5) }, false, NOW)).toBe("ACTIVE");
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: daysAgo(30) }, false, NOW)).toBe("ACTIVE");
  });

  it("tags a trainee with no login in over 30 days as INACTIVE", () => {
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: daysAgo(31) }, false, NOW)).toBe("INACTIVE");
  });

  it("tags a trainee who has never logged in (and isn't NEW) as INACTIVE", () => {
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: null }, false, NOW)).toBe("INACTIVE");
  });

  it("tags anyone who has completed a course as COMPLETER, overriding every other rule", () => {
    expect(classifyLifecycle({ createdAt: daysAgo(3), lastLoginAt: daysAgo(1) }, true, NOW)).toBe("COMPLETER");
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: daysAgo(90) }, true, NOW)).toBe("COMPLETER");
    expect(classifyLifecycle({ createdAt: daysAgo(60), lastLoginAt: null }, true, NOW)).toBe("COMPLETER");
  });
});
