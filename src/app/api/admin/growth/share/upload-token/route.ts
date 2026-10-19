import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { ASSET_RULES, assetPrefix, type AssetKind } from "@/lib/growth/shareCore";

/**
 * POST — the same presigned, direct-to-storage flow the lesson materials use, so a large video never passes through a server function.
 * Super Admin only. The kind (video or PDF) is the folder in the file's path, and decides the allowed types and size.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Checked first, before the storage library looks at the request at all.
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
        const kind = (["video", "pdf"] as AssetKind[]).find((k) => pathname.startsWith(assetPrefix(k)));
        if (!kind) throw new Error("That upload is not allowed.");
        const rules = ASSET_RULES[kind];
        const token = await issueSignedToken({ pathname, operations: ["put"], allowedContentTypes: rules.types, maximumSizeInBytes: rules.maxBytes, validUntil: Date.now() + 60 * 60 * 1000 });
        return { token, urlOptions: { allowedContentTypes: rules.types, maximumSizeInBytes: rules.maxBytes, addRandomSuffix: true, allowOverwrite: false } };
      },
      onUploadCompleted: async ({ blob }) => { console.log("Growth share upload completed:", blob.url); },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
