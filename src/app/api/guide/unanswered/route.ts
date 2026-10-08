import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { recordUnanswered } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

const Body = z.object({ question: z.string().min(1).max(500) });

/**
 * POST /api/guide/unanswered — public. Loop reports a question it could not
 * answer so the team can answer it once for everyone. Rate limited per
 * address (the address itself is never stored), ignored when the guide is
 * switched off, and the text is scrubbed of emails, links and numbers
 * before it is kept.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid question." }, { status: 400 });

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } });
    if (settings && !settings.guideEnabled) return new NextResponse(null, { status: 204 });

    const limit = await rateLimit(`guide-unanswered:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.allowed) return new NextResponse(null, { status: 204 });

    await recordUnanswered(parsed.data.question);
    return new NextResponse(null, { status: 204 });
  });
}
