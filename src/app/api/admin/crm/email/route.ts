import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { EmailError, requireCrmEmail, submitEmail } from "@/lib/crm/email";

export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["send", "test", "draft", "schedule"]),
  registrationId: z.string().min(1).max(60),
  senderId: z.string().min(1).max(60),
  templateId: z.string().max(60).nullish(),
  category: z.enum(["SERVICE", "MARKETING"]),
  subject: z.string().max(400),
  body: z.string().max(60000),
  draftId: z.string().max(60).nullish(),
  scheduledFor: z.string().max(40).nullish(),
  attachments: z.array(z.object({ filename: z.string().max(200), contentBase64: z.string().max(4_400_000) })).max(3).optional(),
});

/** POST — send, test, save as a draft or schedule an email to a registrant. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const { session, access } = await requireCrmEmail("email", "create");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That email was not understood." }, { status: 400 });
    try {
      const out = await submitEmail(access, session.userId, session.email, parsed.data);
      return NextResponse.json(out, { status: out.status === "FAILED" ? 502 : 200 });
    } catch (e) {
      if (e instanceof EmailError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      throw e;
    }
  });
}
