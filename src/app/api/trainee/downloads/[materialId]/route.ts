import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * DELETE /api/trainee/downloads/[materialId] — "the trainee able to
 * remove a downloaded item themselves," per M40's own scope. Honest
 * about what this actually does, not overstated: this app has no way
 * to reach into a trainee's own device and delete the file they
 * already saved there — a plain file download, not a service-worker
 * cache this app controls. What this genuinely removes is the app's
 * own tracking of "you downloaded this," which is exactly what
 * dropping it from their visible "My Downloads" list and stopping
 * future content-change notifications for it actually requires.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { materialId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const existing = await prisma.materialDownload.findUnique({
      where: { traineeId_materialId: { traineeId: session.userId, materialId: params.materialId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found in your downloads." }, { status: 404 });
    }

    await prisma.materialDownload.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  });
}
