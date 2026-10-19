import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { MEDIA_RULES, mediaPrefix } from "@/lib/ads/adsCore";

const KINDS = [["image", "IMAGE"], ["video", "VIDEO"], ["logo", "LOGO"]] as const;

/** POST — presigned direct-to-storage upload for an ad's picture, video or logo. Super Admin only; the folder decides the allowed types and size. */
export async function POST(request: Request): Promise<NextResponse> {
  try { await requireRole("SUPER_ADMIN"); } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Not allowed." }, { status: err.status ?? 403 });
  }
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        await requireRole("SUPER_ADMIN");
        const hit = KINDS.find(([k]) => pathname.startsWith(mediaPrefix(k)));
        if (!hit) throw new Error("That upload is not allowed.");
        const rules = MEDIA_RULES[hit[1]];
        const token = await issueSignedToken({ pathname, operations: ["put"], allowedContentTypes: rules.types, maximumSizeInBytes: rules.maxBytes, validUntil: Date.now() + 60 * 60 * 1000 });
        return { token, urlOptions: { allowedContentTypes: rules.types, maximumSizeInBytes: rules.maxBytes, addRandomSuffix: true, allowOverwrite: false } };
      },
      onUploadCompleted: async ({ blob }) => { console.log("Ad upload completed:", blob.url); },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
