import { createHash, randomBytes } from "crypto";

/**
 * Sharing rules with no database, so they can be tested.
 *
 * A share link carries a random token. Only its hash is stored, so a leaked database does not leak working links, and the
 * link itself is shown once, when it is made. A link works until it expires, is revoked, or has been used `maxUses` times.
 */
export type ResourceType = "COURSE" | "EXAM" | "ASSIGNMENT";
export type LinkRole = "EDITOR" | "COPY";
export const RESOURCE_TYPES: ResourceType[] = ["COURSE", "EXAM", "ASSIGNMENT"];
export const RESOURCE_LABEL: Record<ResourceType, string> = { COURSE: "course", EXAM: "examination", ASSIGNMENT: "assignment" };

export const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_USES = 10;

export const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type LinkState = "ok" | "expired" | "revoked" | "used_up";
export function linkState(link: { expiresAt: Date; revokedAt: Date | null; useCount: number; maxUses: number }, now: Date = new Date()): LinkState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt.getTime() <= now.getTime()) return "expired";
  if (link.useCount >= link.maxUses) return "used_up";
  return "ok";
}

export const LINK_STATE_MESSAGE: Record<Exclude<LinkState, "ok">, string> = {
  expired: "This link has expired. Ask the person who shared it for a new one.",
  revoked: "This link was cancelled. Ask the person who shared it for a new one.",
  used_up: "This link has been used as many times as it allows. Ask the person who shared it for a new one.",
};

/** Fields only the owner may change on a course: publishing, pricing and the certificate. Editors change content. */
export const OWNER_ONLY_COURSE_FIELDS = ["status", "isFree", "priceKobo", "discountPercent", "freePreviewModuleCount", "billingInterval", "accessModel", "accessDurationValue", "accessDurationUnit", "aiCreditAllowanceOverride", "certificateTemplateId"] as const;

export function ownerOnlyFieldsIn(body: Record<string, unknown>): string[] {
  return OWNER_ONLY_COURSE_FIELDS.filter((k) => k in body && body[k] !== undefined);
}

/** Only staff, instructors and organizations (all signed in as staff accounts) can join. Trainees and the like cannot. */
export const COLLABORATOR_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"] as const;
export const canCollaborate = (role: string) => (COLLABORATOR_ROLES as readonly string[]).includes(role);

export function isResourceType(v: unknown): v is ResourceType {
  return typeof v === "string" && (RESOURCE_TYPES as string[]).includes(v);
}
