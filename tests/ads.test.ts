import { describe, expect, it } from "vitest";
import { MEDIA_RULES, adForSlot, adStatus, checkAdInput, checkLink, csvCell, daysLeft, inlineSlotAfter, initialsOf, isBlobUrl, isDay, isLive, periodFirstDay, pickAds, prettyNaira, tapRate, toCsv, watBoundary, watDay } from "@/lib/ads/adsCore";

const blob = (p: string) => `https://store1.public.blob.vercel-storage.com/ads/${p}`;
const good = {
  advertiserName: "Northwind Academy", advertiserKind: "Training organization", organizationId: "org1", logoUrl: blob("logo/n.png"),
  headline: "Cohort 7 is open: 40 seats", caption: "Hands-on data analytics with a certificate employers can verify.", buttonLabel: "Reserve a seat", linkUrl: "https://northwind.example/cohort-7",
  mediaKind: "IMAGE", mediaUrl: blob("image/a.jpg"), mediaType: "image/jpeg", mediaName: "a.jpg", mediaSize: 900_000,
  placements: ["TOP", "INLINE"], startsOn: "2026-11-01", endsOn: "2026-11-30", priceNaira: "150,000", paymentStatus: "PAID", notes: "Invoice 42",
};

describe("checkLink", () => {
  it("accepts a plain https address", () => expect(checkLink("https://a.example/x?y=1")).toEqual({ ok: true, url: "https://a.example/x?y=1" }));
  it("refuses http, other schemes, logins and non-addresses", () => {
    for (const u of ["http://a.example", "javascript:alert(1)", "ftp://a.example", "https://user:pw@a.example", "https://localhost", "not a url", "", 5, "https://" + "a".repeat(600) + ".com"]) expect(checkLink(u).ok).toBe(false);
  });
});

describe("isBlobUrl", () => {
  it("only accepts this app's own stored files", () => {
    expect(isBlobUrl(blob("image/a.jpg"))).toBe(true);
    for (const u of ["https://evil.example/a.jpg", "http://x.public.blob.vercel-storage.com/a", "https://public.blob.vercel-storage.com.evil.com/a", "", null]) expect(isBlobUrl(u)).toBe(false);
  });
});

describe("checkAdInput", () => {
  it("accepts a complete booking and turns the price into kobo", () => {
    const r = checkAdInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.priceKobo).toBe(15_000_000); expect(r.value.placements).toEqual(["TOP", "INLINE"]); expect(r.value.organizationId).toBe("org1"); }
  });
  it("needs every part, and says which", () => {
    const missing = (k: string, v: unknown = "") => checkAdInput({ ...good, [k]: v });
    for (const k of ["advertiserName", "headline", "caption", "buttonLabel"]) expect(missing(k).ok).toBe(false);
    expect(missing("linkUrl", "http://x.example").ok).toBe(false);
    expect(missing("placements", []).ok).toBe(false);
    expect(missing("mediaKind", null).ok).toBe(false);
  });
  it("keeps words short", () => {
    expect(checkAdInput({ ...good, headline: "h".repeat(61) }).ok).toBe(false);
    expect(checkAdInput({ ...good, caption: "c".repeat(141) }).ok).toBe(false);
    expect(checkAdInput({ ...good, buttonLabel: "b".repeat(25) }).ok).toBe(false);
    expect(checkAdInput({ ...good, headline: "h".repeat(60) }).ok).toBe(true);
  });
  it("checks the file for each kind", () => {
    expect(checkAdInput({ ...good, mediaUrl: "https://evil.example/a.jpg" }).ok).toBe(false);
    expect(checkAdInput({ ...good, mediaType: "application/pdf" }).ok).toBe(false);
    expect(checkAdInput({ ...good, mediaSize: MEDIA_RULES.IMAGE.maxBytes + 1 }).ok).toBe(false);
    expect(checkAdInput({ ...good, mediaKind: "VIDEO", mediaType: "video/mp4", mediaUrl: blob("video/v.mp4"), mediaSize: MEDIA_RULES.VIDEO.maxBytes }).ok).toBe(true);
    expect(checkAdInput({ ...good, mediaKind: "VIDEO", mediaType: "video/mp4", mediaUrl: blob("video/v.mp4"), mediaSize: MEDIA_RULES.VIDEO.maxBytes + 1 }).ok).toBe(false);
    expect(checkAdInput({ ...good, mediaKind: "VIDEO", mediaType: "image/png" }).ok).toBe(false);
  });
  it("checks the dates", () => {
    expect(checkAdInput({ ...good, startsOn: "2026-12-01", endsOn: "2026-11-01" }).ok).toBe(false);
    expect(checkAdInput({ ...good, startsOn: "2026-02-30x" }).ok).toBe(false);
    expect(checkAdInput({ ...good, startsOn: "2026-01-01", endsOn: "2027-06-01" }).ok).toBe(false);
    expect(checkAdInput({ ...good, startsOn: "2026-11-05", endsOn: "2026-11-05" }).ok).toBe(true);
  });
  it("treats an unknown payment status as unpaid, and a bad price as an error", () => {
    const r = checkAdInput({ ...good, paymentStatus: "WHATEVER" });
    expect(r.ok && r.value.paymentStatus).toBe("UNPAID");
    expect(checkAdInput({ ...good, priceNaira: "abc" }).ok).toBe(false);
    expect(checkAdInput({ ...good, priceNaira: -5 }).ok).toBe(false);
    const free = checkAdInput({ ...good, priceNaira: "", paymentStatus: "FREE" });
    expect(free.ok && free.value.priceKobo).toBeNull();
  });
  it("strips control characters and collapses spaces, and drops a bad logo or unknown placements", () => {
    const r = checkAdInput({ ...good, headline: "  Open\u0000   now  ", placements: ["TOP", "TOP", "NOPE"] });
    expect(r.ok && r.value.headline).toBe("Open now");
    expect(r.ok && r.value.placements).toEqual(["TOP"]);
    expect(checkAdInput({ ...good, logoUrl: "https://evil.example/l.png" }).ok).toBe(false);
    const noLogo = checkAdInput({ ...good, logoUrl: "" });
    expect(noLogo.ok && noLogo.value.logoUrl).toBeNull();
  });
});

