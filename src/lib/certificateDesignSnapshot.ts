import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * A certificate's look, frozen at the moment it was issued. A
 * Certificate used to be drawn live from whatever template its course
 * pointed at when the page loaded — so re-assigning a course to another
 * template (or clearing it) silently re-designed every certificate
 * already handed out. Snapshotting the design onto the Certificate row
 * makes an issued certificate immutable the same way its code already
 * is.
 *
 * `template: null` is a real, distinct state — "issued with AAICBI's
 * own default design" — not the same as the column itself being null,
 * which means "issued before snapshots existed" (the migration
 * backfills those, so null should only ever be seen mid-deploy).
 *
 * The organization's watermark-removal subscription is deliberately NOT
 * frozen here: it's a billing state, not a design choice, so the page
 * still reads it live via `trainingOrganizationId` — and for a `null`
 * template (AAICBI's own default design), the watermark is simply
 * always on, since there's no org to pay to remove it.
 */
export interface CertificateDesignSnapshot {
  version: 1;
  template: null | {
    trainingOrganizationId: string;
    organizationName: string;
    logoUrl: string | null;
    signatoryName: string | null;
    signatoryTitle: string | null;
    layoutJson: unknown;
  };
}

/** Reads the course's CURRENT approved template; call at issue time only. */
export async function buildCertificateDesignSnapshot(courseId: string): Promise<CertificateDesignSnapshot> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      certificateTemplate: {
        select: {
          approvedAt: true,
          trainingOrganizationId: true,
          logoUrl: true,
          signatoryName: true,
          signatoryTitle: true,
          layoutJson: true,
          trainingOrganization: { select: { name: true } },
        },
      },
    },
  });
  const t = course?.certificateTemplate;
  // Same rule the public page always applied: an unapproved template is
  // never used, even if one is assigned.
  if (!t || !t.approvedAt) return { version: 1, template: null };
  return {
    version: 1,
    template: {
      trainingOrganizationId: t.trainingOrganizationId,
      organizationName: t.trainingOrganization.name,
      logoUrl: t.logoUrl,
      signatoryName: t.signatoryName,
      signatoryTitle: t.signatoryTitle,
      layoutJson: t.layoutJson,
    },
  };
}

export function toSnapshotJson(snapshot: CertificateDesignSnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

/** Narrow the stored JSON; anything unrecognised reads as "no snapshot". */
export function parseCertificateDesignSnapshot(value: unknown): CertificateDesignSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { version?: unknown; template?: unknown };
  if (v.version !== 1 || !("template" in v)) return null;
  return value as CertificateDesignSnapshot;
}
