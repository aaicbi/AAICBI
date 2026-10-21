import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const Schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});
const INVALID = "This reset link is invalid or has expired. Please request a new one.";

/**
 * POST /api/auth/training-org-reset-password — finishes a reset started by
 * training-org-forgot-password. The token belongs either to the organization
 * owner (resetToken) or to a teammate (their setup token). It works once and
 * is cleared as it is used; unknown, used, expired and disabled all answer alike.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limited = await rateLimit(`org-reset-password:${clientIp(req)}`, 10, 15 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    const now = Date.now();

    const owner = await prisma.trainingOrganization.findUnique({ where: { resetToken: parsed.data.token } });
    if (owner) {
      if (!owner.resetTokenExpiresAt || owner.resetTokenExpiresAt.getTime() < now) return NextResponse.json({ error: INVALID }, { status: 400 });
      await prisma.trainingOrganization.update({ where: { id: owner.id }, data: { passwordHash: await hashPassword(parsed.data.password), resetToken: null, resetTokenExpiresAt: null } });
      return NextResponse.json({ ok: true });
    }
    const member = await prisma.trainingOrganizationMember.findUnique({ where: { setupToken: parsed.data.token } });
    if (!member || member.disabledAt || !member.setupTokenExpiresAt || member.setupTokenExpiresAt.getTime() < now) return NextResponse.json({ error: INVALID }, { status: 400 });
    await prisma.trainingOrganizationMember.update({ where: { id: member.id }, data: { passwordHash: await hashPassword(parsed.data.password), setupToken: null, setupTokenExpiresAt: null } });
    return NextResponse.json({ ok: true });
  });
}
