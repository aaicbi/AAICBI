import { NextRequest } from "next/server";
import { arenaJson, arenaTrainee } from "@/lib/arena/arenaApi";
import { ArenaError, isEnrolled } from "@/lib/arena/arena";
import { ladderView } from "@/lib/arena/ladder";
import type { Period } from "@/lib/arena/ladderCore";

export const dynamic = "force-dynamic";

/** GET ?period=week|month|all — the course's champion ladder as this trainee sees it. */
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  return arenaJson(async () => {
    const me = await arenaTrainee();
    if (!(await isEnrolled(me, params.courseId))) throw new ArenaError("The ladder is for trainees enrolled in this course.", 403);
    const p = req.nextUrl.searchParams.get("period");
    const period: Period = p === "month" || p === "all" ? p : "week";
    return ladderView(params.courseId, me, period);
  });
}
