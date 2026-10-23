import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { completeTask, requireCrm } from "@/lib/crm/staff";

export const dynamic = "force-dynamic";

/** POST — mark a follow-up task finished. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { session, access } = await requireCrm("manage");
    return (await completeTask(access, session.userId, params.id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Task not found." }, { status: 404 });
  });
}
