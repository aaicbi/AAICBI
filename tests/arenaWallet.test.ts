import { describe, it, expect } from "vitest";
import { checkTransfer, MAX_TRANSFER, MAX_SENT_PER_DAY } from "@/lib/arena/walletCore";

const base = { balance: 500, sentToday: 0, fromId: "a", toId: "b" };

describe("credit transfers", () => {
  it("accepts a sensible whole number the sender can afford", () => {
    expect(checkTransfer({ ...base, amount: 25 })).toEqual({ ok: true, amount: 25 });
  });
  it("refuses zero, negative, fractional and non-numbers", () => {
    for (const amount of [0, -5, 2.5, "abc", NaN]) expect(checkTransfer({ ...base, amount }).ok).toBe(false);
  });
  it("refuses sending to yourself", () => {
    expect(checkTransfer({ ...base, toId: "a", amount: 5 }).ok).toBe(false);
  });
  it("refuses more than the sender has", () => {
    expect(checkTransfer({ ...base, balance: 10, amount: 11 })).toMatchObject({ ok: false, error: expect.stringContaining("enough") });
    expect(checkTransfer({ ...base, balance: 10, amount: 10 }).ok).toBe(true);
  });
  it("caps one transfer and one day", () => {
    expect(checkTransfer({ ...base, balance: 9999, amount: MAX_TRANSFER + 1 }).ok).toBe(false);
    expect(checkTransfer({ ...base, balance: 9999, sentToday: MAX_SENT_PER_DAY - 10, amount: 11 }).ok).toBe(false);
    expect(checkTransfer({ ...base, balance: 9999, sentToday: MAX_SENT_PER_DAY - 10, amount: 10 }).ok).toBe(true);
  });
});
