import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { decideReport, endSession, escalate, lift, moderationFeed, orgCtx, restrict, warn } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET: reports, restrictions and the history of moderation decisions (with reasons) for the organization. */
export async function GET() {
  return orgGamesApi(async () => NextResponse.json(await moderationFeed(await orgCtx("org_games.reports:view")), { headers: noStore }));
}

const id = z.string().min(1).max(80);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("warn"), courseId: id, traineeId: id, reason: z.string().max(600) }),
  z.object({ action: z.literal("restrict"), courseId: id, traineeId: id, hours: z.number().int().min(1).max(24 * 90).nullable(), reason: z.string().max(600) }),
  z.object({ action: z.literal("lift"), courseId: id, suspensionId: id, reason: z.string().max(600) }),
  z.object({ action: z.literal("endSession"), courseId: id, matchId: id, reason: z.string().max(600) }),
  z.object({ action: z.literal("removeParticipant"), courseId: id, matchId: id, traineeId: id, reason: z.string().max(600) }),
  z.object({ action: z.literal("decide"), courseId: id, reportId: id, decision: z.enum(["dismiss", "resolve"]), note: z.string().max(600), suspendHours: z.number().int().min(1).max(24 * 90).nullish() }),
  z.object({ action: z.literal("escalate"), courseId: id, traineeId: id.nullish(), matchId: id.nullish(), reason: z.string().max(600) }),
]);

/** POST {action}: warn, restrict or lift a restriction, end a session or remove a participant, decide a report, escalate to AAICBI. Each needs a reason and its own permission. */
export async function POST(req: NextRequest) {
  return orgGamesApi(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    const b = parsed.data;
    // The permission each action needs is checked inside; sign-in and the organization come from the session.
    const ctx = await orgCtx(b.action === "restrict" || b.action === "lift" || b.action === "removeParticipant" ? "org_games.restrictions:manage" : b.action === "endSession" ? "org_games.sessions:moderate" : "org_games.reports:moderate");
    if (b.action === "warn") await warn(ctx, b);
    else if (b.action === "restrict") await restrict(ctx, b);
    else if (b.action === "lift") await lift(ctx, b);
    else if (b.action === "endSession") await endSession(ctx, b);
    else if (b.action === "removeParticipant") await endSession(ctx, { courseId: b.courseId, matchId: b.matchId, reason: b.reason, removeTraineeId: b.traineeId });
    else if (b.action === "decide") await decideReport(ctx, { courseId: b.courseId, reportId: b.reportId, decision: b.decision, note: b.note, suspendHours: b.suspendHours });
    else await escalate(ctx, b);
    return NextResponse.json(await moderationFeed(ctx), { headers: noStore });
  });
}
