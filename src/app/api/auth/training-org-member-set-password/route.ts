import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const Schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

/**
 * POST /api/auth/training-org-member-set-password — a teammate sets
 * their password from the emailed invitation. The token is one-time:
 * it is cleared the moment it is used. An unknown, used, expired or
 * disabled-member token all return the same message.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(`org-member-set-password:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
  }
  const member = await prisma.trainingOrganizationMember.findUnique({ where: { setupToken: parsed.data.token } });
  const invalid = () => NextResponse.json({ error: "This link is invalid or has expired. Ask your organization for a new one." }, { status: 400 });
  if (!member || member.disabledAt || !member.setupTokenExpiresAt || member.setupTokenExpiresAt.getTime() < Date.now()) return invalid();

  await prisma.trainingOrganizationMember.update({
    where: { id: member.id },
    data: { passwordHash: await hashPassword(parsed.data.password), setupToken: null, setupTokenExpiresAt: null },
  });
  return NextResponse.json({ ok: true });
}
