import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";

const AVAILABILITY_TYPES = new Set(["INTERNSHIP", "FREELANCE", "FULL_TIME", "PART_TIME"]);
const EMPLOYMENT_STATUSES = new Set(["STUDENT", "EMPLOYED", "UNEMPLOYED", "SELF_EMPLOYED"]);

/**
 * GET /api/employer/discover — M33's browsing surface, extended in
 * Phase 2 of the universal profile system with optional filters
 * (skill/course/certificate/location/availability/employmentStatus).
 * `publiclyDiscoverable: true` stays the one, unconditional base
 * filter — every query param below only ever narrows that same set
 * further, never widens or bypasses it. Still deliberately never
 * selects email or phone — contact information only ever reaches an
 * employer after a specific introduction is genuinely accepted (see
 * the respond route), and the safest way to guarantee that is never
 * fetching it into a response this route could otherwise leak.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await requireApprovedEmployer(session.userId);

    const params = req.nextUrl.searchParams;
    const skill = params.get("skill")?.trim();
    const courseId = params.get("courseId")?.trim();
    const certificateId = params.get("certificateId")?.trim();
    const location = params.get("location")?.trim();
    const availability = params.get("availability")?.trim();
    const employmentStatus = params.get("employmentStatus")?.trim();

    const where: Record<string, unknown> = { publiclyDiscoverable: true };
    if (location) where.location = { contains: location, mode: "insensitive" };
    if (employmentStatus && EMPLOYMENT_STATUSES.has(employmentStatus)) {
      where.currentEmploymentStatus = employmentStatus;
    }
    if (availability && AVAILABILITY_TYPES.has(availability)) {
      where.availabilityTypes = { some: { type: availability } };
    }
    if (skill) {
      where.skills = { some: { skill: { name: { contains: skill, mode: "insensitive" } } } };
    }
    if (certificateId) {
      where.discoverableCertificates = { some: { certificateId } };
    } else if (courseId) {
      where.discoverableCertificates = { some: { certificate: { courseId } } };
    }

    const trainees = await prisma.trainee.findMany({
      where,
      select: {
        id: true,
        name: true,
        discoverableHeadline: true,
        discoverableBio: true,
        location: true,
        openToWork: true,
        currentEmploymentStatus: true,
        availabilityTypes: { select: { type: true } },
        skills: { select: { skill: { select: { name: true } } } },
        discoverableCertificates: {
          select: {
            certificate: { select: { id: true, code: true, courseId: true, course: { select: { title: true } } } },
          },
        },
      },
    });

    return NextResponse.json(
      trainees.map((t: (typeof trainees)[number]) => ({
        id: t.id,
        name: t.name,
        headline: t.discoverableHeadline,
        bio: t.discoverableBio,
        location: t.location,
        openToWork: t.openToWork,
        employmentStatus: t.currentEmploymentStatus,
        availabilityTypes: t.availabilityTypes.map((a: { type: string }) => a.type),
        skills: t.skills.map((s: { skill: { name: string } }) => s.skill.name),
        certificates: t.discoverableCertificates.map((d: (typeof t.discoverableCertificates)[number]) => ({
          id: d.certificate.id,
          courseId: d.certificate.courseId,
          code: d.certificate.code,
          courseTitle: d.certificate.course.title,
        })),
      }))
    );
  });
}
