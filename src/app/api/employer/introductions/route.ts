import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { introductionRequestEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const CreateSchema = z.object({ traineeId: z.string(), message: z.string().max(1000).optional() });

/**
 * GET /api/employer/introductions — the read side of the same
 * disclosure boundary the respond route enforces on write. Trainee
 * contact information is only ever included in the response when
 * `status === "ACCEPTED"` AND the trainee's own `includeContactInfo`
 * choice was genuinely true — checked here directly, not assumed from
 * status alone, since a trainee can accept an introduction while
 * still choosing not to share contact information, only certificates.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await requireApprovedEmployer(session.userId);

    const requests = await prisma.introductionRequest.findMany({
      where: { employerId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        trainee: { select: { id: true, name: true, email: true, phone: true } },
        disclosedCertificates: {
          select: { certificate: { select: { code: true, course: { select: { title: true } } } } },
        },
      },
    });

    return NextResponse.json(
      requests.map((r: (typeof requests)[number]) => {
        const accepted = r.status === "ACCEPTED";
        const showContact = accepted && r.includeContactInfo === true;
        return {
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
          traineeName: r.trainee.name,
          traineeEmail: showContact ? r.trainee.email : null,
          traineePhone: showContact ? r.trainee.phone : null,
          disclosedCertificates: accepted
            ? r.disclosedCertificates.map((d: (typeof r.disclosedCertificates)[number]) => ({
                code: d.certificate.code,
                courseTitle: d.certificate.course.title,
              }))
            : [],
        };
      })
    );
  });
}

/**
 * POST /api/employer/introductions — the actual "express interest"
 * action. Deliberately re-verifies the trainee is genuinely
 * discoverable server-side, not just trusted from the client — the
 * discover route is what an employer would normally browse through,
 * but nothing stops a request from being crafted directly against an
 * arbitrary trainee ID, and this is the boundary that has to actually
 * enforce the rule, not just the UI that happens to only show
 * legitimate ones.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const employer = await requireApprovedEmployer(session.userId);

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { id: parsed.data.traineeId },
      select: { id: true, name: true, email: true, publiclyDiscoverable: true, notificationsEnabled: true },
    });
    if (!trainee || !trainee.publiclyDiscoverable) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    let request;
    try {
      request = await prisma.introductionRequest.create({
        data: { employerId: session.userId, traineeId: trainee.id, message: parsed.data.message },
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "You've already reached out to this trainee." }, { status: 409 });
      }
      throw e;
    }

    if (shouldNotifyTrainee(trainee)) {
      const content = introductionRequestEmail({
        traineeName: trainee.name,
        companyName: employer.companyName,
        introductionsUrl: appUrl("/trainee/introductions"),
      });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: trainee.id,
        to: trainee.email,
        type: "INTRODUCTION_REQUEST",
        relatedId: request.id,
        // Same audit sweep as MODULE_UNLOCKED/ASSESSMENT_RESULT/
        // QA_REPLY — click takes the trainee to their introductions
        // page, where this request actually shows up.
        url: "/trainee/introductions",
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Introduction-request notification failed for trainee ${trainee.id}:`, e));
    }

    return NextResponse.json(request, { status: 201 });
  });
}
