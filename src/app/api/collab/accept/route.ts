import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { acceptLink } from "@/lib/collab/links";
import { collabFailure } from "../errors";

export const dynamic = "force-dynamic";

/** POST { token } — the signed-in staff member, instructor or organization joins as an editor. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const parsed = z.object({ token: z.string().min(16).max(200) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
    try {
      return NextResponse.json(await acceptLink(session, parsed.data.token));
    } catch (e) {
      return collabFailure(e);
    }
  });
}
