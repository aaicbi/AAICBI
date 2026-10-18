/** Ayakbi Arena credit wallet: the limits, as constants and a pure check (no database). */
export const MAX_TRANSFER = 100;
export const MAX_SENT_PER_DAY = 300;

export type TransferVerdict = { ok: true; amount: number } | { ok: false; error: string };

/** Is this a sensible transfer? `balance` and `sentToday` are the sender's figures before it. */
export function checkTransfer(input: { amount: unknown; balance: number; sentToday: number; fromId: string; toId: string }): TransferVerdict {
  const n = typeof input.amount === "number" ? input.amount : Number(input.amount);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Choose a whole number of credits, at least 1." };
  if (input.fromId === input.toId) return { ok: false, error: "Choose a coursemate to send credits to." };
  if (n > MAX_TRANSFER) return { ok: false, error: `You can send at most ${MAX_TRANSFER} credits at a time.` };
  if (input.sentToday + n > MAX_SENT_PER_DAY) return { ok: false, error: `You can send at most ${MAX_SENT_PER_DAY} credits a day.` };
  if (n > input.balance) return { ok: false, error: "You don't have enough credits for that." };
  return { ok: true, amount: n };
}

export const REASON_LABEL: Record<string, string> = { FASTEST_FINGERS: "Fastest Fingers win", TRANSFER_IN: "Received", TRANSFER_OUT: "Sent", SPEND: "Spent" };
