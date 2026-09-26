import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedLesson } from "@/lib/courseOwnership";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/lessonMaterial";

/**
 * POST /api/lessons/[id]/materials/upload-token — issues a presigned
 * Vercel Blob upload URL; the file itself goes straight from the
 * browser to Blob, never through this (or any) Serverless Function,
 * which is what actually fixes the 4.5MB platform ceiling (see
 * lessonMaterial.ts's own comment for the full story).
 *
 * Presigned (`handleUploadPresigned`/`issueSignedToken`), not the plain
 * client-token flow (`handleUpload`) — this app authenticates Blob via
 * OIDC (`VERCEL_OIDC_TOKEN`/`BLOB_STORE_ID`), and `handleUpload`'s
 * client-token generation has no OIDC path at all; it hard-requires a
 * static `BLOB_READ_WRITE_TOKEN`, which this project deliberately
 * doesn't set (see .env's own comment on that variable). The presigned
 * flow verifies its completion callback with `BLOB_WEBHOOK_PUBLIC_KEY`
 * instead, which this project already has configured.
 *
 * Once the browser's direct upload finishes, the caller creates the
 * Material row itself via the existing POST /api/lessons/[id]/materials
 * — `onUploadCompleted` below deliberately does no DB work, since that
 * callback is a webhook Vercel calls back to this app and never
 * reaches a localhost dev server, which would make the add-material
 * flow untestable locally if it were load-bearing.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadPresignedBody;

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
        await requireOwnedLesson(params.id, session.userId);

        const parsed = clientPayload ? JSON.parse(clientPayload) : {};
        const type = parsed.type as "PDF" | "DOCX" | "PPTX" | undefined;
        if (!type || !ALLOWED_TYPES[type]) {
          throw new Error("type must be one of PDF, DOCX, PPTX.");
        }

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
        console.log("Lesson material blob upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
