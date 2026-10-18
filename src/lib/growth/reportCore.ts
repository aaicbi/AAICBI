/**
 * The campaign report and commission ledger, as pure functions (no database).
 *
 * Money is always whole kobo. A commission is the payment times the organization's rate, rounded to the nearest kobo, and the rate is
 * frozen on the ledger row when it is made, so changing an organization's rate later never rewrites what was already earned.
 */

export const LEDGER_STATUSES = ["OWED", "SETTLED", "REVERSED"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];
export const LEDGER_LABEL: Record<LedgerStatus, string> = { OWED: "Owed", SETTLED: "Settled", REVERSED: "Reversed" };

export const PERIODS = ["7d", "30d", "90d", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABEL: Record<Period, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" };
export const LEDGER_ROWS_SHOWN = 100;
export const NOTE_MAX = 200;

export const cleanPeriod = (raw: unknown): Period => ((PERIODS as readonly string[]).includes(raw as string) ? (raw as Period) : "30d");

/** The start of a period, or null for all time. */
export function periodStart(period: Period, now: Date): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 3_600_000);
}

/** A commission in whole kobo: the payment times the rate in basis points (1500 = 15%), rounded to the nearest kobo. */
export function commissionKobo(amountKobo: number, rateBps: number): number {
  if (!Number.isFinite(amountKobo) || !Number.isFinite(rateBps) || amountKobo <= 0 || rateBps <= 0) return 0;
  return Math.round((amountKobo * rateBps) / 10_000);
}

/** Naira with thousands separators, from kobo. */
export function naira(kobo: number): string {
  const n = Math.round(kobo) / 100;
  const whole = Number.isInteger(n);
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** A share as a whole percent, or null when there is nothing to divide by. */
export const percentOf = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

/** "Ada Okoro" becomes "Ada O.", so a ledger can name a person without showing a whole name. */
export function maskName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A trainee";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** A readable name for where a play came from. */
export function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case null:
    case undefined:
    case "": return "Direct link";
    case "share": return "Shared result";
    case "duel": return "Friend's challenge";
    case "squad": return "Squad invite";
    case "rival": return "Squad challenge";
    default: return source.replace(/-/g, " ");
  }
}

export interface FunnelCounts { started: number; finished: number; saved: number; startedModule1: number; passedModule1: number; paid: number }
export interface FunnelStep { key: keyof FunnelCounts; label: string; count: number; /** Share of the previous step, whole percent, or null. */ ofPrevious: number | null; /** Share of everyone who started. */ ofStarted: number | null }

const STEPS: { key: keyof FunnelCounts; label: string }[] = [
  { key: "started", label: "Started the taster" },
  { key: "finished", label: "Finished the taster" },
  { key: "saved", label: "Saved their score" },
  { key: "startedModule1", label: "Started Module 1" },
  { key: "passedModule1", label: "Passed Module 1" },
  { key: "paid", label: "Paid" },
];

/**
 * The funnel as steps. Saving a score is optional and starting Module 1 does not need it, so a later step can be larger than
 * an earlier one; each step shows its share of the one before it only when that makes sense, and always its share of everyone who started.
 */
export function funnelSteps(c: FunnelCounts): FunnelStep[] {
  return STEPS.map((s, i) => ({
    key: s.key, label: s.label, count: c[s.key],
    ofPrevious: i === 0 ? null : percentOf(c[s.key], c[STEPS[i - 1].key]),
    ofStarted: i === 0 ? null : percentOf(c[s.key], c.started),
  }));
}

export interface LedgerRowLike { status: string; amountKobo: number; commissionKobo: number }
export interface LedgerSummary { payments: number; amountKobo: number; owedKobo: number; settledKobo: number; reversedKobo: number; owedCount: number; settledCount: number; reversedCount: number; /** Commission on payments still counted (owed + settled). */ earnedKobo: number }

/** Totals for a set of ledger rows. A reversed row counts for nothing: neither its payment nor its commission. */
export function summarizeLedger(rows: LedgerRowLike[]): LedgerSummary {
  const s: LedgerSummary = { payments: 0, amountKobo: 0, owedKobo: 0, settledKobo: 0, reversedKobo: 0, owedCount: 0, settledCount: 0, reversedCount: 0, earnedKobo: 0 };
  for (const r of rows) {
    if (r.status === "REVERSED") { s.reversedKobo += r.commissionKobo; s.reversedCount++; continue; }
    s.payments++;
    s.amountKobo += r.amountKobo;
    if (r.status === "SETTLED") { s.settledKobo += r.commissionKobo; s.settledCount++; } else { s.owedKobo += r.commissionKobo; s.owedCount++; }
  }
  s.earnedKobo = s.owedKobo + s.settledKobo;
  return s;
}

/** What a status may become, and by whom: only a Super Admin moves a row, and a reversed row stays reversed. */
export function canMove(from: string, to: LedgerStatus): boolean {
  if (from === "REVERSED") return false;
  if (to === "SETTLED") return from === "OWED";
  if (to === "OWED") return from === "SETTLED";
  if (to === "REVERSED") return from === "OWED" || from === "SETTLED";
  return false;
}

export const cleanNote = (raw: unknown): string | null => (typeof raw === "string" && raw.trim() ? raw.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : null);

/** One CSV cell: quoted when needed, and a leading = + - @ is defused so a spreadsheet never runs it as a formula. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
