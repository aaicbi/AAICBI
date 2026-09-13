import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedMaterial } from "@/lib/courseOwnership";
import { safeUrl, isAllowedVideoUrl } from "@/lib/materialUrl";
import { notifyDownloadersOfMaterialChange } from "@/lib/notifications/materialChange";
import { deleteLessonMaterialBestEffort } from "@/lib/lessonMaterial";

const UpdateMaterialSchema = z.object({
  type: z.enum(["PDF", "DOCX", "PPTX", "VIDEO"]).optional(),
  title: z.string().min(2).optional(),
  url: safeUrl.optional(),
  order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const existing = await requireOwnedMaterial(params.id, session.userId);

    const body = await req.json();
    const parsed = UpdateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Validate the VIDEO/YouTube rule against the merged result, not just
    // whatever fields happen to be present in this particular request —
    // otherwise a PUT that only changes `url` could swap a PDF's link for
    // a non-YouTube one that would've been rejected on create, and a PUT
    // that only changes `type` to VIDEO could do the same against an
    // already-stored non-YouTube url.
    const mergedType = parsed.data.type ?? existing.type;
    const mergedUrl = parsed.data.url ?? existing.url;
    if (mergedType === "VIDEO" && !isAllowedVideoUrl(mergedUrl)) {
      return NextResponse.json(
        { error: { fieldErrors: { url: ["Video materials must be a YouTube or Google-hosted link."] } } },
        { status: 400 }
      );
    }

    const updated = await prisma.material.update({ where: { id: params.id }, data: parsed.data });

    // M40 — the actual content-change notification this milestone's
    // own scope requires. Only the URL genuinely represents different
    // content worth telling a trainee about — a title or ordering
    // change doesn't affect what's sitting on their device. See
    // notifyDownloadersOfMaterialChange for the full reasoning
    // (extracted so the file-upload replace route can trigger the
    // identical notification, not just a URL edit).
    if (parsed.data.url && parsed.data.url !== existing.url) {
      await notifyDownloadersOfMaterialChange(params.id, updated.title, existing);
      // Best-effort cleanup: if the material's old URL was a file this
      // app itself uploaded (not an admin-pasted external link), and
      // it's being replaced by a different URL, the old blob is now
      // orphaned. isLessonMaterialBlobUrl guards against ever calling
      // del() on an external link.
      await deleteLessonMaterialBestEffort(existing.url);
    }

    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const existing = await requireOwnedMaterial(params.id, session.userId);
    await prisma.material.delete({ where: { id: params.id } });
    await deleteLessonMaterialBestEffort(existing.url);
    return NextResponse.json({ ok: true });
  });
}
