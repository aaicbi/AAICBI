import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";

/**
 * GET /api/employer/discover — M33's actual browsing surface.
 * Deliberately never selects email or phone here — contact
 * information only ever reaches an employer after a specific
 * introduction is genuinely accepted (see the respond route), and the
 * safest way to guarantee that is never fetching it into a response
 * this route could otherwise leak, not just remembering to omit it at
 * render time.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await requireApprovedEmployer(session.userId);

    const trainees = await prisma.trainee.findMany({
      where: { publiclyDiscoverable: true },
      select: {
        id: true,
        name: true,
        discoverableHeadline: true,
        discoverableBio: true,
        discoverableCertificates: {
          select: { certificate: { select: { id: true, code: true, course: { select: { title: true } } } } },
        },
      },
    });

    return NextResponse.json(
      trainees.map((t: (typeof trainees)[number]) => ({
        id: t.id,
        name: t.name,
        headline: t.discoverableHeadline,
        bio: t.discoverableBio,
        certificates: t.discoverableCertificates.map((d: (typeof t.discoverableCertificates)[number]) => ({
          code: d.certificate.code,
          courseTitle: d.certificate.course.title,
        })),
      }))
    );
  });
}
