import { describe, expect, it } from "vitest";
import { canMove, cleanNote, cleanPeriod, commissionKobo, csvCell, funnelSteps, maskName, naira, percentOf, periodStart, sourceLabel, summarizeLedger, toCsv } from "@/lib/growth/reportCore";

describe("commission", () => {
  it("is the payment times the rate, to the nearest kobo", () => {
    expect(commissionKobo(4_500_000, 1500)).toBe(675_000); // 15% of N45,000
    expect(commissionKobo(4_500_000, 1250)).toBe(562_500);
    expect(commissionKobo(1, 5000)).toBe(1); // 0.5 rounds up
    expect(commissionKobo(333, 1500)).toBe(50); // 49.95
    expect(commissionKobo(0, 1500)).toBe(0);
    expect(commissionKobo(4_500_000, 0)).toBe(0);
    expect(commissionKobo(-5, 1500)).toBe(0);
    expect(commissionKobo(NaN, 1500)).toBe(0);
  });
  it("writes naira from kobo", () => {
    expect(naira(4_500_000)).toBe("₦45,000");
    expect(naira(675_050)).toBe("₦6,750.50");
    expect(naira(0)).toBe("₦0");
  });
  it("shows shares as whole percents", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBeNull();
    expect(percentOf(0, 4)).toBe(0);
  });
});

describe("periods", () => {
  const now = new Date("2026-03-31T12:00:00Z");
  it("starts a period back from now", () => {
    expect(periodStart("7d", now)!.toISOString()).toBe("2026-03-24T12:00:00.000Z");
    expect(periodStart("30d", now)!.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(periodStart("90d", now)!.toISOString()).toBe("2025-12-31T12:00:00.000Z");
    expect(periodStart("all", now)).toBeNull();
  });
  it("falls back to 30 days", () => {
    expect(cleanPeriod("90d")).toBe("90d");
    expect(cleanPeriod("forever")).toBe("30d");
    expect(cleanPeriod(undefined)).toBe("30d");
  });
});

describe("names and sources", () => {
  it("masks a name", () => {
    expect(maskName("Ada Okoro")).toBe("Ada O.");
    expect(maskName("  Ngozi   Chidinma  eze ")).toBe("Ngozi E.");
    expect(maskName("Bo")).toBe("Bo");
    expect(maskName("")).toBe("A trainee");
    expect(maskName(null)).toBe("A trainee");
  });
  it("labels a source", () => {
    expect(sourceLabel(null)).toBe("Direct link");
    expect(sourceLabel("share")).toBe("Shared result");
    expect(sourceLabel("duel")).toBe("Friend's challenge");
    expect(sourceLabel("squad")).toBe("Squad invite");
    expect(sourceLabel("rival")).toBe("Squad challenge");
    expect(sourceLabel("lagos-tech-women")).toBe("lagos tech women");
  });
});

describe("the funnel", () => {
  it("gives each step its share of the one before and of those who started", () => {
    const f = funnelSteps({ started: 200, finished: 150, saved: 60, startedModule1: 30, passedModule1: 15, paid: 6 });
    expect(f.map((s) => s.count)).toEqual([200, 150, 60, 30, 15, 6]);
    expect(f[0].ofPrevious).toBeNull();
    expect(f[1]).toMatchObject({ ofPrevious: 75, ofStarted: 75 });
    expect(f[2]).toMatchObject({ ofPrevious: 40, ofStarted: 30 });
    expect(f[5]).toMatchObject({ ofPrevious: 40, ofStarted: 3 });
  });
  it("copes with nothing", () => {
    const f = funnelSteps({ started: 0, finished: 0, saved: 0, startedModule1: 0, passedModule1: 0, paid: 0 });
    expect(f.every((s) => s.ofPrevious === null && s.ofStarted === null)).toBe(true);
  });
  it("allows a later step to be larger (starting Module 1 needs no saved score)", () => {
    const f = funnelSteps({ started: 10, finished: 8, saved: 2, startedModule1: 4, passedModule1: 1, paid: 0 });
    expect(f[3].ofPrevious).toBe(200);
  });
});

describe("the ledger", () => {
  const rows = [
    { status: "OWED", amountKobo: 4_500_000, commissionKobo: 675_000 },
    { status: "SETTLED", amountKobo: 4_500_000, commissionKobo: 675_000 },
    { status: "REVERSED", amountKobo: 4_500_000, commissionKobo: 675_000 },
    { status: "OWED", amountKobo: 2_000_000, commissionKobo: 300_000 },
  ];
  it("totals by status and ignores reversed rows for money", () => {
    expect(summarizeLedger(rows)).toEqual({ payments: 3, amountKobo: 11_000_000, owedKobo: 975_000, settledKobo: 675_000, reversedKobo: 675_000, owedCount: 2, settledCount: 1, reversedCount: 1, earnedKobo: 1_650_000 });
    expect(summarizeLedger([]).earnedKobo).toBe(0);
  });
  it("only allows sensible moves", () => {
    expect(canMove("OWED", "SETTLED")).toBe(true);
    expect(canMove("SETTLED", "OWED")).toBe(true);
    expect(canMove("OWED", "REVERSED")).toBe(true);
    expect(canMove("SETTLED", "REVERSED")).toBe(true);
    expect(canMove("REVERSED", "OWED")).toBe(false);
    expect(canMove("REVERSED", "SETTLED")).toBe(false);
    expect(canMove("OWED", "OWED")).toBe(false);
    expect(canMove("SETTLED", "SETTLED")).toBe(false);
  });
  it("cleans a note", () => {
    expect(cleanNote("  GTB   ref 123 ")).toBe("GTB ref 123");
    expect(cleanNote("   ")).toBeNull();
    expect(cleanNote(5)).toBeNull();
    expect(cleanNote("x".repeat(500))!.length).toBe(200);
  });
});

describe("CSV", () => {
  it("quotes what needs it and defuses formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+234803")).toBe("'+234803");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell("-abc")).toBe("'-abc");
    expect(csvCell(null)).toBe("");
    expect(csvCell(4500)).toBe("4500");
  });
  it("writes rows with a header", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"], [2, "z"]])).toBe('a,b\r\n1,"x,y"\r\n2,z\r\n');
  });
});
