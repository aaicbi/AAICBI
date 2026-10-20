import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { scanPictures, shrinkBatch, type Scan } from "@/lib/pictures/shrink";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const summary = ({ candidates: _c, ...rest }: Scan) => rest;

/** GET — how many stored pictures are big enough to shrink, and how much space they take. Sizes only; nothing is downloaded. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(summary(await scanPictures()), { headers: { "Cache-Control": "no-store" } });
  });
}

/** POST — shrinks the next batch of the largest pictures (a dozen at a time, so it always finishes), and returns what happened and what is left. Super Admin only. */
export async function POST() {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const before = await scanPictures();
    const report = await shrinkBatch(s.userId, before.candidates);
    const after = await scanPictures();
    return NextResponse.json({ report, ...summary(after) }, { headers: { "Cache-Control": "no-store" } });
  });
}
