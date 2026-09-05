import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const ApplySchema = z.object({
  includeContactInfo: z.boolean().default(false),
  certificateIds: z.array(z.string()).default([]),
});

/**
 * POST /api/trainee/job-postings/[id]/apply — the actual application
 * action, with the same "chosen fresh per action, never a static
 * profile" disclosure this project's whole employer-portal roadmap is
 * built around — the same pattern as M33's accept flow, applied here
 * to the job-board half.
 *
 * Re-verifies discoverability and that the posting is still genuinely
 * APPROVED and unexpired here, server-side — never trusted from
 * whatever the browse list happened to show; a posting could have
 * been rejected, expired, or the trainee could have turned
 * discoverability off in the time between loading the list and
 * clicking apply.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { publiclyDiscoverable: true },
    });
    if (!trainee.publiclyDiscoverable) {
      return NextResponse.json(
        { error: "Turn on discoverability in your settings to apply." },
        { status: 403 }
      );
    }

    const posting = await prisma.jobPosting.findUnique({ where: { id: params.id } });
    if (!posting || posting.status !== "APPROVED" || posting.closingDate <= new Date()) {
      return NextResponse.json({ error: "This posting is no longer accepting applications." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Same ownership+revocation check as M32/M33: only certificates
    // that genuinely belong to this trainee and are genuinely still
    // valid can ever be disclosed, regardless of what IDs were
    // submitted.
    const validCertificates = await prisma.certificate.findMany({
      where: { id: { in: parsed.data.certificateIds }, traineeId: session.userId, revokedAt: null },
      select: { id: true },
    });
    const validIds = validCertificates.map((c: { id: string }) => c.id);

    let application;
    try {
      application = await prisma.jobApplication.create({
        data: {
          jobPostingId: params.id,
          traineeId: session.userId,
          includeContactInfo: parsed.data.includeContactInfo,
          disclosedCertificates:
            validIds.length > 0
              ? { create: validIds.map((certificateId: string) => ({ certificateId })) }
              : undefined,
        },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "You've already applied to this posting." }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json(application, { status: 201 });
  });
}
