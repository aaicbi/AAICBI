import { requireApprovedEmployer } from "@/lib/employerAccess";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Shared by /api/profile/u/[username] and /profile/u/[username]/page.tsx
 * so the two surfaces can never silently drift into different access
 * rules for the same `profileVisibility` value.
 */
export async function canViewProfile(
  visibility: string,
  ownerId: string,
  ownerKind: "TRAINEE" | "STAFF",
  viewer: SessionPayload | null
): Promise<boolean> {
  const isOwner =
    viewer !== null &&
    viewer.userId === ownerId &&
    ((ownerKind === "TRAINEE" && viewer.role === "TRAINEE") ||
      (ownerKind === "STAFF" && ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(viewer.role)));
  if (isOwner) return true;

  const isStaff = viewer !== null && ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(viewer.role);
  if (isStaff) return true;

  if (visibility === "PUBLIC") return true;
  if (visibility === "PRIVATE") return false;
  if (visibility === "AUTHENTICATED") return viewer !== null;
  if (visibility === "EMPLOYERS_ONLY") {
    if (!viewer || viewer.role !== "EMPLOYER") return false;
    try {
      await requireApprovedEmployer(viewer.userId);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
