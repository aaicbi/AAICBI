import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { validateLogoFile, uploadLogo } from "@/lib/employerLogo";

export const dynamic = "force-dynamic";

/** POST (file) — upload the cover picture for the organization's public page (JPG, PNG or WEBP, up to 5MB). Returns its address; the form saves it with the rest of the page. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const limit = await rateLimit(`org-cover:${org.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Try again in a little while." }, { status: 429 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const bad = validateLogoFile(file);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    return NextResponse.json({ url: await uploadLogo(file, `org-cover-${org.id}`) });
  });
}
