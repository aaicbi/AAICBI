import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { requireOwnedMaterial } from "@/lib/courseOwnership";
import { ALLOWED_TYPES, MAX_SIZE_BYTES } from "@/lib/lessonMaterial";

/**
 * POST /api/materials/[id]/upload-token — same direct-to-Blob token
 * flow as the add-material route, for replacing an existing material's
 * file. The material's own `type` is already known server-side, so
 * unlike the add flow this needs no client-supplied type in
 * `clientPayload` — it's read straight off the existing row, which also
 * means a VIDEO material (link-only) can be rejected before ever
 * issuing a token. Once the browser's direct upload finishes, the
 * caller swaps in the new URL via the existing PUT /api/materials/[id]
 * — that route already does the "notify downloaders + best-effort
 * delete the old blob" work for any URL change, so nothing here
 * duplicates it.
 */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
        const existing = await requireOwnedMaterial(params.id, session.userId);

        if (existing.type === "VIDEO") {
          throw new Error("Video materials are link-only — there's no file to upload.");
        }
        const type = existing.type as "PDF" | "DOCX" | "PPTX";

        return {
          allowedContentTypes: ALLOWED_TYPES[type],
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ materialId: params.id, type }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("Material replacement blob upload completed:", blob.url, tokenPayload);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const err = error as Error & { status?: number };
    return NextResponse.json({ error: err.message || "Could not start the upload." }, { status: err.status ?? 400 });
  }
}
