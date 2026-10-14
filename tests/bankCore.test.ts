import { describe, expect, it } from "vitest";
import { bucketOf, questionsNeeded, reasonsFromDetail } from "@/lib/quest/bankCore";

describe("bucketOf", () => {
  it("puts every bank status where the person expects it", () => {
    expect(bucketOf(null)).toBeNull();
    expect(bucketOf("PENDING_REVIEW")).toBe("AWAITING_REVIEW");
    expect(bucketOf("PENDING_VALIDATION")).toBe("AWAITING_REVIEW");
    expect(bucketOf("VALIDATED_PASS")).toBe("READY");
    for (const s of ["VALIDATED_WARNING", "VALIDATED_FLAGGED", "VALIDATED_REJECTED"] as const) expect(bucketOf(s)).toBe("FLAGGED");
    expect(bucketOf("APPROVED")).toBe("APPROVED");
    expect(bucketOf("REJECTED")).toBe("REJECTED");
  });
});

describe("reasonsFromDetail", () => {
  it("is empty when the reviewer found nothing, or there is no verdict", () => {
    expect(reasonsFromDetail(null)).toEqual([]);
    expect(reasonsFromDetail({ correctness: { agrees: true }, alignment: { aligned: true }, ambiguity: { ambiguous: false }, duplicate: null })).toEqual([]);
  });
  it("says in plain words what was wrong", () => {
    const r = reasonsFromDetail({
      correctness: { agrees: false, verifiedOptionIndex: 2, originalOptionIndex: 0 },
      alignment: { aligned: false, reason: "It only tests a definition." },
      ambiguity: { ambiguous: true, reason: null },
      duplicate: { matchedQuestionText: "What is a trigger?", similarity: 0.95 },
    });
    expect(r).toHaveLength(4);
    expect(r[0]).toMatch(/option C/);
    expect(r[1]).toBe("It only tests a definition.");
    expect(r[2]).toMatch(/More than one option/);
    expect(r[3]).toMatch(/What is a trigger/);
  });
  it("does not invent an option letter when the reviewer gave none", () => {
    expect(reasonsFromDetail({ correctness: { agrees: false, verifiedOptionIndex: null } })[0]).toMatch(/could not confirm/);
  });
});

describe("questionsNeeded", () => {
  it("asks for what the pools still lack, never a negative number", () => {
    expect(questionsNeeded(0)).toBe(16);
    expect(questionsNeeded(10)).toBe(6);
    expect(questionsNeeded(16)).toBe(0);
    expect(questionsNeeded(40)).toBe(0);
  });
});

describe("poolNeed", () => {
  it("counts each side of the bank on its own", async () => {
    const { poolNeed, POOL_LABEL } = await import("@/lib/quest/bankCore");
    expect(poolNeed("PRACTICE", 0)).toBe(10);
    expect(poolNeed("FORMAL", 0)).toBe(6);
    expect(poolNeed("PRACTICE", 4)).toBe(6);
    expect(poolNeed("FORMAL", 6)).toBe(0);
    expect(poolNeed("PRACTICE", 40)).toBe(0);
    expect(POOL_LABEL.PRACTICE).toBe("Games and practice");
    expect(POOL_LABEL.FORMAL).toBe("Assessment");
  });
});
