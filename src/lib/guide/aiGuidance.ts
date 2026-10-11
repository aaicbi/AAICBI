import { prisma } from "@/lib/prisma";
import { AI_FEATURES, applyGuidanceText, isFeatureKey, validateNote } from "@/lib/guide/aiGuidanceCore";

/**
 * Reads and writes the approved guidance for the platform's AI features.
 * `withGuidance` is what each feature calls on its own system prompt: it
 * returns the prompt unchanged when there is no guidance, and it can never
 * fail a feature (any problem reading guidance just means no guidance).
 */
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; note: string | null }>();

export function clearGuidanceCache() {
  cache.clear();
}

export async function currentNote(feature: string): Promise<string | null> {
  if (!isFeatureKey(feature)) return null;
  const hit = cache.get(feature);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.note;
  const row = await prisma.aiGuidance.findFirst({ where: { feature }, orderBy: { version: "desc" }, select: { note: true, enabled: true } });
  const note = row && row.enabled ? row.note : null;
  cache.set(feature, { at: Date.now(), note });
  return note;
}

export async function withGuidance(base: string, feature: string): Promise<string> {
  try {
    return applyGuidanceText(base, await currentNote(feature));
  } catch (e) {
    console.error("AI guidance could not be read; using the feature's own prompt:", e instanceof Error ? e.message : e);
    return base;
  }
}

export interface GuidanceVersion {
  version: number;
  note: string;
  enabled: boolean;
  changedByName: string | null;
  changeNote: string | null;
  createdAt: Date;
}

export interface FeatureGuidance {
  key: string;
  label: string;
  where: string;
  example: string;
  current: GuidanceVersion | null;
  versions: GuidanceVersion[];
}

export async function listGuidance(): Promise<FeatureGuidance[]> {
  const rows = await prisma.aiGuidance.findMany({ orderBy: [{ feature: "asc" }, { version: "desc" }], take: 400 });
  return AI_FEATURES.map((f) => {
    const versions = rows.filter((r) => r.feature === f.key).slice(0, 30).map((r) => ({ version: r.version, note: r.note, enabled: r.enabled, changedByName: r.changedByName, changeNote: r.changeNote, createdAt: r.createdAt }));
    return { ...f, current: versions[0] ?? null, versions };
  });
}

export class GuidanceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Saves a note as the next version. Turning guidance off saves a new version with it switched off, so history is kept. */
export async function saveGuidance(input: { feature: string; note: string; enabled: boolean; changeNote?: string }, actor: { userId: string; name: string }): Promise<number> {
  if (!isFeatureKey(input.feature)) throw new GuidanceError("That AI feature cannot be trained.");
  const check = validateNote(input.note);
  if (!check.ok) throw new GuidanceError(check.error);
  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.aiGuidance.findFirst({ where: { feature: input.feature }, orderBy: { version: "desc" }, select: { version: true } });
    const next = (last?.version ?? 0) + 1;
    await tx.aiGuidance.create({ data: { feature: input.feature, version: next, note: check.note, enabled: input.enabled, changedById: actor.userId, changedByName: actor.name, changeNote: input.changeNote?.slice(0, 200) ?? null } });
    return next;
  });
  clearGuidanceCache();
  return version;
}

/** Brings an older version back as a new version. */
export async function restoreGuidance(feature: string, version: number, actor: { userId: string; name: string }): Promise<number> {
  if (!isFeatureKey(feature)) throw new GuidanceError("That AI feature cannot be trained.");
  const old = await prisma.aiGuidance.findUnique({ where: { feature_version: { feature, version } } });
  if (!old) throw new GuidanceError("Version not found.", 404);
  return saveGuidance({ feature, note: old.note, enabled: old.enabled, changeNote: `Restored version ${version}` }, actor);
}
