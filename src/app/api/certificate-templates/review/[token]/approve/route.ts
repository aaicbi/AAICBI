import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/certificate-templates/review/[token]/approve — no login,
 * addressed by the share-link token. Single-use, enforced the same
 * atomic-conditional way issueCertificateForPassedExam's own
 * updateMany race-guard works (src/lib/certificates.ts): the WHERE
 * clause requires approvedAt to still be null, so a double-click or a
 * replayed link can never apply the approval twice — the second call's
 * WHERE simply matches nothing.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  return withApiErrors(async () => {
    const limited = await rateLimit(`certificate-template-approve:${clientIp(req)}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many requests. Please wait a while and try again." }, { status: 429 });
    }

    const token = params.token.toUpperCase();
    const applied = await prisma.certificateTemplate.updateMany({
      where: { reviewToken: token, approvedAt: null },
      data: { approvedAt: new Date() },
    });

    if (applied.count === 0) {
      const existing = await prisma.certificateTemplate.findUnique({ where: { reviewToken: token } });
      if (!existing) {
        return NextResponse.json({ error: "This review link isn't valid." }, { status: 404 });
      }
      return NextResponse.json({ error: "This template has already been approved." }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  });
}
