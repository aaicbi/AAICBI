import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { bumpStat, recordUnanswered } from "@/lib/guide/knowledge";
import { whoAmI } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().min(1).max(500),
  reason: z.enum(["NO_MATCH", "LOW_CONFIDENCE", "NOT_HELPFUL"]).default("NO_MATCH"),
  confidence: z.number().min(0).max(1).optional(),
  attempted: z.string().max(300).optional(),
  route: z.string().max(300).optional(),
  page: z.string().max(200).optional(),
  context: z.array(z.string().max(300)).max(5).optional(),
});

/**
 * POST /api/guide/unanswered — public. Loop reports a question it could not
 * answer (or answered with low confidence, or that the person said did not
 * help) so the team can answer it once for everyone. The kind of account is
 * read from the session here, never trusted from the browser. Rate limited
 * per address (the address itself is never stored), ignored when the guide
 * is switched off, and the text is scrubbed of emails, links and numbers
 * before it is kept. Nothing reported here ever becomes an answer without a
 * person approving it.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid question." }, { status: 400 });

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } });
    if (settings && !settings.guideEnabled) return new NextResponse(null, { status: 204 });

    const limit = await rateLimit(`guide-unanswered:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!limit.allowed) return new NextResponse(null, { status: 204 });

    const role = (await whoAmI()) ?? "visitor";
    const d = parsed.data;
    const kept = await recordUnanswered({ ...d, role });
    if (kept) await bumpStat(role, d.reason === "NO_MATCH" ? "unanswered" : d.reason === "LOW_CONFIDENCE" ? "lowConfidence" : "notHelpful").catch(() => {});
    return new NextResponse(null, { status: 204 });
  });
}
