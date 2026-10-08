import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgAccess } from "@/lib/trainingOrgStaff";
import { validateCertificateBackgroundFile } from "@/lib/certificateBackground";

/**
 * POST /api/admin/training-organizations/[id]/certificate-backgrounds —
 * stores an uploaded certificate design image and returns its url. It is
 * keyed by organization, not template, so a template that has not been
 * saved yet can still take an upload. The url only becomes part of a
 * design when the editor saves the layout.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    await requireTrainingOrgAccess(params.id, session);

    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const problem = validateCertificateBackgroundFile(file);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const blob = await put(`certificate-template-backgrounds/org-${params.id}-${Date.now()}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  });
}
