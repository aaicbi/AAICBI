import { describe, it, expect } from "vitest";
import { t } from "../src/lib/i18n";

describe("t (i18n lookup)", () => {
  it("returns the English text unchanged when no translations map has anything for it", () => {
    expect(t("Dashboard", {})).toBe("Dashboard");
  });

  it("returns the translated string when the map has an approved entry for it", () => {
    expect(t("Dashboard", { Dashboard: "Bọ́tini àkọ́kọ́" })).toBe("Bọ́tini àkọ́kọ́");
  });

  it("falls back to English for a key genuinely missing from the map, even if other keys exist", () => {
    expect(t("Settings", { Dashboard: "Bọ́tini àkọ́kọ́" })).toBe("Settings");
  });
});
