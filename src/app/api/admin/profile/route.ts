import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores.")
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  areasOfResponsibility: z.string().trim().max(500).optional().or(z.literal("")),
  // Hard-capped here, not just in the UI — PUBLIC and EMPLOYERS_ONLY
  // are simply not valid values this schema accepts for a staff
  // account, the same "reject it outright, don't just hide the option"
  // discipline /api/admin/staff already applies to blocking SUPER_ADMIN
  // assignment. Never expose sensitive administrative info publicly.
  profileVisibility: z.enum(["PRIVATE", "AUTHENTICATED"]),
});

/**
 * GET/PUT /api/admin/profile — a staff member's own profile fields
 * (Phase 3). "Permission level" is deliberately never accepted here —
 * that's the `role` field, changed only through /api/admin/staff by a
 * SUPER_ADMIN acting on someone ELSE's account, never through a
 * self-edit route. Same reasoning as every other self-edit route in
 * this app: this can only ever touch the caller's own row
 * (session.userId), never an id from the request body or URL.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        username: true,
        bio: true,
        jobTitle: true,
        department: true,
        areasOfResponsibility: true,
        profileVisibility: true,
      },
    });
    return NextResponse.json(user);
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const updated = await prisma.user.update({
        where: { id: session.userId },
        data: {
          username: parsed.data.username || null,
          bio: parsed.data.bio || null,
          jobTitle: parsed.data.jobTitle || null,
          department: parsed.data.department || null,
          areasOfResponsibility: parsed.data.areasOfResponsibility || null,
          profileVisibility: parsed.data.profileVisibility,
        },
        select: {
          username: true,
          bio: true,
          jobTitle: true,
          department: true,
          areasOfResponsibility: true,
          profileVisibility: true,
        },
      });
      return NextResponse.json(updated);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
      throw e;
    }
  });
}
