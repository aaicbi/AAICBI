import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { GrowthError } from "@/lib/growth/growth";
import { deleteCaption, getCaptions, removeAsset, resetCaptions, saveCaption, setAsset, shareCourses } from "@/lib/growth/share";
import { DEFAULT_CAPTIONS } from "@/lib/growth/shareCore";

export const dynamic = "force-dynamic";

/** GET — the courses with a live link (each with its funnel link and uploaded files) and the captions in use. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const [courses, caps] = await Promise.all([shareCourses(), getCaptions()]);
    return NextResponse.json({ courses, ...caps, defaultCount: DEFAULT_CAPTIONS.length }, { headers: { "Cache-Control": "no-store" } });
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveCaption"), id: z.string().max(60).optional(), label: z.string().max(200), text: z.string().max(2000) }),
  z.object({ action: z.literal("deleteCaption"), id: z.string().min(1).max(60) }),
  z.object({ action: z.literal("resetCaptions") }),
  z.object({ action: z.literal("setAsset"), courseId: z.string().min(1).max(60), kind: z.enum(["video", "pdf"]), url: z.string().max(1000), name: z.string().max(300), size: z.number(), contentType: z.string().max(100) }),
  z.object({ action: z.literal("removeAsset"), courseId: z.string().min(1).max(60), kind: z.enum(["video", "pdf"]) }),
]);

/** POST — edit, add, delete or reset captions; record or remove a video or PDF uploaded for a course. Super Admin only; every change is logged. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      if (b.action === "saveCaption") await saveCaption(s.userId, b);
      else if (b.action === "deleteCaption") await deleteCaption(s.userId, b.id);
      else if (b.action === "resetCaptions") await resetCaptions(s.userId);
      else if (b.action === "setAsset") await setAsset(s.userId, b.courseId, b.kind, b);
      else await removeAsset(s.userId, b.courseId, b.kind);
      const [courses, caps] = await Promise.all([shareCourses(), getCaptions()]);
      return NextResponse.json({ courses, ...caps, defaultCount: DEFAULT_CAPTIONS.length }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
