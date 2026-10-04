import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { safeUrl } from "@/lib/materialUrl";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { newTrainingOrgPendingEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const RegisterSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().optional().or(z.literal("")),
  website: safeUrl.optional().or(z.literal("")),
});

/**
 * POST /api/auth/training-org-register — Training Organizations, Phase
 * 1. Same rate-limited/duplicate-check/hash shape as
 * employer-register, with one deliberate difference: no
 * `createSession()` call. Employer/Investor registration logs the
 * account in immediately (PENDING, bounced to a status page) — this
 * type is explicitly different: login is blocked entirely until a
 * SUPER_ADMIN approves (see training-org-login's own comment), so
 * issuing a session here would just be a session nothing can use yet.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `training-org-register:${clientIp(req)}`;
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

    const existing = await prisma.trainingOrganization.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const org = await prisma.trainingOrganization.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        email: parsed.data.email,
        passwordHash,
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
      },
    });

    const content = newTrainingOrgPendingEmail({
      organizationName: org.name,
      reviewUrl: appUrl("/admin/training-organizations"),
    });
    await notifyAllAdminStaff("NEW_TRAINING_ORG_PENDING", org.id, content, "/admin/training-organizations");

    return NextResponse.json({ id: org.id, name: org.name, approvalState: org.approvalState });
  });
}
