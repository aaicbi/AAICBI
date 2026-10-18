import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { selfTest } from "@/lib/arena/realtime";

export const dynamic = "force-dynamic";

/** POST — Super Admin only. Sends a test message through the real-time service and reads it back. */
export async function POST() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await selfTest());
  });
}
