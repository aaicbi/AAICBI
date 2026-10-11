import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { noticeFor } from "@/lib/guide/visibilityNotice";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "private, no-store" };

async function load(session: { userId: string; role: string }) {
  if (session.role === "TRAINEE") {
    const t = await prisma.trainee.findUnique({ where: { id: session.userId }, select: { profileVisibility: true, profileNoticeAt: true } });
    return t ? noticeFor("trainee", { visibility: t.profileVisibility, noticeAt: t.profileNoticeAt }) : null;
  }
  if (session.role === "EMPLOYER") {
    const e = await prisma.employer.findUnique({ where: { id: session.userId }, select: { profileVisibility: true, profileNoticeAt: true } });
    return e ? noticeFor("employer", { visibility: e.profileVisibility, noticeAt: e.profileNoticeAt }) : null;
  }
  return null;
}

/** GET — whether Loop should tell this member or employer that their profile is public (once), and what to say. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await getSession();
    const n = session ? await load(session) : null;
    return NextResponse.json(n && n.show ? n : { show: false }, { headers: NO_STORE });
  });
}

/** POST — they have been told: do not show it again. */
export async function POST() {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
    const now = new Date();
    if (session.role === "TRAINEE") await prisma.trainee.updateMany({ where: { id: session.userId, profileNoticeAt: null }, data: { profileNoticeAt: now } });
    else if (session.role === "EMPLOYER") await prisma.employer.updateMany({ where: { id: session.userId, profileNoticeAt: null }, data: { profileNoticeAt: now } });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  });
}
