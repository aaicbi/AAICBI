import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedMaterial } from "@/lib/courseOwnership";
import { safeUrl, isAllowedVideoUrl } from "@/lib/materialUrl";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { materialUpdatedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

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
    // change doesn't affect what's sitting on their device. Every
    // trainee who's ever downloaded this material gets notified again
    // on every genuine change, not just the first — someone who was
    // told about an earlier change they haven't acted on yet still
    // deserves to know about a newer one, rather than that being
    // silently folded into "already notified." Wrapped so a
    // notification failure can never block the update that already
    // succeeded, the same discipline used throughout this project.
    if (parsed.data.url && parsed.data.url !== existing.url) {
      try {
        const downloads = await prisma.materialDownload.findMany({
  where: { materialId: params.id },
  select: {
    id: true,
    trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } },
  },
});
        if (downloads.length > 0) {
          // `existing` already carries lesson.module.course from
          // requireOwnedMaterial's own include — no separate query
          // needed for this.
          const relativeUrl = `/trainee/courses/${existing.lesson.module.courseId}`;
          const courseUrl = appUrl(relativeUrl);
          for (const download of downloads) {
            if (!shouldNotifyTrainee(download.trainee)) continue;
            const content = materialUpdatedEmail({
              traineeName: download.trainee.name,
              materialTitle: updated.title,
              courseTitle: existing.lesson.module.course.title,
              courseUrl,
            });
            await notifyByEmail({
              recipientType: "TRAINEE",
              recipientId: download.trainee.id,
              to: download.trainee.email,
              type: "MATERIAL_UPDATED",
              relatedId: params.id,
              // Same audit sweep as MODULE_UNLOCKED/ASSESSMENT_RESULT.
              url: relativeUrl,
              subject: content.subject,
              html: content.html,
              text: content.text,
            }).catch((e) => console.error(`Failed to send material-updated email to trainee ${download.trainee.id}:`, e));
          }
          await prisma.materialDownload.updateMany({
            where: { materialId: params.id },
            data: { notifiedOfChangeAt: new Date() },
          });
        }
      } catch (e) {
        console.error(`Material-updated notification failed for material ${params.id}:`, e);
      }
    }

    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedMaterial(params.id, session.userId);
    await prisma.material.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
