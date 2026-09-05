import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { safeUrl } from "@/lib/materialUrl";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { newEmployerPendingEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

// Audit finding, closed here: registration originally collected only a
// self-reported company name, contact name, and email — nothing an
// admin could independently verify before approving an account that
// gains visibility into the whole trainee base. Registration number
// and phone are required — the strongest verifiable signal a genuine
// company can provide, versus a name that costs nothing to fabricate.
// Website, LinkedIn, and other social presence stay optional, using
// the exact same `safeUrl` validator already used for material links
// elsewhere in this project — real signal when present, but requiring
// them would reject genuine small employers who simply don't maintain
// all three yet.
const RegisterSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  registrationNumber: z.string().min(1, "Business registration number is required."),
  phone: z.string().min(7, "Enter a valid phone number."),
  website: safeUrl.optional().or(z.literal("")),
  linkedinUrl: safeUrl.optional().or(z.literal("")),
  otherSocialUrl: safeUrl.optional().or(z.literal("")),
});

/**
 * POST /api/auth/employer-register — M31's actual mechanism behind
 * "no open self-signup": anyone can submit this form, but the account
 * lands in a real PENDING state, not immediate access. Approval is
 * the real gate here, not email verification the way trainee
 * registration uses it — the roadmap's own M31 scope names the
 * admin-facing approve/reject action specifically, and a human
 * reviewing a real company name and contact before approving is a
 * stronger, more meaningful check for this account type than a click
 * on an emailed link would be.
 *
 * A session is still created immediately on registration, matching
 * the trainee registration pattern — genuinely useful even while
 * PENDING, so the employer can log back in and see their own status
 * rather than wonder whether the form submission worked at all. Every
 * *real* action (browsing trainees, posting jobs) stays gated behind
 * `approvalState === "APPROVED"` at the routes that actually do those
 * things — M31's own scope is registration and the approval mechanism
 * itself, not those later checks, which belong to M33/M34.
 *
 * Same rate-limit shape as trainee registration — a genuinely public,
 * unauthenticated endpoint anyone could otherwise spam.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `employer-register:${clientIp(req)}`;
    const limited = await rateLimit(limitKey, 10, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a while and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.employer.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const employer = await prisma.employer.create({
      data: {
        companyName: parsed.data.companyName,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        passwordHash,
        registrationNumber: parsed.data.registrationNumber,
        phone: parsed.data.phone,
        website: parsed.data.website || null,
        linkedinUrl: parsed.data.linkedinUrl || null,
        otherSocialUrl: parsed.data.otherSocialUrl || null,
      },
    });

    await createSession({ userId: employer.id, email: employer.email, role: "EMPLOYER" });

    // Stage 6 audit — staff previously had zero proactive notification
    // that a new employer was even waiting for review.
    const content = newEmployerPendingEmail({
      companyName: employer.companyName,
      reviewUrl: appUrl("/admin/employers"),
    });
    await notifyAllAdminStaff("NEW_EMPLOYER_PENDING", employer.id, content, "/admin/employers");

    return NextResponse.json({
      id: employer.id,
      companyName: employer.companyName,
      approvalState: employer.approvalState,
    });
  });
}
