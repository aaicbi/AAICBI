import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { reviewPost } from "@/lib/posts/posts";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action: approve|request_changes|reject|suspend|reinstate, note? } — a super admin decides a post. Anything but approving needs a reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = z.object({ action: z.enum(["approve", "request_changes", "reject", "suspend", "reinstate"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    try {
      const post = await reviewPost(params.id, parsed.data.action, parsed.data.note?.trim() || null, { userId: session.userId, name: me?.name ?? "Super admin" });
      return NextResponse.json({ id: post.id, status: post.status });
    } catch (e) {
      return postFailure(e);
    }
  });
}
