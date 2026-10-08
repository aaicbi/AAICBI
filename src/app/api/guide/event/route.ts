import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { bumpStat, countServed, type StatField } from "@/lib/guide/knowledge";
import { whoAmI } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

const FIELD: Record<string, StatField> = { answered: "answered", helpful: "helpful", not_helpful: "notHelpful", navigation: "navigations", tour: "tours" };
const Body = z.object({ type: z.enum(["answered", "helpful", "not_helpful", "navigation", "tour"]), entryId: z.string().max(40).optional() });

/**
 * POST /api/guide/event — public. A bare counter: Loop answered a question,
 * someone found an answer helpful, took a "Take me there" button, or started
 * a guided tour. Counts per day and kind of account; no text and no identity
 * is stored. Quietly ignored when the guide is off or the caller is going too fast.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new NextResponse(null, { status: 204 });
    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } });
    if (settings && !settings.guideEnabled) return new NextResponse(null, { status: 204 });
    const limit = await rateLimit(`guide-event:${clientIp(req)}`, 200, 10 * 60 * 1000);
    if (!limit.allowed) return new NextResponse(null, { status: 204 });
    const role = (await whoAmI()) ?? "visitor";
    await bumpStat(role, FIELD[parsed.data.type]).catch(() => {});
    if (parsed.data.type === "answered" && parsed.data.entryId) await countServed(parsed.data.entryId).catch(() => {});
    return new NextResponse(null, { status: 204 });
  });
}
