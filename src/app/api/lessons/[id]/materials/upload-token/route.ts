import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedLesson } from "@/lib/courseOwnership";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/lessonMaterial";

/**
 * POST /api/lessons/[id]/materials/upload-token — issues a short-lived
 * Vercel Blob client-upload token; the file itself goes straight from
 * the browser to Blob, never through this (or any) Serverless
 * Function, which is what actually fixes the 4.5MB platform ceiling
 * (see lessonMaterial.ts's own comment for the full story). Once the
 * browser's direct upload finishes, the caller creates the Material
 * row itself via the existing POST /api/lessons/[id]/materials —
 * `onUploadCompleted` below deliberately does no DB work, since that
 * callback is a webhook Vercel calls back to this app and never
 * reaches a localhost dev server, which would make the add-material
 * flow untestable locally if it were load-bearing.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
        await requireOwnedLesson(params.id, session.userId);

        const parsed = clientPayload ? JSON.parse(clientPayload) : {};
        const type = parsed.type as "PDF" | "DOCX" | "PPTX" | undefined;
        if (!type || !ALLOWED_TYPES[type]) {
          throw new Error("type must be one of PDF, DOCX, PPTX.");
        }

        return {
          allowedContentTypes: ALLOWED_TYPES[type],
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ lessonId: params.id, type }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Lesson material blob upload completed:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
