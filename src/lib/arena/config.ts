import { prisma } from "@/lib/prisma";
import { availability, normalizeSwitches, resolveArena, type ArenaAvailable, type ArenaRow, type ArenaSettings } from "@/lib/arena/configCore";

/**
 * Ayakbi Arena switches and rules from the database. The rows are read widest to narrowest
 * (platform, the course's organization, the course) and merged by resolveArena.
 */
type ScopeType = "PLATFORM" | "ORGANIZATION" | "COURSE";

const ROW_FIELDS = ["enabled", "gameEnabled", "chatEnabled", "ladderEnabled", "walletEnabled", "fastestEnabled", "spectators", "spectatorCap", "questionSeconds", "pickSeconds", "bonusPercent", "pausesPerPlayer", "pauseSeconds", "questionsPerMatch", "tickingSound"] as const;

function toRow(r: Record<string, unknown> | null | undefined): ArenaRow | null {
  if (!r) return null;
  const row: Record<string, unknown> = {};
  for (const k of ROW_FIELDS) row[k] = r[k] ?? null;
  return row as ArenaRow;
}

/** The organization that owns a course (its staff user created it), or null for a course published by AAICBI itself. */
export async function organizationOfCourse(courseId: string): Promise<{ organizationId: string | null; exists: boolean }> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
  if (!course) return { organizationId: null, exists: false };
  const org = await prisma.trainingOrganization.findFirst({ where: { staffUserId: course.createdById }, select: { id: true } });
  return { organizationId: org?.id ?? null, exists: true };
}

export async function scopeRow(scopeType: ScopeType, scopeId = ""): Promise<ArenaRow | null> {
  const r = await prisma.arenaConfig.findUnique({ where: { scopeType_scopeId: { scopeType, scopeId } } });
  return toRow(r as unknown as Record<string, unknown> | null);
}

/** Platform settings only (what a new course starts from). */
export async function resolvePlatform(): Promise<ArenaSettings> {
  return resolveArena([await scopeRow("PLATFORM")]);
}

/** The settings that apply to one course. A database error reads as "off" so a failing database never opens the arena. */
export async function resolveForCourse(courseId: string): Promise<ArenaSettings> {
  try {
    const { organizationId } = await organizationOfCourse(courseId);
    const [platform, org, course] = await Promise.all([scopeRow("PLATFORM"), organizationId ? scopeRow("ORGANIZATION", organizationId) : null, scopeRow("COURSE", courseId)]);
    return resolveArena([platform, org, course]);
  } catch {
    return resolveArena([{ enabled: false }]);
  }
}

export async function availabilityForCourse(courseId: string): Promise<ArenaAvailable> {
  return availability(await resolveForCourse(courseId));
}

/** Saves a patch on one scope. `null` fields go back to inheriting. The stored switches are kept consistent (no ladder without the game, and so on). */
export async function saveScope(scopeType: ScopeType, scopeId: string, patch: ArenaRow, updatedById: string): Promise<ArenaRow> {
  const key = { scopeType, scopeId };
  const existing = toRow((await prisma.arenaConfig.findUnique({ where: { scopeType_scopeId: key } })) as unknown as Record<string, unknown> | null) ?? {};
  const merged: ArenaRow = { ...existing, ...patch };
  // When a switch in this row is turned off, the switches that depend on it are turned off in the same row.
  if (merged.enabled === false) Object.assign(merged, { gameEnabled: false, chatEnabled: false, fastestEnabled: false, walletEnabled: false, ladderEnabled: false, spectators: "OFF" });
  if (merged.gameEnabled === false) Object.assign(merged, { ladderEnabled: false, spectators: "OFF" });
  if (merged.chatEnabled === false) Object.assign(merged, { fastestEnabled: false });
  const data = { ...merged, updatedById } as Record<string, unknown>;
  await prisma.arenaConfig.upsert({ where: { scopeType_scopeId: key }, create: { ...key, ...data } as never, update: data as never });
  return merged;
}

export { normalizeSwitches };
