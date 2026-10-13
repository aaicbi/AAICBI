/**
 * Turns files attached in the Command Center chat into something Claude can
 * read: documents become text (parsing/anyDocument.ts), pictures are shown to
 * Claude directly. Only the extracted text is kept with the message, never the
 * file itself.
 */
import { extractDocumentText, detectDocumentKind } from "@/lib/parsing/anyDocument";
import type { TurnAttachment } from "@/lib/loop/engine";

/** Vercel rejects request bodies over about 4.5 MB, so stay under it in total. */
export const MAX_ATTACHMENT_BYTES_TOTAL = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

export class AttachmentError extends Error {}

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.slice(0, 3).toString() === "GIF") return "image/gif";
  return null;
}

export async function processAttachments(files: File[]): Promise<TurnAttachment[]> {
  if (files.length > MAX_ATTACHMENTS) throw new AttachmentError(`Attach at most ${MAX_ATTACHMENTS} files at a time.`);
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_ATTACHMENT_BYTES_TOTAL) {
    throw new AttachmentError("Attachments can be 4 MB in total. For larger files, add them to the module as materials and ask Loop to read the module.");
  }
  const out: TurnAttachment[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = await detectDocumentKind(buffer, file.name, file.type);
    if (kind === "image") {
      const mediaType = sniffImage(buffer) ?? IMAGE_TYPES[file.type];
      if (!mediaType) throw new AttachmentError(`“${file.name}” is a picture type Loop can't read. Use PNG, JPEG, WebP or GIF.`);
      out.push({ name: file.name, kind: "picture", image: { mediaType, base64: buffer.toString("base64") } });
      continue;
    }
    try {
      const doc = await extractDocumentText(buffer, { filename: file.name, mime: file.type });
      out.push({ name: file.name, kind: doc.kind, text: doc.text, truncated: doc.truncated });
    } catch (e) {
      throw new AttachmentError(`“${file.name}”: ${e instanceof Error ? e.message : "could not be read."}`);
    }
  }
  return out;
}
