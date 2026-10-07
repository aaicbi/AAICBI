import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { statusAfterConsent } from "@/lib/ecosystem/educationPostCore";

const Body = z.object({ decision: z.enum(["grant", "decline", "withdraw"]) });

/**
 * POST /api/trainee/education-consents/[id] — the featured trainee grants,
 * declines or later withdraws consent. Only the trainee named on the post
 * can answer. Granting publishes at once for a verified organization,
 * otherwise sends the post to SUPER_ADMIN review.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose grant, decline or withdraw." }, { status: 400 });

    const post = await prisma.educationPost.findFirst({
      where: { id: params.id, traineeId: session.userId },
      select: { id: true, status: true, trainingOrganization: { select: { publicProfile: { select: { verified: true } } } } },
    });
    if (!post) return NextResponse.json({ error: "Request not found." }, { status: 404 });

    const { decision } = parsed.data;
    let next;
    if (decision === "withdraw") {
      if (post.status === "REMOVED" || post.status === "DECLINED") {
        return NextResponse.json({ error: "Nothing to withdraw." }, { status: 409 });
      }
      next = "DECLINED" as const;
    } else {
      if (post.status !== "AWAITING_CONSENT") {
        return NextResponse.json({ error: "This request has already been answered." }, { status: 409 });
      }
      next = statusAfterConsent(decision === "grant", !!post.trainingOrganization.publicProfile?.verified);
    }
    const updated = await prisma.educationPost.update({
      where: { id: post.id },
      data: { status: next, consentRespondedAt: new Date(), ...(next === "PUBLISHED" && { publishedAt: new Date() }) },
      select: { status: true },
    });
    return NextResponse.json({ status: updated.status });
  });
}
