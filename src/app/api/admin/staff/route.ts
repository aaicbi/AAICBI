import { ensureProfileQuietly } from "@/lib/profiles/profiles";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { CUSTOM_KEY, StaffAccessError, checkRoleKey, saveStaffAccess } from "@/lib/rbac/staff";
import { cleanKeys } from "@/lib/rbac/catalogue";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { notifyByEmail } from "@/lib/notifications/log";
import { staffWelcomeEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const CreateStaffSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "INSTRUCTOR"]),
  staffNumber: z.string().trim().max(40).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  /** The role template ("custom" starts empty). Omit it to give the account what its role always allowed. */
  staffRoleKey: z.string().max(60).nullable().optional(),
  grants: z.array(z.string()).max(400).optional(),
  denies: z.array(z.string()).max(400).optional(),
  active: z.boolean().optional(),
});

const ROLE_LABELS: Record<"ADMIN" | "INSTRUCTOR", string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
};

// 48 hours — a real invitation someone may not open right away, not a
// time-sensitive security reset the existing 1-hour password-reset
// window is tuned for.
const SETUP_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;

/**
 * GET/POST /api/admin/staff — the real answer to "can a Super Admin
 * open an account for a staff member and give them a specific role":
 * before this route, the answer was genuinely no, anywhere in this
 * app. SUPER_ADMIN only — deliberately narrower than the
 * SUPER_ADMIN/ADMIN pairing used for employer and job-posting
 * approval elsewhere in this project: granting someone the ability to
 * create *other staff accounts* is a materially different, more
 * consequential capability than approving an external party, and
 * limiting it to the single most trusted role is a deliberate choice,
 * not an oversight.
 *
 * Never accepts "SUPER_ADMIN" as a creatable role — Zod's own enum
 * makes this a hard boundary, not just a UI convention. Granting the
 * highest privilege deserves a deliberate, separate, out-of-band
 * decision (direct database access), not a dropdown option sitting
 * next to Admin and Instructor.
 *
 * A new account gets a genuinely random, unusable initial password —
 * never transmitted anywhere, never known by the Super Admin who
 * created the account — and the same real, working reset-token
 * mechanism already built for "forgot password" is reused to let the
 * new staff member set their own. Reusing that exact mechanism rather
 * than inventing a separate "set initial password" flow means no new
 * page was needed — /admin/reset-password already does exactly this.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requirePermission("staff.accounts:view");
    const staff = await prisma.user.findMany({
      where: { trainingOrgAsStaffUser: { is: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, canReview: true, createdAt: true, active: true, jobTitle: true, staffNumber: true, staffRoleKey: true, permissionGrants: true, permissionDenies: true },
    });
    return NextResponse.json(staff.map(({ permissionGrants, permissionDenies, ...s }) => ({ ...s, configured: !!s.staffRoleKey || permissionGrants.length > 0 || permissionDenies.length > 0 })));
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("staff.accounts:create");

    const body = await req.json();
    const parsed = CreateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    // A genuinely random, unguessable value — this hash is never
    // meant to authenticate anyone; the account is only usable once
    // the new staff member sets their own password via the emailed
    // link below.
    const unusedPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
    const setupToken = randomBytes(24).toString("hex");

    const staffMember = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        jobTitle: parsed.data.jobTitle || null,
        staffNumber: parsed.data.staffNumber || null,
        active: parsed.data.active ?? true,
        passwordHash: unusedPasswordHash,
        resetToken: setupToken,
        resetTokenExpiresAt: new Date(Date.now() + SETUP_TOKEN_LIFETIME_MS),
      },
    });
    await ensureProfileQuietly("STAFF", staffMember.id);
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "STAFF_CREATED", resourceType: "staff", resourceId: staffMember.id, after: { role: parsed.data.role } });
    // A permission set chosen on the form is saved straight away. An account created with nothing chosen keeps what its role always allowed.
    const chosen = parsed.data.staffRoleKey !== undefined || (parsed.data.grants?.length ?? 0) > 0 || (parsed.data.denies?.length ?? 0) > 0;
    if (chosen) {
      try {
        await checkRoleKey(parsed.data.staffRoleKey ?? CUSTOM_KEY);
        await saveStaffAccess({ id: session.userId, role: session.role, permissions: new Set() }, staffMember.id, { staffRoleKey: parsed.data.staffRoleKey ?? CUSTOM_KEY, grants: cleanKeys(parsed.data.grants), denies: cleanKeys(parsed.data.denies) });
      } catch (e) {
        if (e instanceof StaffAccessError) return NextResponse.json({ error: `The account was created, but its permissions were not saved: ${e.message}`, id: staffMember.id }, { status: e.status });
        throw e;
      }
    }

    const setupUrl = appUrl(`/admin/reset-password?token=${setupToken}`);
    const content = staffWelcomeEmail(staffMember.name, ROLE_LABELS[parsed.data.role], setupUrl);
    await notifyByEmail({
      recipientType: "STAFF",
      recipientId: staffMember.id,
      to: staffMember.email,
      type: "STAFF_ACCOUNT_CREATED",
      // Deliberately no url here, unlike this sweep's other fixes —
      // setupUrl above carries a sensitive, one-time password-setup
      // token. Putting a token-bearing link in an in-app notification
      // is a real risk (it could sit in the bell past the token's
      // expiry, or be exposed anywhere notification URLs are logged),
      // and by the time this notification could ever actually be seen
      // in-app, the staff member is already logged in — meaning they
      // already used the email link and the setup step is done. The
      // in-app copy is a historical record at that point, not an
      // action, so it doesn't need one.
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    return NextResponse.json(
      { id: staffMember.id, name: staffMember.name, email: staffMember.email, role: staffMember.role },
      { status: 201 }
    );
  });
}
