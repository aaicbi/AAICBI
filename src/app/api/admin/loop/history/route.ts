import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/loop/history — the Command Center's sidebar. SUPER_ADMIN
 * only, same reasoning as the ask route. Read-only, and shows every
 * Super Admin's questions, not just the caller's own — this is a
 * shared assistant for the whole leadership team, not a private
 * per-user chat history.
 *
 * Explicitly scoped to staff-authored rows (`askedById: { not: null }`)
 * — since Loop for Trainees started writing trainee-authored rows to
 * this same table (askedByTraineeId instead), this sidebar must not
 * start mixing trainee Q&A into the staff view. Each persona reads
 * only its own kind of row.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const logs = await prisma.aiCommandLog.findMany({
      where: { askedById: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, question: true, answer: true, createdAt: true, askedBy: { select: { name: true } } },
    });

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        question: l.question,
        answer: l.answer,
        askedByName: l.askedBy?.name ?? "Unknown",
        createdAt: l.createdAt,
      }))
    );
  });
}
