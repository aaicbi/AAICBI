import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { PostError } from "@/lib/posts/posts";

/** The signed-in person, or the 401 to send back. */
export async function signedIn(): Promise<{ session: SessionPayload; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  return { session };
}

/** Turns a PostError into its response; anything else is rethrown for the shared error handler. */
export function postFailure(e: unknown): NextResponse {
  if (e instanceof PostError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
