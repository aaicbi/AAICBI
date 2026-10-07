import { z } from "zod";

export const MAX_COMMENT_LENGTH = 500;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ng|me|ly|gg|xyz)\b)/i;

/** Collapses runs of whitespace and trims; comments are plain text only. */
export function cleanComment(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function containsLink(text: string): boolean {
  return LINK.test(text);
}

export const CommentSchema = z.object({
  body: z
    .string()
    .transform(cleanComment)
    .pipe(z.string().min(2, "Write a little more.").max(MAX_COMMENT_LENGTH, `Keep it under ${MAX_COMMENT_LENGTH} characters.`))
    .refine((v) => !containsLink(v), "Links are not allowed in comments."),
});
