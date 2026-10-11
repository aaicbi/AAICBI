import { describe, expect, it } from "vitest";
import { autoReviewEnabled, isTrusted, review, signalsFor } from "@/lib/posts/autoReview";

const ok = "Today I finished my first Python project: a small script that cleans a spreadsheet of sales data. Happy to share what I learned. #python #learning";

describe("auto-review", () => {
  it("publishes an ordinary post", () => {
    const v = review({ body: ok, trusted: false });
    expect(v.publish).toBe(true);
    expect(v.signals).toEqual([]);
  });
  it("holds abuse, scams and adult content for a person, even from a trusted author", () => {
    for (const body of ["You are a stupid idiot and I hate this", "Guaranteed returns! Double your money in a week", "free porn here"]) {
      expect(review({ body, trusted: false }).publish).toBe(false);
      expect(review({ body, trusted: true }).publish).toBe(false);
    }
  });
  it("matches whole words only", () => {
    expect(signalsFor({ body: "We study the Scunthorpe assessment and a classic dictionary of Dickens" })).toEqual([]);
  });
  it("lets a trusted author through small concerns that hold a new member", () => {
    const body = "Contact me on kufreh@example.com or +234 801 234 5678 to join our free workshop on data skills";
    expect(review({ body, trusted: false }).publish).toBe(false);
    expect(review({ body, trusted: true }).publish).toBe(true);
  });
  it("flags link spam, shouting, hashtags and duplicates", () => {
    expect(review({ body: "see https://a.com https://b.com https://c.com", trusted: false }).publish).toBe(false);
    expect(review({ body: "THIS IS AN AMAZING OPPORTUNITY FOR EVERYONE HERE TODAY", trusted: false }).publish).toBe(false);
    expect(signalsFor({ body: ok + " #a1 #b2 #c3 #d4 #e5 #f6 #g7" }).map((s) => s.code)).toContain("hashtag_stuffing");
    expect(review({ body: ok, trusted: false, duplicateOfRecent: true }).publish).toBe(false);
  });
  it("does not count YouTube links as link spam", () => {
    expect(signalsFor({ body: `${ok} https://www.youtube.com/watch?v=abc https://youtu.be/xyz https://youtu.be/q` }).map((s) => s.code)).not.toContain("many_links");
  });
  it("a picture alone is not 'too short'", () => {
    expect(review({ body: "", trusted: false, hasMedia: true }).publish).toBe(true);
  });
  it("trust needs a record and a clean slate", () => {
    expect(isTrusted({ published: 3, removed: 0, openReports: 0 })).toBe(true);
    expect(isTrusted({ published: 2, removed: 0, openReports: 0 })).toBe(false);
    expect(isTrusted({ published: 9, removed: 1, openReports: 0 })).toBe(false);
    expect(isTrusted({ published: 9, removed: 0, openReports: 1 })).toBe(false);
  });
  it("can be switched off", () => {
    expect(autoReviewEnabled({})).toBe(true);
    expect(autoReviewEnabled({ POST_AUTO_REVIEW: "off" })).toBe(false);
  });
});
