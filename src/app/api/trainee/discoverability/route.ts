import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z.object({
  publiclyDiscoverable: z.boolean(),
  discoverableHeadline: z.string().max(120).nullable(),
  discoverableBio: z.string().max(1000).nullable(),
  certificateIds: z.array(z.string()),
});

/**
 * GET/PUT /api/trainee/discoverability — M32's actual settings
 * extension, deliberately its own route rather than folded into the
 * general M14 settings PUT (see that route's own established
 * reasoning for avatarUrl/aiCreditBalance): this has real,
 * non-trivial side effects (replacing which certificates are publicly
 * listed) that a bare toggle write shouldn't carry.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        publiclyDiscoverable: true,
        discoverableHeadline: true,
        discoverableBio: true,
        discoverableCertificates: { select: { certificateId: true } },
      },
    });
    // Every certificate this trainee actually holds, with a flag for
    // whether it's currently included — the checklist shape the
    // settings page needs, computed here rather than requiring two
    // separate requests.
    const certificates = await prisma.certificate.findMany({
      where: { traineeId: session.userId },
      select: { id: true, code: true, revokedAt: true, course: { select: { title: true } } },
    });
    const discoverableIds = new Set(
      trainee.discoverableCertificates.map((d: { certificateId: string }) => d.certificateId)
    );

    return NextResponse.json({
      publiclyDiscoverable: trainee.publiclyDiscoverable,
      discoverableHeadline: trainee.discoverableHeadline,
      discoverableBio: trainee.discoverableBio,
      certificates: certificates.map((c: (typeof certificates)[number]) => ({
        id: c.id,
        courseTitle: c.course.title,
        revoked: c.revokedAt !== null,
        included: discoverableIds.has(c.id),
      })),
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // A revoked certificate can never be marked discoverable — showing
    // one to a browsing employer would be actively misleading about a
    // credential that no longer stands, not just an edge case to skip
    // silently. Ownership is checked the same way — only certificates
    // that genuinely belong to this trainee can ever be included,
    // regardless of what IDs were submitted.
    const validCertificates = await prisma.certificate.findMany({
      where: { id: { in: parsed.data.certificateIds }, traineeId: session.userId, revokedAt: null },
      select: { id: true },
    });
    const validIds = validCertificates.map((c: { id: string }) => c.id);

    await prisma.$transaction(async (tx: any) => {
      await tx.trainee.update({
        where: { id: session.userId },
        data: {
          publiclyDiscoverable: parsed.data.publiclyDiscoverable,
          discoverableHeadline: parsed.data.discoverableHeadline,
          discoverableBio: parsed.data.discoverableBio,
        },
      });
      // Replace the whole set — delete then recreate, rather than
      // trying to diff — this is a small, trainee-owned list, not a
      // large collection where a diff would matter for performance.
      await tx.discoverableCertificate.deleteMany({ where: { traineeId: session.userId } });
      if (validIds.length > 0) {
        await tx.discoverableCertificate.createMany({
          data: validIds.map((certificateId: string) => ({ traineeId: session.userId, certificateId })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  });
}
