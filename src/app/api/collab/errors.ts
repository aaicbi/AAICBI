import { NextResponse } from "next/server";
import { CollabError } from "@/lib/collab/links";

/** Turns a sharing error into a response; anything else is rethrown for the shared error handler. */
export function collabFailure(e: unknown): NextResponse {
  if (e instanceof CollabError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
