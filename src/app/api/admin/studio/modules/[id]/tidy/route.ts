import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { TidyError, deleteEmptyObjective, fillAssessmentSide, mergeObjective, renameObjective } from "@/lib/quest/tidy";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("merge"), fromId: z.string().min(1), toId: z.string().min(1) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
  z.object({ action: z.literal("rename"), id: z.string().min(1), text: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("fillAssessment") }),
]);

/** POST: tidy a module's objectives (merge, rename, remove an empty one, fill the assessment side). Needs the question-pools permission. No AI is used. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "QUESTIONS");
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    const b = parsed.data;
    try {
      if (b.action === "merge") return NextResponse.json(await mergeObjective(params.id, b.fromId, b.toId));
      if (b.action === "rename") return NextResponse.json(await renameObjective(params.id, b.id, b.text));
      if (b.action === "delete") return NextResponse.json(await deleteEmptyObjective(params.id, b.id));
      return NextResponse.json(await fillAssessmentSide(params.id));
    } catch (e) {
      if (e instanceof TidyError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
