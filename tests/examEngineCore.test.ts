import { describe, it, expect } from "vitest";
import { reconstructOrderedItems } from "@/lib/examEngineCore";

interface Item {
  id: string;
  label: string;
}

describe("reconstructOrderedItems", () => {
  const pool: Item[] = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ];

  it("reorders the pool to match the stored order", () => {
    const result = reconstructOrderedItems(pool, ["c", "a", "b"]);
    expect(result.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("returns an empty array for a non-array order value", () => {
    expect(reconstructOrderedItems(pool, null)).toEqual([]);
    expect(reconstructOrderedItems(pool, undefined)).toEqual([]);
    expect(reconstructOrderedItems(pool, "not-an-array")).toEqual([]);
    expect(reconstructOrderedItems(pool, { foo: "bar" })).toEqual([]);
  });

  it("skips ids that aren't in the pool rather than throwing", () => {
    const result = reconstructOrderedItems(pool, ["a", "does-not-exist", "b"]);
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("skips non-string entries in the order array", () => {
    const result = reconstructOrderedItems(pool, ["a", 42, null, "b"]);
    expect(result.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty order", () => {
    expect(reconstructOrderedItems(pool, [])).toEqual([]);
  });

  it("preserves duplicate ids if the order value has them", () => {
    const result = reconstructOrderedItems(pool, ["a", "a"]);
    expect(result.map((i) => i.id)).toEqual(["a", "a"]);
  });
});
