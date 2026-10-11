import type { Prisma, Profile, ProfileKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { suggestHandle, validateHandle } from "@/lib/profiles/handleCore";

/**
 * The profile identity layer (see Profile in schema.prisma): one public
 * identity per existing account, found by handle. Logins and account ids are
 * never touched. Profiles are created in bulk by `backfillProfiles` and one at a
 * time, on demand, by `ensureProfile`, so a missing profile is never an error.
 */
type SourceKey = "traineeId" | "employerId" | "investorId" | "trainingOrganizationId" | "userId" | "startupId";
const SOURCE: Record<ProfileKind, SourceKey> = { PERSON: "traineeId", EMPLOYER: "employerId", INVESTOR: "investorId", TRAINING_ORG: "trainingOrganizationId", STAFF: "userId", STARTUP: "startupId" };

export const profileHref = (handle: string) => `/@${handle}`;

interface Source { id: string; name: string; preferred: string | null }

async function sources(kind: ProfileKind): Promise<Source[]> {
  switch (kind) {
    case "PERSON":
      return (await prisma.trainee.findMany({ select: { id: true, name: true, username: true } })).map((t) => ({ id: t.id, name: t.name, preferred: t.username }));
    case "STAFF":
      // The shadow staff account created for each approved organization is not a person and gets no profile.
      return (await prisma.user.findMany({ where: { trainingOrgAsStaffUser: { is: null } }, select: { id: true, name: true, username: true } })).map((u) => ({ id: u.id, name: u.name, preferred: u.username }));
    case "TRAINING_ORG":
      return (await prisma.trainingOrganization.findMany({ select: { id: true, name: true, publicProfile: { select: { slug: true } } } })).map((o) => ({ id: o.id, name: o.name, preferred: o.publicProfile?.slug ?? null }));
    case "EMPLOYER":
      return (await prisma.employer.findMany({ select: { id: true, companyName: true } })).map((e) => ({ id: e.id, name: e.companyName, preferred: null }));
    case "INVESTOR":
      return (await prisma.investor.findMany({ select: { id: true, name: true } })).map((i) => ({ id: i.id, name: i.name, preferred: null }));
    case "STARTUP":
      return (await prisma.startup.findMany({ select: { id: true, name: true } })).map((x) => ({ id: x.id, name: x.name, preferred: null }));
    default:
      return [];
  }
}

async function sourceName(kind: ProfileKind, id: string): Promise<Source | null> {
  switch (kind) {
    case "PERSON": {
      const t = await prisma.trainee.findUnique({ where: { id }, select: { name: true, username: true } });
      return t && { id, name: t.name, preferred: t.username };
    }
    case "STAFF": {
      const u = await prisma.user.findUnique({ where: { id }, select: { name: true, username: true } });
      return u && { id, name: u.name, preferred: u.username };
    }
    case "TRAINING_ORG": {
      const o = await prisma.trainingOrganization.findUnique({ where: { id }, select: { name: true, publicProfile: { select: { slug: true } } } });
      return o && { id, name: o.name, preferred: o.publicProfile?.slug ?? null };
    }
    case "EMPLOYER": {
      const e = await prisma.employer.findUnique({ where: { id }, select: { companyName: true } });
      return e && { id, name: e.companyName, preferred: null };
    }
    case "INVESTOR": {
      const i = await prisma.investor.findUnique({ where: { id }, select: { name: true } });
      return i && { id, name: i.name, preferred: null };
    }
    case "STARTUP": {
      const x = await prisma.startup.findUnique({ where: { id }, select: { name: true } });
      return x && { id, name: x.name, preferred: null };
    }
    default:
      return null;
  }
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

async function createWith(kind: ProfileKind, sourceId: string, base: string, taken: Set<string>): Promise<Profile> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = suggestHandle(base, (h) => taken.has(h));
    try {
      const row = await prisma.profile.create({ data: { kind, handle, [SOURCE[kind]]: sourceId } as Prisma.ProfileUncheckedCreateInput });
      taken.add(handle);
      return row;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Another request took the handle (or already made this profile): look again.
      const existing = await prisma.profile.findFirst({ where: { [SOURCE[kind]]: sourceId } });
      if (existing) return existing;
      taken.add(handle);
    }
  }
  throw new Error("Could not find a free handle");
}

