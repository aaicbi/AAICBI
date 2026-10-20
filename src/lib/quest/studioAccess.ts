/**
 * Who may use the Game Studio, and what each person may touch in it.
 *
 *  Only a Super Admin may use it: every game, course and module, and Loop at any autonomy level. Training organizations,
 *  admins and instructors have no Game Studio. (The helpers below that narrow a non-super person's view are kept for
 *  the shared types and are never reached while the studio is Super Admin only.)
 */
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { ownedOrSharedWhere } from "@/lib/collab/access";
import { clampLevel, type LoopLevel } from "@/lib/loop/policy";
import { ALL_STUDIO_PERMISSIONS, permissionsFrom, STUDIO_PERMISSIONS, type StudioPermission } from "@/lib/quest/permissions";

export type StudioIdentity = { userId: string; role: string; isSuper: boolean };

export interface StudioSession {
  userId: string;
  role: string;
  isSuper: boolean;
  /** What this person may do. A Super Admin has all of it. */
  permissions: StudioPermission[];
}

function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

/** The Game Studio (and Loop inside it, and the game results) belongs to the Super Admin alone: training organizations, admins and instructors are turned away. */
export async function requireStudioUser(): Promise<StudioSession> {
  const s = await requireRole("SUPER_ADMIN");
  return { userId: s.userId, role: s.role, isSuper: true, permissions: [...ALL_STUDIO_PERMISSIONS] };
}

export async function permissionsFor(userId: string): Promise<StudioPermission[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { studioPermissions: true } });
  return permissionsFrom(u?.studioPermissions);
}

/** Throws 403 unless the person has this permission (a Super Admin always does). */
export function requireStudioPermission(session: StudioSession, key: StudioPermission): void {
  if (session.isSuper || session.permissions.includes(key)) return;
  const label = STUDIO_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
  const err = new Error(`You don't have permission for this: ${label}. Ask a Super Admin to allow it.`) as Error & { status?: number };
  err.status = 403;
  throw err;
}

/** Throws 404 unless this person may work on the module (own it, share it, or is a Super Admin). */
export async function requireStudioModule(moduleId: string, session: StudioIdentity) {
  return requireOwnedModule(moduleId, session.userId, session.role);
}

/** A Super Admin may use any game; everyone else only the ones they made. */
export async function requireStudioGame(gameId: string, session: StudioIdentity) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, createdById: true } });
  if (!game || (!session.isSuper && game.createdById !== session.userId)) throw notFound("That game could not be found.");
  return game;
}

/** Prisma `where` for the games this person sees. */
export function gamesWhere(session: StudioIdentity): { createdById?: string } {
  return session.isSuper ? {} : { createdById: session.userId };
}

/** Prisma `where` for the courses this person sees (everything for a Super Admin). */
export async function coursesWhere(session: StudioIdentity) {
  return (await ownedOrSharedWhere({ userId: session.userId, role: session.role }, "COURSE")) ?? {};
}

/** The highest autonomy level this person may use. */
export async function maxLevelFor(session: StudioIdentity): Promise<LoopLevel> {
  if (session.isSuper) return 3;
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { loopMaxLevel: true } });
  return clampLevel(u?.loopMaxLevel ?? 1);
}

export async function clampToAllowed(requested: LoopLevel, session: StudioIdentity): Promise<LoopLevel> {
  const max = await maxLevelFor(session);
  return (requested > max ? max : requested) as LoopLevel;
}
