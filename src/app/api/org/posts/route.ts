import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { postsOfOrgTrainees } from "@/lib/posts/posts";

export const dynamic = "force-dynamic";

/** GET — the published posts of this organization's own trainees, with whether each is currently held. */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    if (!org.staffUserId) return NextResponse.json({ posts: [] });
    return NextResponse.json({ posts: await postsOfOrgTrainees(org.id, org.staffUserId) });
  });
}