/** The profile for an account, created on first use. Returns null when the account does not exist. */
export async function ensureProfile(kind: ProfileKind, sourceId: string): Promise<Profile | null> {
  const found = await prisma.profile.findFirst({ where: { [SOURCE[kind]]: sourceId } });
  if (found) return found;
  const src = await sourceName(kind, sourceId);
  if (!src) return null;
  const taken = await takenHandles();
  return createWith(kind, sourceId, src.preferred || src.name, taken);
}

/** For account creation: gives the new account its profile, and never fails the sign-up if that cannot be done (it is made on first use instead). */
export async function ensureProfileQuietly(kind: ProfileKind, sourceId: string): Promise<void> {
  try {
    await ensureProfile(kind, sourceId);
  } catch (e) {
    console.error("Could not create a profile at sign-up:", e instanceof Error ? e.message : e);
  }
}

export interface BackfillResult { created: Record<string, number>; existing: number; total: number }

/**
 * Gives every account without a profile one. Safe to run again: accounts that
 * already have a profile are skipped. Accounts with an existing username or
 * public-page slug get that as their handle first, so established names keep
 * working; the rest are named from their display name.
 */
export async function backfillProfiles(): Promise<BackfillResult> {
  const have = await prisma.profile.findMany({ select: { handle: true, traineeId: true, employerId: true, investorId: true, trainingOrganizationId: true, userId: true, startupId: true } });
  const taken = await takenHandles();
  const done = new Set(have.flatMap((p) => [p.traineeId, p.employerId, p.investorId, p.trainingOrganizationId, p.userId, p.startupId].filter((x): x is string => !!x)));
  const kinds: ProfileKind[] = ["TRAINING_ORG", "STAFF", "PERSON", "EMPLOYER", "INVESTOR", "STARTUP"];
  const all: Array<{ kind: ProfileKind; src: Source }> = [];
  for (const kind of kinds) for (const src of await sources(kind)) if (!done.has(src.id)) all.push({ kind, src });
  // Explicit usernames and slugs are placed first so a generated name can never take one.
  all.sort((a, b) => Number(!!b.src.preferred) - Number(!!a.src.preferred));
  const created: Record<string, number> = {};
  for (const { kind, src } of all) {
    const pref = src.preferred && validateHandle(src.preferred).ok ? src.preferred : null;
    await createWith(kind, src.id, pref ?? src.name, taken);
    created[kind] = (created[kind] ?? 0) + 1;
  }
  return { created, existing: done.size, total: done.size + all.length };
}

export async function profileByHandle(handle: string): Promise<Profile | null> {
  const v = validateHandle(handle);
  const h = v.ok ? v.handle : handle.toLowerCase();
  return prisma.profile.findUnique({ where: { handle: h } });
}

/**
 * True when the handle can be used by this profile: no other profile holds it
 * now, and it is not a former handle of someone else (those stay reserved).
 */
export async function handleIsFree(handle: string, exceptProfileId?: string): Promise<boolean> {
  const [row, former] = await Promise.all([
    prisma.profile.findUnique({ where: { handle }, select: { id: true } }),
    prisma.profileHandleHistory.findUnique({ where: { handle }, select: { profileId: true } }),
  ]);
  if (row && row.id !== exceptProfileId) return false;
  if (former && former.profileId !== exceptProfileId) return false;
  return true;
}

async function takenHandles(): Promise<Set<string>> {
  const [current, former] = await Promise.all([prisma.profile.findMany({ select: { handle: true } }), prisma.profileHandleHistory.findMany({ select: { handle: true } })]);
  return new Set([...current, ...former].map((p) => p.handle));
}

/** Removes profiles for accounts that should not have one (organization shadow staff accounts). Safe to run again. */
export async function removeShadowStaffProfiles(): Promise<number> {
  const shadows = await prisma.user.findMany({ where: { trainingOrgAsStaffUser: { isNot: null } }, select: { id: true } });
  if (shadows.length === 0) return 0;
  const res = await prisma.profile.deleteMany({ where: { userId: { in: shadows.map((s) => s.id) } } });
  return res.count;
}
