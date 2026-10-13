import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { moduleWorkspace } from "@/lib/quest/studio";

/** GET — one module's studio workspace: objectives, question pools, items and assignments. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await moduleWorkspace(params.id));
  });
}
