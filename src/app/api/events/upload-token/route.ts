import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { actorOf } from "@/lib/events/eventsAccess";
import { requireRole } from "@/lib/auth/session";
import { MEDIA_RULES, mediaPrefix } from "@/lib/events/eventsCore";

export const dynamic = "force-dynamic";

const KINDS = [["flyer", "FLYER"], ["image", "IMAGE"], ["video", "VIDEO"]] as const;

async function allowed(): Promise<void> {
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  const a = await actorOf(session);
  const ok = a && (a.kind === "ORGANIZATION" ? a.permissions.has("org_events.media:manage") : a.permissions.has("events.platform:create") || a.permissions.has("events.platform:edit"));
  if (!ok) { const e = new Error("You do not have permission to upload event pictures or videos.") as Error & { status?: number }; e.status = 403; throw e; }
}

/** GET: whether file uploads are set up on this server, so the form can say so instead of failing at the last step. */
export async function GET(): Promise<NextResponse> {
  try { await allowed(); } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Not allowed." }, { status: err.status ?? 403 });
  }
  return NextResponse.json({ available: !!process.env.BLOB_READ_WRITE_TOKEN });
}

/** POST: a presigned direct-to-storage upload for an event flyer, picture or video. The folder decides the allowed types and size. */
export async function POST(request: Request): Promise<NextResponse> {
  try { await allowed(); } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Not allowed." }, { status: err.status ?? 403 });
  }
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const jsonResponse = await handleUploadPresigned({
      body, request,
      getSignedToken: async (pathname) => {
        await allowed();
        const hit = KINDS.find(([k]) => pathname.startsWith(mediaPrefix(k)));
        if (!hit) throw new Error("That upload is not allowed.");
        const rules = MEDIA_RULES[hit[1]];
        const token = await issueSignedToken({ pathname, operations: ["put"], allowedContentTypes: [...rules.types], maximumSizeInBytes: rules.maxBytes, validUntil: Date.now() + 60 * 60 * 1000 });
        return { token, urlOptions: { allowedContentTypes: [...rules.types], maximumSizeInBytes: rules.maxBytes, addRandomSuffix: true, allowOverwrite: false } };
      },
      onUploadCompleted: async ({ blob }) => { console.log("Event upload completed:", blob.url); },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
