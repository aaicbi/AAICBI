/** Ayakbi Arena game moderation: the reasons, limits and a pure check on a report. */
export const REPORT_REASONS = [
  { key: "CHEATING", label: "Cheating or working together" },
  { key: "ABUSE", label: "Rude or abusive messages" },
  { key: "OTHER", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];
export const REPORTS_PER_HOUR = 5;
export const NOTE_MAX = 300;

export const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label ?? k;

export type ReportVerdict = { ok: true; reason: ReportReason; note: string | null } | { ok: false; error: string };

export function checkReport(input: { reason: unknown; note: unknown; recentCount: number }): ReportVerdict {
  const reason = REPORT_REASONS.find((r) => r.key === input.reason)?.key;
  if (!reason) return { ok: false, error: "Choose a reason." };
  if (input.recentCount >= REPORTS_PER_HOUR) return { ok: false, error: "You have sent several reports in the last hour. A moderator will look at them." };
  const note = typeof input.note === "string" ? input.note.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : "";
  if (reason === "OTHER" && !note) return { ok: false, error: "Tell the moderator a little about what happened." };
  return { ok: true, reason, note: note || null };
}

/** What putting a finished match's ladder change right looks like for one player: the counters to take back. */
export function undoCounters(result: string): { wins: number; losses: number; draws: number } {
  return { wins: result === "WIN" ? 1 : 0, losses: result === "LOSS" ? 1 : 0, draws: result === "DRAW" ? 1 : 0 };
}
