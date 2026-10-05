import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateCertificateIconFile, uploadCertificateIcon } from "@/lib/certificateIconUpload";

/**
 * GET/POST /api/admin/certificate-icons — the shared, platform-wide
 * icon bank's list + upload. No [id] scoping (unlike
 * certificate-templates): icons aren't owned by one training
 * organization, so SUPER_ADMIN manages one shared pool every
 * template's canvas can draw from.
 */
export async function GET(_req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const icons = await prisma.certificateIcon.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(icons);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const formData = await req.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateCertificateIconFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadCertificateIcon(file, "icon");
    const icon = await prisma.certificateIcon.create({
      data: { name: typeof name === "string" && name.trim() ? name.trim().slice(0, 80) : file.name.slice(0, 80), url },
    });
    return NextResponse.json(icon, { status: 201 });
  });
}
