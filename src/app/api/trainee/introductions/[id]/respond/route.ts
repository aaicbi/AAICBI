import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { introductionResponseEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const RespondSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"]),
  includeContactInfo: z.boolean().optional(),
  certificateIds: z.array(z.string()).optional(),
});

/**
 * POST /api/trainee/introductions/[id]/respond — the real disclosure
 * boundary this entire milestone exists to enforce: contact
 * information only ever reaches an employer here, at the moment a
 * trainee genuinely accepts, never before.
 *
 * Deliberately allows re-responding, not locked to a one-time
 * decision — a trainee changing their mind about something this
 * personal (their own contact information) is a real, expected case,
 * the same reasoning M31's own employer-decide route already applied
 * to a different kind of reversible decision. Declining after having
 * previously accepted clears the stored disclosure — the same
 * certificates and includeContactInfo an employer would see on any
 * future view — even though it can't undo what may have already been
 * seen once; the record reflects the trainee's current, genuine
 * choice, not a stale one they've since withdrawn.
 *
 * Audit finding, closed here: nothing previously told the employer
 * whether their request was accepted or declined — they'd have had
 * no way to know except manually checking back. The notification
 * itself deliberately never includes the trainee's disclosed contact
 * information directly, even when accepted — that's available through
 * the employer's own gated view, which already enforces exactly what
 * was disclosed, not repeated into an email body that's easier to
 * forward or leak than a login-gated page. Wrapped so a notification
 * failure can never block the response that already succeeded.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const introRequest = await prisma.introductionRequest.findUnique({
      where: { id: params.id },
      include: {
        trainee: { select: { name: true } },
        employer: { select: { id: true, email: true, contactName: true } },
      },
    });
    if (!introRequest || introRequest.traineeId !== session.userId) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = RespondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    async function notifyEmployerOfResponse(accepted: boolean) {
      try {
        const content = introductionResponseEmail({
          contactName: introRequest!.employer.contactName,
          traineeName: introRequest!.trainee.name,
          accepted,
          introductionsUrl: appUrl("/employer/introductions"),
        });
        await notifyByEmail({
          recipientType: "EMPLOYER",
          recipientId: introRequest!.employer.id,
          to: introRequest!.employer.email,
          type: "INTRODUCTION_RESPONSE",
          relatedId: params.id,
          // Part 11 — click takes the employer to their introductions
          // page, where the trainee's response is shown.
          url: "/employer/introductions",
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      } catch (e) {
        console.error(`Introduction response notification failed for request ${params.id}:`, e);
      }
    }

    if (parsed.data.action === "DECLINE") {
      await prisma.$transaction(async (tx: any) => {
        await tx.introductionRequest.update({
          where: { id: params.id },
          data: { status: "DECLINED", includeContactInfo: null, respondedAt: new Date() },
        });
        await tx.introductionDisclosedCertificate.deleteMany({ where: { introductionRequestId: params.id } });
      });
      await notifyEmployerOfResponse(false);
      return NextResponse.json({ ok: true });
    }

    // ACCEPT — the exact same ownership+revocation check as M32's
    // discoverability route: only certificates that genuinely belong
    // to this trainee and are genuinely still valid can ever be
    // disclosed, regardless of what IDs were submitted.
    const requestedIds = parsed.data.certificateIds ?? [];
    const validCertificates = await prisma.certificate.findMany({
      where: { id: { in: requestedIds }, traineeId: session.userId, revokedAt: null },
      select: { id: true },
    });
    const validIds = validCertificates.map((c: { id: string }) => c.id);

    await prisma.$transaction(async (tx: any) => {
      await tx.introductionRequest.update({
        where: { id: params.id },
        data: {
          status: "ACCEPTED",
          includeContactInfo: parsed.data.includeContactInfo ?? false,
          respondedAt: new Date(),
        },
      });
      await tx.introductionDisclosedCertificate.deleteMany({ where: { introductionRequestId: params.id } });
      if (validIds.length > 0) {
        await tx.introductionDisclosedCertificate.createMany({
          data: validIds.map((certificateId: string) => ({ introductionRequestId: params.id, certificateId })),
        });
      }
    });
    await notifyEmployerOfResponse(true);

    return NextResponse.json({ ok: true });
  });
}
