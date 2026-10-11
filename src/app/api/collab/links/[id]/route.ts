import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { revokeLink } from "@/lib/collab/links";
import { collabFailure } from "../../errors";

export const dynamic = "force-dynamic";

/** DELETE — cancels a link (the owner, or whoever made it). People already added stay added. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    try {
      await revokeLink(session, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return collabFailure(e);
    }
  });
}
