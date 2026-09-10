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
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const logs = await prisma.aiCommandLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, question: true, answer: true, createdAt: true, askedBy: { select: { name: true } } },
    });

    return NextResponse.json(
      logs.map((l: { id: string; question: string; answer: string; createdAt: Date; askedBy: { name: string } }) => ({
        id: l.id,
        question: l.question,
        answer: l.answer,
        askedByName: l.askedBy.name,
        createdAt: l.createdAt,
      }))
    );
  });
}
