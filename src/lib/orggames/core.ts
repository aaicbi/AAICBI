/** Pure rules for the organization Games section: reasons, flags and labels. No database, so they are tested. */
export const REASON_MIN = 5;
export const REASON_MAX = 300;

/** A moderation decision always carries a reason a reviewer can read later. */
export function cleanReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const r = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (r.length < REASON_MIN) return { ok: false, error: `Say why, in at least ${REASON_MIN} characters. The reason is kept with the decision.` };
  return { ok: true, reason: r.slice(0, REASON_MAX) };
}

export const ACTION_KINDS = ["WARNING", "RESTRICTION", "RESTRICTION_LIFTED", "SESSION_ENDED", "REMOVAL", "ESCALATED", "REPORT_RESOLVED", "REPORT_DISMISSED", "MESSAGE_REMOVED", "CHAT_GAME_CLOSED", "NOTE"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const ACTION_LABEL: Record<ActionKind, string> = {
  WARNING: "Warning given", RESTRICTION: "Participation restricted", RESTRICTION_LIFTED: "Restriction lifted", SESSION_ENDED: "Game session ended", REMOVAL: "Removed from a game",
  ESCALATED: "Escalated to AAICBI", REPORT_RESOLVED: "Report resolved", REPORT_DISMISSED: "Report dismissed", MESSAGE_REMOVED: "Message removed", CHAT_GAME_CLOSED: "Chat game closed", NOTE: "Note",
};

/** A match still marked as being played long after it began is probably abandoned. */
export const ABANDONED_AFTER_MS = 2 * 60 * 60 * 1000;
export function liveFlags(m: { status: string; startedAt: number; openReports: number }, now: number): string[] {
  const flags: string[] = [];
  if (m.status === "ACTIVE" && now - m.startedAt > ABANDONED_AFTER_MS) flags.push("Possibly abandoned");
  if (m.openReports > 0) flags.push(m.openReports === 1 ? "1 open report" : `${m.openReports} open reports`);
  return flags;
}

/** The settings an organization may change for one course, by what the Super Admin allowed. */
export const ORG_SWITCH_KEYS = ["gameEnabled", "chatEnabled", "ladderEnabled", "fastestEnabled", "eventsEnabled"] as const;
export type OrgSwitchKey = (typeof ORG_SWITCH_KEYS)[number];
export const SWITCH_LABEL: Record<OrgSwitchKey, string> = { gameEnabled: "One-to-one games", chatEnabled: "Course group chat", ladderEnabled: "Ladder and leaderboard", fastestEnabled: "Fastest Fingers", eventsEnabled: "Live arena nights" };

/** An organization may switch a game on only where the wider settings (platform, then the organization) already allow it; turning off is always fine. */
export function mayToggle(key: string, next: boolean, inherited: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  if (!(ORG_SWITCH_KEYS as readonly string[]).includes(key)) return { ok: false, reason: "That setting belongs to the platform." };
  if (next && inherited[key] !== true) return { ok: false, reason: "The platform has this switched off, so it cannot be turned on for a course." };
  return { ok: true };
}

export const RESULT_CSV_HEAD = ["Name", "Email", "Where", "Games", "Answers", "Correct", "Accuracy %", "Average score %"];
