import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/auth/verify-email?token=... — one-time link from the (not yet
 * wired, see register/route.ts) verification email. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
  }

  const trainee = await prisma.trainee.findUnique({ where: { verifyToken: token } });
  if (!trainee) {
    return NextResponse.json({ error: "Invalid or already-used verification link." }, { status: 400 });
  }

  // M9 audit finding #6: tokens previously had no expiry at all — a
  // leaked or forgotten-about verification link would work indefinitely,
  // whenever it was eventually used. Reject an expired one explicitly
  // rather than silently accepting it.
  if (trainee.verifyTokenExpiresAt && trainee.verifyTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "This verification link has expired. Please ask an admin to verify your account, or register again." },
      { status: 400 }
    );
  }

  await prisma.trainee.update({
    where: { id: trainee.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExpiresAt: null },
  });

  return NextResponse.json({ verified: true });
}
