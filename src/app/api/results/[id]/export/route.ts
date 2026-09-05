import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedExam } from "@/lib/courseOwnership";

// `[id]` here is the exam id. CSV first (§18) — it needs zero
// dependencies and opens in Excel/Sheets natively, which covers the
// common case. Add an .xlsx (SheetJS) or PDF variant alongside this
// route later using the same query if instructors ask for it.
//
// M13 audit finding, same class as GET /api/results (see that route's
// own comment): this had no ownership check either — any instructor
// could download any other instructor's exam results, trainee PII
// included, by guessing an exam id in the URL. Fixed the same way.
//
// Whole-project audit finding: same SUPER_ADMIN carve-out as
// GET /api/results — exporting is a read of the same data that route
// already lets SUPER_ADMIN view, so it would be an inconsistent (and
// confusing) gap to let them see an exam's results on-screen but 404
// them on the CSV of the exact same data.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    if (session.role === "SUPER_ADMIN") {
      const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!exam) return NextResponse.json({ error: "Examination not found." }, { status: 404 });
    } else {
      await requireOwnedExam(params.id, session.userId);
    }

    const attempts = await prisma.attempt.findMany({
      where: { examId: params.id, status: "SUBMITTED" },
      include: { trainee: true, exam: { select: { title: true } } },
      orderBy: { submittedAt: "desc" },
    });

    const header = [
      "Trainee Name",
      "Email",
      "Exam",
      "Attempt",
      "Score",
      "Percentage",
      "Status",
      "Start Time",
      "Submission Time",
    ];
    const rows = attempts.map((a) => [
      a.trainee.name,
      a.trainee.email,
      a.exam.title,
      String(a.attemptNumber),
      `${a.score ?? 0}/${a.totalQuestions ?? 0}`,
      `${Math.round(a.percentage ?? 0)}%`,
      a.passed ? "PASS" : "FAIL",
      a.startedAt.toISOString(),
      a.submittedAt?.toISOString() ?? "",
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="results-${params.id}.csv"`,
      },
    });
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
