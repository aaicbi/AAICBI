/** Pure rules behind the trainee performance report: no database, so every number can be tested. */

export interface AttemptLite { examKey: string; attemptNumber: number; percentage: number | null; passed: boolean | null; submittedAt: Date | null; startedAt: Date }
export interface ExamSummary { examKey: string; attempts: number; best: number | null; latest: number | null; average: number | null; passed: boolean; attemptsToPass: number | null }
export interface PlayLite { correct: boolean | null; secondsTaken: number | null; tooFast: boolean; answeredAt: Date | null; format: string; moduleId: string }

const round = (n: number) => Math.round(n);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Attempts per assessment: how many tries, best and latest score, and which try finally passed. Only submitted attempts count. */
export function summariseAttempts(attempts: AttemptLite[]): ExamSummary[] {
  const byExam = new Map<string, AttemptLite[]>();
  for (const a of attempts) if (a.submittedAt && a.percentage != null) byExam.set(a.examKey, [...(byExam.get(a.examKey) ?? []), a]);
  return [...byExam.entries()].map(([examKey, list]) => {
    list.sort((a, b) => a.attemptNumber - b.attemptNumber || a.startedAt.getTime() - b.startedAt.getTime());
    const scores = list.map((a) => a.percentage as number);
    const firstPass = list.findIndex((a) => a.passed === true);
    const avg = mean(scores);
    return { examKey, attempts: list.length, best: round(Math.max(...scores)), latest: round(scores[scores.length - 1]), average: avg == null ? null : round(avg), passed: firstPass >= 0, attemptsToPass: firstPass >= 0 ? firstPass + 1 : null };
  });
}

/** Days (YYYY-MM-DD, UTC) on which anything happened, newest first. */
export function activeDayKeys(dates: Date[]): string[] {
  return [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))].sort().reverse();
}

export interface GameStats { played: number; correct: number; accuracyPercent: number | null; avgSeconds: number | null; tooFast: number; activeDays: number; lastPlayedAt: Date | null; byFormat: { format: string; played: number; accuracyPercent: number | null }[] }

/** Engagement with the learning games. A play only counts once answered; "too fast" plays are shown, not hidden. */
export function summarisePlays(plays: PlayLite[]): GameStats {
  const answered = plays.filter((p) => p.answeredAt);
  const accuracy = (xs: PlayLite[]) => (xs.length ? round((xs.filter((p) => p.correct).length / xs.length) * 100) : null);
  const secs = answered.map((p) => p.secondsTaken).filter((s): s is number => s != null);
  const formats = [...new Set(answered.map((p) => p.format))].sort();
  const avg = mean(secs);
  return {
    played: answered.length,
    correct: answered.filter((p) => p.correct).length,
    accuracyPercent: accuracy(answered),
    avgSeconds: avg == null ? null : round(avg),
    tooFast: answered.filter((p) => p.tooFast).length,
    activeDays: activeDayKeys(answered.map((p) => p.answeredAt as Date)).length,
    lastPlayedAt: answered.length ? new Date(Math.max(...answered.map((p) => (p.answeredAt as Date).getTime()))) : null,
    byFormat: formats.map((f) => { const xs = answered.filter((p) => p.format === f); return { format: f, played: xs.length, accuracyPercent: accuracy(xs) }; }),
  };
}

/** A plain label for how engaged someone is, from days active in the last 30 and how recently. */
export function engagementLevel(activeDaysLast30: number, daysSinceLastActive: number | null): "High" | "Steady" | "Low" | "Inactive" {
  if (daysSinceLastActive == null || daysSinceLastActive > 30) return "Inactive";
  if (activeDaysLast30 >= 12 && daysSinceLastActive <= 3) return "High";
  if (activeDaysLast30 >= 4 && daysSinceLastActive <= 10) return "Steady";
  return "Low";
}

export function fmtDate(d: Date | null | undefined): string { return d ? d.toISOString().slice(0, 10) : "—"; }
export function fmtMinutes(from: Date, to: Date | null): string { if (!to) return "—"; const m = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000)); return `${m} min`; }

const csvCell = (v: unknown) => { const s = v == null ? "" : String(v); const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
/** CSV with spreadsheet-formula protection on every cell. */
export function toCsv(header: string[], rows: unknown[][]): string { return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"; }

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
/** Splits "a@x.com, b@y.com" into at most `max` valid, lower-cased, de-duplicated addresses; returns the ones refused too. */
export function parseRecipients(raw: string, max = 5): { ok: string[]; bad: string[]; tooMany: boolean } {
  const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const ok: string[] = []; const bad: string[] = [];
  for (const p of parts) { if (EMAIL.test(p) && p.length <= 254) { const l = p.toLowerCase(); if (!ok.includes(l)) ok.push(l); } else bad.push(p); }
  return { ok: ok.slice(0, max), bad, tooMany: ok.length > max };
}
