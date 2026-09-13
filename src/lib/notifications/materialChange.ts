import { prisma } from "@/lib/prisma";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { materialUpdatedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

type MaterialWithCourse = {
  lesson: { module: { courseId: string; course: { title: string } } };
};

/**
 * M40's content-change notification, extracted out of
 * api/materials/[id]/route.ts's PUT handler so the new file-upload
 * replace route (api/materials/[id]/upload/route.ts) can trigger the
 * exact same trainee notification a URL-edit already does — replacing
 * the uploaded file is exactly as much a "content changed" event as
 * pasting a different link, and trainees who've downloaded this
 * material deserve to hear about either the same way. See the original
 * inline comment (still true here) for why every trainee gets notified
 * on every genuine change, not just the first.
 */
export async function notifyDownloadersOfMaterialChange(
  materialId: string,
  updatedTitle: string,
  existing: MaterialWithCourse
): Promise<void> {
  try {
    const downloads = await prisma.materialDownload.findMany({
      where: { materialId },
      select: {
        id: true,
        trainee: { select: { id: true, name: true, email: true, notificationsEnabled: true } },
      },
    });
    if (downloads.length === 0) return;

    const relativeUrl = `/trainee/courses/${existing.lesson.module.courseId}`;
    const courseUrl = appUrl(relativeUrl);
    for (const download of downloads) {
      if (!shouldNotifyTrainee(download.trainee)) continue;
      const content = materialUpdatedEmail({
        traineeName: download.trainee.name,
        materialTitle: updatedTitle,
        courseTitle: existing.lesson.module.course.title,
        courseUrl,
      });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: download.trainee.id,
        to: download.trainee.email,
        type: "MATERIAL_UPDATED",
        relatedId: materialId,
        url: relativeUrl,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }).catch((e) => console.error(`Failed to send material-updated email to trainee ${download.trainee.id}:`, e));
    }
    await prisma.materialDownload.updateMany({
      where: { materialId },
      data: { notifiedOfChangeAt: new Date() },
    });
  } catch (e) {
    console.error(`Material-updated notification failed for material ${materialId}:`, e);
  }
}
