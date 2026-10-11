import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { StartupError } from "@/lib/startups/startups";

/** The signed-in member (trainee) acting for a startup. Founders and team members are member accounts. */
export const memberSession = () => requireRole("TRAINEE");

/** Turns a StartupError into its response; anything else is rethrown for the shared error handler. */
export function startupFailure(e: unknown): NextResponse {
  if (e instanceof StartupError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
