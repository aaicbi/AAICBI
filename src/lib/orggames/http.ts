import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { OrgGamesError } from "@/lib/orggames/orgGames";

/** Runs an organization-games handler, turning its refusals into plain JSON errors. Permission and sign-in errors keep their own status. */
export function orgGamesApi(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  return withApiErrors(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof OrgGamesError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

export const noStore = { "Cache-Control": "no-store" } as const;
