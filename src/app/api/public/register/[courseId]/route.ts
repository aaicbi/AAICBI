import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { RegistrationInput } from "@/lib/crm/registrationCore";
import { RegistrationError, submitRegistration } from "@/lib/crm/registration";

export const dynamic = "force-dynamic";

/** POST — a public course registration. No account. Rate limited, checked on the server, and a repeat for the same course returns the same reference. */
export async function POST(req: Request, { params }: { params: { courseId: string } }) {
  return withApiErrors(async () => {
    const ip = clientIp(req);
    const limit = await rateLimit(`crm-register:${ip}`, 10, 60 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of registrations from one place. Please try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const body = await req.json().catch(() => null);
    const parsed = RegistrationInput.safeParse(body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
      return NextResponse.json({ error: Object.values(fields)[0] ?? "Please check the form and try again.", fields }, { status: 400 });
    }
    try {
      const out = await submitRegistration(params.courseId, parsed.data, { ip, userAgent: req.headers.get("user-agent") });
      return NextResponse.json(out, { status: out.duplicate ? 200 : 201 });
    } catch (e) {
      if (e instanceof RegistrationError) return NextResponse.json({ error: e.message, ...(e.field ? { fields: { [e.field]: e.message } } : {}) }, { status: e.status });
      throw e;
    }
  });
}
