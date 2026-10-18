import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { ArenaError } from "@/lib/arena/arena";
import { endMatch, moderationOverview, removeMatchMessage, resolveReport, voidMatch } from "@/lib/arena/moderation";

export const dynamic = "force-dynamic";

async function guard(courseId: string) {
  const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  await requireOwnedCourse(courseId, s.userId, s.role);
  return s;
}

/** GET: live and recent matches and the reports for one course, for the people who moderate it. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guard(params.id);
    return NextResponse.json(await moderationOverview(params.id));
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("end"), matchId: z.string().min(1) }),
  z.object({ action: z.literal("void"), matchId: z.string().min(1) }),
  z.object({ action: z.literal("removeMessage"), matchId: z.string().min(1), messageId: z.string().min(1) }),
  z.object({ action: z.literal("dismiss"), reportId: z.string().min(1), note: z.string().max(300).nullish() }),
  z.object({ action: z.literal("resolve"), reportId: z.string().min(1), note: z.string().max(300).nullish(), suspendHours: z.number().int().min(1).max(24 * 90).nullish(), voidResult: z.boolean().optional(), endMatchNow: z.boolean().optional() }),
]);

/** POST: end a live match, take a finished one off the ladder, remove a match message, or close a report (optionally suspending the player). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await guard(params.id);
    const parsed = Action.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose what to do." }, { status: 400 });
    const a = parsed.data;
    try {
      if (a.action === "end") await endMatch(params.id, a.matchId, s.userId);
      else if (a.action === "void") await voidMatch(params.id, a.matchId, s.userId);
      else if (a.action === "removeMessage") await removeMatchMessage(params.id, a.matchId, a.messageId, s.userId);
      else if (a.action === "dismiss") await resolveReport(params.id, a.reportId, s.userId, { action: "dismiss", note: a.note });
      else await resolveReport(params.id, a.reportId, s.userId, { action: "resolve", note: a.note, suspendHours: a.suspendHours ?? null, voidResult: a.voidResult, endMatchNow: a.endMatchNow });
    } catch (e) {
      if (e instanceof ArenaError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await moderationOverview(params.id));
  });
}
