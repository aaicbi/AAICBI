import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { validateAvatarFile, uploadAvatar, deleteAvatarBestEffort } from "@/lib/avatar";
import { setOrganizationPicture } from "@/lib/orgPicture";

export const dynamic = "force-dynamic";

/** POST (file) — set the organization's picture (JPG, PNG or WEBP, up to 5MB). It shows on the public page, profile, search and the feed. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    if (!org.staffUserId) return NextResponse.json({ error: "Your account isn't fully set up yet. Please contact AAICBI." }, { status: 409 });
    const limit = await rateLimit(`org-logo:${org.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many uploads. Try again in a little while." }, { status: 429 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const bad = validateAvatarFile(file);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const url = await uploadAvatar(file, `org-${org.id}`);
    const replaced = await setOrganizationPicture(org.id, org.staffUserId, url);
    await Promise.all(replaced.map((u) => deleteAvatarBestEffort(u)));
    return NextResponse.json({ logoUrl: url });
  });
}

/** DELETE — remove the organization's picture (the page shows its first letter again). */
export async function DELETE() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    if (!org.staffUserId) return NextResponse.json({ error: "Your account isn't fully set up yet. Please contact AAICBI." }, { status: 409 });
    const replaced = await setOrganizationPicture(org.id, org.staffUserId, null);
    await Promise.all(replaced.map((u) => deleteAvatarBestEffort(u)));
    return NextResponse.json({ logoUrl: null });
  });
}
