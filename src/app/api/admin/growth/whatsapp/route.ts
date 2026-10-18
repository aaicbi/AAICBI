import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { WhatsAppAdminError, clearCredentials, generateVerifyToken, saveCredentials, setWhatsAppEnabled, testWhatsApp, whatsappStatus } from "@/lib/growth/whatsappAdmin";

export const dynamic = "force-dynamic";

/** GET — whether WhatsApp is on and which credentials are saved (the end of each secret only). Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await whatsappStatus(), { headers: { "Cache-Control": "no-store" } });
  });
}

const text = z.string().max(700).optional();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), accessToken: text, phoneNumberId: text, appSecret: text, verifyToken: text, templateLang: text }),
  z.object({ action: z.literal("generateVerifyToken") }),
  z.object({ action: z.literal("enable"), enabled: z.boolean() }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("test") }),
]);

/** POST — save pasted credentials, switch WhatsApp on or off, forget the credentials, or test the connection. Super Admin only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      let test: unknown = null;
      if (b.action === "save") await saveCredentials(s.userId, b);
      else if (b.action === "generateVerifyToken") await generateVerifyToken(s.userId);
      else if (b.action === "enable") await setWhatsAppEnabled(s.userId, b.enabled);
      else if (b.action === "clear") await clearCredentials(s.userId);
      else test = await testWhatsApp();
      return NextResponse.json({ status: await whatsappStatus(), test }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof WhatsAppAdminError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}
