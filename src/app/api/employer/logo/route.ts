import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { validateLogoFile, uploadLogo, deleteLogoBestEffort } from "@/lib/employerLogo";

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateLogoFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.employer.findUnique({ where: { id: session.userId }, select: { logoUrl: true } });
    const url = await uploadLogo(file, `employer-${session.userId}`);
    const employer = await prisma.employer.update({
      where: { id: session.userId },
      data: { logoUrl: url },
      select: { logoUrl: true },
    });

    if (existing?.logoUrl) {
      await deleteLogoBestEffort(existing.logoUrl);
    }

    return NextResponse.json(employer);
  });
}

export async function DELETE() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const existing = await prisma.employer.findUnique({ where: { id: session.userId }, select: { logoUrl: true } });
    const employer = await prisma.employer.update({
      where: { id: session.userId },
      data: { logoUrl: null },
      select: { logoUrl: true },
    });
    if (existing?.logoUrl) {
      await deleteLogoBestEffort(existing.logoUrl);
    }
    return NextResponse.json(employer);
  });
}
