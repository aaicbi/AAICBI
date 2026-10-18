import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { GrowthError, approveTasterQuestion, courseGrowth, proposeTaster, swapTasterQuestion, tasterView } from "@/lib/growth/growth";
import { appUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

async function describe(courseId: string) {
  const [taster, g] = await Promise.all([tasterView(courseId), courseGrowth(courseId)]);
  return { taster, live: g.live, issues: g.issues, link: taster.slug ? appUrl(`/play/${taster.slug}`) : null };
}

/** GET — the taster questions for a course, for the instructor who approves them. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    return NextResponse.json(await describe(params.id));
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose") }),
  z.object({ action: z.literal("approve"), questionId: z.string().min(1).max(60) }),
  z.object({ action: z.literal("swap"), questionId: z.string().min(1).max(60) }),
]);

/** POST — propose the five taster questions, approve one, or swap one. Whoever manages the course can do this; nothing goes live until all five are approved and a Super Admin switches it on. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      if (b.action === "propose") await proposeTaster(s.userId, params.id);
      else if (b.action === "approve") await approveTasterQuestion(s.userId, params.id, b.questionId);
      else await swapTasterQuestion(s.userId, params.id, b.questionId);
      return NextResponse.json(await describe(params.id));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message, issues: e.issues }, { status: e.status });
      throw e;
    }
  });
}
