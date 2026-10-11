import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { followersOf } from "@/lib/posts/interactions";
import { profileByHandle } from "@/lib/profiles/profiles";
import { loadProfileView } from "@/lib/profiles/view";

export const dynamic = "force-dynamic";

/** GET ?handle=&cursor= — who follows a profile. The count is public; the list is for signed-in people only, and shows only followers whose own profile the viewer may see. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to see who follows." }, { status: 401 });
    const profile = await profileByHandle(req.nextUrl.searchParams.get("handle") ?? "");
    if (!profile || !(await loadProfileView(profile, session))) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    return NextResponse.json(await followersOf(profile.id, session, req.nextUrl.searchParams.get("cursor")));
  });
}
