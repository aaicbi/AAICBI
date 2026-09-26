import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedMaterial } from "@/lib/courseOwnership";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/lessonMaterial";

/**
 * POST /api/materials/[id]/upload-token — same presigned, OIDC-
 * compatible token flow as the add-material route (see its own comment
 * for why this is `handleUploadPresigned`, not `handleUpload`), for
 * replacing an existing material's file. The material's own `type` is
 * already known server-side, so a VIDEO material (link-only) is
 * rejected before ever issuing a token. Once the browser's direct
 * upload finishes, the caller swaps in the new URL via the existing
 * PUT /api/materials/[id] — that route already does the "notify
 * downloaders + best-effort delete the old blob" work for any URL
 * change, so nothing here duplicates it.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadPresignedBody;

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
        const existing = await requireOwnedMaterial(params.id, session.userId);

        if (existing.type === "VIDEO") {
          throw new Error("Video materials are link-only — there's no file to upload.");
        }
        const type = existing.type as "PDF" | "DOCX" | "PPTX";

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ALLOWED_TYPES[type],
          maximumSizeInBytes: MAX_SIZE_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: ALLOWED_TYPES[type],
            maximumSizeInBytes: MAX_SIZE_BYTES,
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Material replacement blob upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
