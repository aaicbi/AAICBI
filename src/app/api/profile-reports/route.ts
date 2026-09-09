import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const ReportSchema = z.object({
  reportedType: z.enum(["TRAINEE", "EMPLOYER"]),
  reportedId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  details: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * POST /api/profile-reports — any signed-in account (trainee, staff,
 * or employer) can flag a trainee or employer profile for admin
 * review (Phase 3). Requires a real session — not anonymous — the
 * reporterType/reporterId always comes from the session, never the
 * request body, the same "self-scoped, never trust an id from the
 * caller" discipline every other route in this app applies. The
 * reported record's existence is checked directly so a report can
 * never point at a nonexistent id.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole();
    const body = await req.json();
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const exists =
      parsed.data.reportedType === "TRAINEE"
        ? await prisma.trainee.findUnique({ where: { id: parsed.data.reportedId }, select: { id: true } })
        : await prisma.employer.findUnique({ where: { id: parsed.data.reportedId }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "That profile could not be found." }, { status: 404 });
    }

    const reporterType = session.role === "TRAINEE" ? "TRAINEE" : session.role === "EMPLOYER" ? "EMPLOYER" : "STAFF";

    const report = await prisma.profileReport.create({
      data: {
        reporterType,
        reporterId: session.userId,
        reportedType: parsed.data.reportedType,
        reportedId: parsed.data.reportedId,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      },
    });

    return NextResponse.json({ id: report.id }, { status: 201 });
  });
}
