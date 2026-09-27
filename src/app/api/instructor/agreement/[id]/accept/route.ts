import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { instructorAgreementAcceptedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const AcceptSchema = z.object({
  acceptedName: z.string().trim().min(2).max(120),
});

/**
 * POST /api/instructor/agreement/[id]/accept — the digital signature
 * step: only the addressed instructor, and only while PENDING (an
 * already-ACCEPTED agreement is immutable — no re-signing). Records the
 * typed name, timestamp, and requesting IP (same x-forwarded-for
 * extraction already used at /profile/[code] and /certificate/[code])
 * as the signature's metadata, then notifies the sending admin.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("INSTRUCTOR");

    const body = await req.json();
    const parsed = AcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const agreement = await prisma.instructorAgreement.findUnique({ where: { id: params.id } });
    if (!agreement || agreement.instructorId !== session.userId) {
      return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
    }
    if (agreement.status !== "PENDING") {
      return NextResponse.json({ error: "This agreement has already been accepted." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const updated = await prisma.instructorAgreement.update({
      where: { id: agreement.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedName: parsed.data.acceptedName,
        acceptedIp: ip,
      },
    });

    try {
      const instructor = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
      const admin = await prisma.user.findUnique({ where: { id: agreement.sentById }, select: { name: true, email: true } });
      if (admin) {
        const emailContent = instructorAgreementAcceptedEmail(instructor?.name ?? "An instructor", appUrl(`/admin/instructors/${session.userId}`));
        await notifyByEmail({
          recipientType: "STAFF",
          recipientId: agreement.sentById,
          to: admin.email,
          type: "INSTRUCTOR_AGREEMENT_ACCEPTED",
          relatedId: agreement.id,
          url: `/admin/instructors/${session.userId}`,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }
    } catch (e) {
      console.error(`Instructor agreement acceptance notification failed for agreement ${agreement.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}
