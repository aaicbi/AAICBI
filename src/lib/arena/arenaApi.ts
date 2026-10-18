import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { ArenaError } from "@/lib/arena/arena";
import { rateLimit } from "@/lib/rateLimit";

/** The signed-in trainee, or an ArenaError the route turns into a 401. The Arena is for enrolled trainees only. */
export async function arenaTrainee(): Promise<string> {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") throw new ArenaError("Sign in to play.", 401);
  return session.userId;
}

/** Throws a friendly 429 when a player is sending too fast. */
export async function limit(key: string, max: number, windowMs: number): Promise<void> {
  const r = await rateLimit(key, max, windowMs);
  if (!r.allowed) throw new ArenaError("Slow down a little and try again.", 429);
}

/** Runs a handler and maps ArenaError (and anything with a status) to JSON. Match state is never cached. */
export async function arenaJson(handler: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await handler(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err instanceof ArenaError || typeof err.status === "number") return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
    throw e;
  }
}
