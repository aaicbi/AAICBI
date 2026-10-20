import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac/guard";
import { withApiErrors } from "@/lib/apiError";
import { selfTest } from "@/lib/arena/realtime";

export const dynamic = "force-dynamic";

/** POST — Super Admin only. Sends a test message through the real-time service and reads it back. */
export async function POST() {
  return withApiErrors(async () => {
    await requirePermission("gaming_studio.settings:configure");
    return NextResponse.json(await selfTest());
  });
}
