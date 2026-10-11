import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { validateLogoFile, uploadLogo } from "@/lib/employerLogo";
import { identitiesOf } from "@/lib/posts/posts";
import { signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST (file) — upload one image for a post (JPG, PNG or WEBP, up to 5MB). Only people who can post may upload, and not too many at once. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    if ((await identitiesOf(s.session)).length === 0) return NextResponse.json({ error: "Your account cannot post yet." }, { status: 403 });
    const limit = await rateLimit(`post-media:${s.session.userId}`, 40, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Try again in a little while." }, { status: 429 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const bad = validateLogoFile(file);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const url = await uploadLogo(file, `post-${s.session.userId}`);
    return NextResponse.json({ url });
  });
}
