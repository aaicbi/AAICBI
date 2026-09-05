import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { draftGoogleTranslations, draftPidginTranslations, isGoogleTranslateLanguage } from "@/lib/translations";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

const DraftRequestSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES).refine((l) => l !== "en", "English never needs translating into itself."),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = DraftRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { language } = parsed.data;
    if (language === "pcm") {
      await draftPidginTranslations();
    } else if (isGoogleTranslateLanguage(language)) {
      await draftGoogleTranslations(language);
    }

    return NextResponse.json({ ok: true });
  });
}
