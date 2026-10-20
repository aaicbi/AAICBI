/**
 * Who may use the Game Studio, and what each person may touch in it.
 *
 *  - A Super Admin: everything, and Loop at any autonomy level.
 *  - Staff a Super Admin gave "Access the Gaming Studio": the whole Studio (every game, course and module), but only the actions they were
 *    granted one by one (create, edit, delete, test, publish, assets, engine settings, question bank, Loop). Loop for them is limited to the
 *    tools those permissions allow and starts at "ask first".
 *  - Training organizations, other staff and everyone else: nothing. The Studio does not appear in their menu and every route refuses them.
 */
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionError, type Access } from "@/lib/rbac/guard";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { ownedOrSharedWhere } from "@/lib/collab/access";
import { clampLevel, type LoopLevel } from "@/lib/loop/policy";
import { ALL_STUDIO_PERMISSIONS, permissionsFrom, STUDIO_PERMISSIONS, type StudioPermission } from "@/lib/quest/permissions";

export type StudioIdentity = { userId: string; role: string; isSuper: boolean; scopeAll?: boolean };

export interface StudioSession {
  userId: string;
  role: string;
  /** A Super Admin: Loop gets every platform tool. */
  isSuper: boolean;
  /** Sees every game, course and module (a Super Admin, or staff a Super Admin gave Studio access). */
  scopeAll: boolean;
  /** The older studio permission keys this person's new permissions amount to (used to limit Loop). */
  permissions: StudioPermission[];
  /** The new permissions they hold. */
  has: (key: string) => boolean;
}

/** Which new permission(s) each older studio key now needs (any one is enough). */
const LEGACY_TO_NEW: Record<StudioPermission, string[]> = {
  LOOP: ["gaming_studio.loop:manage"],
  GAMES: ["gaming_studio.games:create", "gaming_studio.games:edit"],
  ITEMS: ["gaming_studio.assets:manage"],
  ASSIGN: ["gaming_studio.games:manage", "gaming_studio.games:publish"],
  QUESTIONS: ["gaming_studio.engine:configure"],
  BANK_AI: ["gaming_studio.bank:manage"],
  ANALYTICS: ["reports.platform:view"],
  COHORTS: ["trainees.cohorts:manage"],
  PEOPLE_DATA: ["reports.trainees:view"],
  GAME_RESULTS: ["gaming_ops.results:view"],
  MESSAGING: ["comms.messages:view"],
};

function legacyKeysFrom(has: (k: string) => boolean): StudioPermission[] {
  return ALL_STUDIO_PERMISSIONS.filter((k) => LEGACY_TO_NEW[k].some(has));
}

function sessionFrom(s: { userId: string; role: string }, access: Access): StudioSession {
  const isSuper = access.kind === "super";
  const has = (k: string) => isSuper || access.permissions.has(k);
  return { userId: s.userId, role: s.role, isSuper, scopeAll: true, permissions: isSuper ? [...ALL_STUDIO_PERMISSIONS] : legacyKeysFrom(has), has };
}

function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

/** The Game Studio (and Loop inside it, and the game results) belongs to the Super Admin alone: training organizations, admins and instructors are turned away. */
/**
 * The Game Studio (and Loop inside it) is for the Super Admin and for staff a Super Admin gave "Access the Gaming Studio". A training organization
 * never has it, whatever its role, and each action inside needs its own permission (see requireStudioCan).
 */
export async function requireStudioUser(): Promise<StudioSession> {
  const { session, access } = await requirePermission("gaming_studio.access:view");
  return sessionFrom(session, access);
}

/** For gaming operations (results, moderation of platform games): needs the named permission, not Studio access. */
export async function requireGamingOps(permission: string): Promise<StudioSession> {
  const { session, access } = await requirePermission(permission);
  return sessionFrom(session, access);
}

/** Throws 403 unless the person holds this permission (a Super Admin always does). */
export function requireStudioCan(session: StudioSession, key: string): void {
  if (session.has(key)) return;
  throw new PermissionError(key);
}

export async function permissionsFor(userId: string): Promise<StudioPermission[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { studioPermissions: true } });
  return permissionsFrom(u?.studioPermissions);
}

/** Throws 403 unless the person has this permission (a Super Admin always does). */
export function requireStudioPermission(session: StudioSession, key: StudioPermission): void {
  if (session.isSuper || LEGACY_TO_NEW[key].some(session.has)) return;
  const label = STUDIO_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
  const err = new Error(`You don't have permission for this: ${label}. Ask a Super Admin to allow it.`) as Error & { status?: number };
  err.status = 403;
  throw err;
}

/** Throws 404 unless this person may work on the module (own it, share it, or is a Super Admin). */
export async function requireStudioModule(moduleId: string, session: StudioIdentity) {
  return requireOwnedModule(moduleId, session.userId, session.isSuper || session.scopeAll ? "SUPER_ADMIN" : session.role);
}

/** A Super Admin may use any game; everyone else only the ones they made. */
export async function requireStudioGame(gameId: string, session: StudioIdentity) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, createdById: true } });
  if (!game || (!session.isSuper && !session.scopeAll && game.createdById !== session.userId)) throw notFound("That game could not be found.");
  return game;
}

/** Prisma `where` for the games this person sees. */
export function gamesWhere(session: StudioIdentity | { userId: string; role: string; isSuper: boolean; allModules?: boolean }): { createdById?: string } {
  const all = session.isSuper || (("scopeAll" in session && session.scopeAll) || ("allModules" in session && !!session.allModules));
  return all ? {} : { createdById: session.userId };
}

/** Prisma `where` for the courses this person sees (everything for a Super Admin). */
export async function coursesWhere(session: StudioIdentity) {
  if (session.isSuper || session.scopeAll) return {};
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