describe("Nigerian days", () => {
  it("runs an ad from the start of its first day to the end of its last, in Nigerian time", () => {
    expect(watBoundary("2026-11-01", false).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(watBoundary("2026-11-30", true).toISOString()).toBe("2026-11-30T22:59:59.999Z");
  });
  it("names a moment's Nigerian day", () => {
    expect(watDay(new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-01");
    expect(watDay(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
  });
  it("validates day strings", () => { expect(isDay("2026-11-01")).toBe(true); expect(isDay("2026-13-01")).toBe(false); expect(isDay("tomorrow")).toBe(false); });
});

describe("status", () => {
  const ad = (o: { paymentStatus?: string; paused?: boolean; startsAt?: string; endsAt?: string } = {}) => ({
    paymentStatus: o.paymentStatus ?? "PAID", paused: o.paused ?? false,
    startsAt: new Date(o.startsAt ?? "2026-11-01T00:00:00Z"), endsAt: new Date(o.endsAt ?? "2026-11-30T00:00:00Z"),
  });
  const now = new Date("2026-11-10T12:00:00Z");
  it("is live inside its dates when paid or free", () => { expect(adStatus(ad(), now)).toBe("LIVE"); expect(adStatus(ad({ paymentStatus: "FREE" }), now)).toBe("LIVE"); });
  it("never goes live unpaid", () => { expect(adStatus(ad({ paymentStatus: "UNPAID" }), now)).toBe("WAITING_PAYMENT"); expect(isLive(ad({ paymentStatus: "UNPAID" }), now)).toBe(false); });
  it("can be paused, scheduled or ended, and ended wins", () => {
    expect(adStatus(ad({ paused: true }), now)).toBe("PAUSED");
    expect(adStatus(ad({ startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-12-10T00:00:00Z" }), now)).toBe("SCHEDULED");
    expect(adStatus(ad({ endsAt: "2026-11-05T00:00:00Z" }), now)).toBe("ENDED");
    expect(adStatus(ad({ endsAt: "2026-11-05T00:00:00Z", paused: true, paymentStatus: "UNPAID" }), now)).toBe("ENDED");
  });
  it("counts the days left", () => { expect(daysLeft({ endsAt: new Date("2026-11-30T00:00:00Z") }, now)).toBe(20); expect(daysLeft({ endsAt: new Date("2026-11-01T00:00:00Z") }, now)).toBe(0); });
});

describe("which ads to show", () => {
  const c = (id: string, views: number, day = 1) => ({ id, viewsTotal: views, createdAt: new Date(2026, 0, day) });
  it("shows the least-shown first, oldest first on a tie", () => {
    expect(pickAds([c("a", 50), c("b", 10), c("c", 10, 2), c("d", 30)], { count: 3 }).map((x) => x.id)).toEqual(["b", "c", "d"]);
  });
  it("skips what is excluded and honours the count", () => {
    expect(pickAds([c("a", 1), c("b", 2), c("c", 3)], { count: 2, exclude: ["a"] }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(pickAds([c("a", 1)], { count: 0 })).toEqual([]);
    expect(pickAds([], { count: 3 })).toEqual([]);
  });
  it("does not start with the ad shown last, when there is another", () => {
    expect(pickAds([c("a", 1), c("b", 2)], { count: 2, lastId: "a" }).map((x) => x.id)).toEqual(["b", "a"]);
    expect(pickAds([c("a", 1)], { count: 2, lastId: "a" }).map((x) => x.id)).toEqual(["a"]);
  });
  it("cycles through the ads for the slots, so neighbours differ", () => {
    const ads = ["a", "b", "c"];
    expect([0, 1, 2, 3, 4].map((n) => adForSlot(ads, n))).toEqual(["a", "b", "c", "a", "b"]);
    expect(adForSlot([], 0)).toBeNull();
  });
  it("puts a slot after every sixth post", () => {
    expect(inlineSlotAfter(5)).toEqual([]);
    expect(inlineSlotAfter(6)).toEqual([6]);
    expect(inlineSlotAfter(20)).toEqual([6, 12, 18]);
  });
});

describe("numbers", () => {
  it("works out the tap rate to one decimal and never divides by zero", () => { expect(tapRate(12480, 391)).toBe(3.1); expect(tapRate(0, 5)).toBe(0); });
  it("writes naira", () => { expect(prettyNaira(15_000_000)).toBe("₦150,000"); expect(prettyNaira(null)).toBe(""); });
  it("makes initials", () => { expect(initialsOf("Northwind Academy")).toBe("NA"); expect(initialsOf("  ")).toBe("AD"); expect(initialsOf("Cloud")).toBe("C"); });
  it("finds the first day of a period", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(periodFirstDay("7d", now)).toBe("2026-11-04");
    expect(periodFirstDay("30d", now)).toBe("2026-10-12");
    expect(periodFirstDay("all", now)).toBeNull();
  });
  it("makes spreadsheet cells safe", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("a,b")).toBe("\"a,b\"");
    expect(toCsv(["A", "B"], [["x", 1]])).toBe("A,B\r\nx,1");
  });
});
