import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { appUrl } from "@/lib/appUrl";

// Same alphabet as certificates.ts's own generateCertificateCode —
// excludes 0/O and 1/I/L, characters people reliably mis-transcribe.
// A different prefix ("PROFILE" vs "AAICBI") so a bare code string is
// self-describing about which kind of link it is, since both live
// under this same brand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateProfileCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const b of bytes) raw += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `PROFILE-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

/**
 * GET/POST /api/trainee/public-profile — M37's own "reachable only
 * via a link the trainee generates and shares themselves." GET
 * returns the trainee's current code (or null if never generated);
 * POST generates a fresh one, replacing any existing code — the same
 * "revoke and reissue" a trainee would expect from any shareable-link
 * system, immediately invalidating whatever was shared before.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { publicProfileCode: true },
    });
    return NextResponse.json({
      code: trainee.publicProfileCode,
      url: trainee.publicProfileCode ? appUrl(`/profile/${trainee.publicProfileCode}`) : null,
    });
  });
}

export async function POST() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const code = generateProfileCode();
    await prisma.trainee.update({ where: { id: session.userId }, data: { publicProfileCode: code } });
    return NextResponse.json({ code, url: appUrl(`/profile/${code}`) });
  });
}
