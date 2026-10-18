import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { availabilityForCourse } from "@/lib/arena/config";
import { tokenRequestFor, realtimeMode } from "@/lib/arena/realtime";

export const dynamic = "force-dynamic";

/**
 * GET — a short-lived real-time token for the signed-in trainee, limited to listening on their own channel and on
 * the arenas of courses they are enrolled in. With no Ably key it answers { mode: "poll" } and pages check for changes
 * on a timer instead. Nothing here is ever sent without a signed-in trainee.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session || session.role !== "TRAINEE") return NextResponse.json({ error: "Sign in to play." }, { status: 401 });
    if (realtimeMode() === "poll") return NextResponse.json({ mode: "poll" });
    const enrolments = await prisma.courseEnrollment.findMany({ where: { traineeId: session.userId, unlockedAt: { not: null }, accessRevokedAt: null }, select: { courseId: true }, take: 50 });
    const open: string[] = [];
    for (const e of enrolments) if ((await availabilityForCourse(e.courseId)).game) open.push(e.courseId);
    const request = await tokenRequestFor({ traineeId: session.userId, courseIds: open, matchIds: [] });
    return NextResponse.json({ mode: "ably", request });
  });
}
