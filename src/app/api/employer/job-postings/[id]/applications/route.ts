import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";

/**
 * GET /api/employer/job-postings/[id]/applications — the read side of
 * the same disclosure boundary M33's introduction-view route already
 * established, applied here to the job-board half: contact
 * information is only ever included when the trainee's own
 * `includeContactInfo` choice for THIS specific application was true
 * — never assumed, never inherited from anywhere else.
 *
 * Ownership checked directly — a posting must genuinely belong to
 * this employer, the same discipline every other owned-resource route
 * in this project applies, not trusted from the URL alone.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await requireApprovedEmployer(session.userId);

    const posting = await prisma.jobPosting.findUnique({ where: { id: params.id } });
    if (!posting || posting.employerId !== session.userId) {
      return NextResponse.json({ error: "Posting not found." }, { status: 404 });
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobPostingId: params.id },
      orderBy: { createdAt: "desc" },
      include: {
        trainee: { select: { id: true, name: true, email: true, phone: true } },
        disclosedCertificates: {
          select: { certificate: { select: { code: true, course: { select: { title: true } } } } },
        },
      },
    });

    return NextResponse.json(
      applications.map((a: (typeof applications)[number]) => ({
        id: a.id,
        createdAt: a.createdAt,
        traineeName: a.trainee.name,
        traineeEmail: a.includeContactInfo ? a.trainee.email : null,
        traineePhone: a.includeContactInfo ? a.trainee.phone : null,
        disclosedCertificates: a.disclosedCertificates.map((d: (typeof a.disclosedCertificates)[number]) => ({
          code: d.certificate.code,
          courseTitle: d.certificate.course.title,
        })),
      }))
    );
  });
}
