import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { orgBlockPost, orgUnblockPost } from "@/lib/posts/posts";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action: "block", reason } | { action: "unblock" } — an organization keeps one of its own trainees' posts out of public view (the trainee is told why and may appeal to the central team), or makes it visible again. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { session, org } = await requireTrainingOrgSession();
    const parsed = z.object({ action: z.enum(["block", "unblock"]), reason: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const me = { userId: session.userId, name: (await prisma.trainingOrganization.findUnique({ where: { id: org.id }, select: { name: true } }))?.name ?? "Organization" };
    try {
      if (parsed.data.action === "block") await orgBlockPost(org.id, params.id, parsed.data.reason, me);
      else await orgUnblockPost(org.id, params.id, me);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}
