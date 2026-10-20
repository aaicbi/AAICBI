import { NextResponse } from "next/server";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioCan } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { moduleWorkspace } from "@/lib/quest/studio";

/** GET — one module's studio workspace: objectives, question pools, items and assignments. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioCan(session, "gaming_studio.configs:view");
    await requireStudioModule(params.id, session);
    return NextResponse.json(await moduleWorkspace(params.id));
  });
}
