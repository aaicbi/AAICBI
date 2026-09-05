import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { guardCourseDeletable } from "@/lib/deletionGuards";
import { getModuleLockMap } from "@/lib/progress";
import { validateCoursePricing } from "@/lib/coursePricing";
import { hasCourseAccess } from "@/lib/courseAccess";

const fullTree = {
  createdBy: { select: { name: true } },
  modules: {
    orderBy: { order: "asc" as const },
    include: {
      lessons: {
        orderBy: { order: "asc" as const },
        include: { materials: { orderBy: { order: "asc" as const } } },
      },
    },
  },
};

/**
 * GET /api/courses/[id] — one course with its full module → lesson →
 * material tree. Shared by the admin course-builder page and the
 * trainee course-viewer page, with different visibility rules baked in
 * rather than split into two routes, since the shape of the response is
 * identical either way and duplicating it would just be a second place
 * for the two to drift apart:
 *
 *   - Staff (SUPER_ADMIN/ADMIN/INSTRUCTOR): can see their own courses,
 *     published or not — that's what building a course *is*.
 *   - Trainee: can only see the course if it's published. An
 *     unpublished course 404s for a trainee exactly the same way a
 *     nonexistent one would — never reveal that a draft exists.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: fullTree,
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const isStaff = session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR";
    // Whole-project audit finding: SUPER_ADMIN can now view a draft
    // (unpublished) course belonging to another instructor, not just
    // published ones — otherwise a SUPER_ADMIN could see this course
    // in their broadened GET /api/courses list (see createdByFilter)
    // but hit a confusing 404 clicking into it, which would undermine
    // that very fix. PUT/DELETE below are deliberately untouched —
    // this only broadens VIEWING, never editing or deleting someone
    // else's course.
    const isOwner = isStaff && (session.role === "SUPER_ADMIN" || course.createdById === session.userId);

    if (!course.published && !isOwner) {
      // Same 404 whether the course doesn't exist or just isn't visible
      // to this requester — don't confirm a draft course's existence to
      // anyone who shouldn't see it.
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    // Staff always see the full, unlocked tree — that's what building
    // and reviewing a course *is*. M12 locking is a trainee-facing
    // concept only.
    if (isStaff) {
      return NextResponse.json(course);
    }

    // M18 — the actual gate this milestone exists to add. Before this,
    // any authenticated trainee could fetch this route's full
    // module/lesson tree for any published course, completely
    // bypassing enrollment — M12's lock-map redaction below only ever
    // handled which UNLOCKED modules a trainee could see, never
    // whether they should be seeing this course's content at all.
    // Deliberately a hard 403 with no module/lesson content, not a
    // partial "syllabus visible" response — a trainee not yet enrolled
    // never sees the content tree. Basic browsing metadata (title,
    // description, price) travels alongside the 403 though, not
    // withheld — without it, the trainee-facing page would have
    // nothing to show except "not found," with no way to render an
    // actual "here's what this is, here's how to enroll" prompt.
    const enrolled = await hasCourseAccess(session.userId, course.id);
    if (!enrolled) {
      return NextResponse.json(
        {
          error: "You're not enrolled in this course yet.",
          notEnrolled: true,
          course: { id: course.id, title: course.title, description: course.description, isFree: course.isFree, priceKobo: course.priceKobo, billingInterval: course.billingInterval },
        },
        { status: 403 }
      );
    }

    // M12: attach lock/completion status per module, completedByMe per
    // lesson, and redact materials for any module the trainee can't
    // access yet — the module/lesson TITLES stay visible (so a trainee
    // can see the roadmap ahead and what's coming), but the content
    // itself doesn't ship to the client for something they haven't
    // unlocked. This is real redaction, not just a client-side hide:
    // the trainee course page already relies on this response being
    // safe to render directly.
    const lockMap = await getModuleLockMap(course.id, session.userId);
    const completedLessonIds = new Set(
      (
        await prisma.lessonProgress.findMany({
          where: {
            traineeId: session.userId,
            lessonId: {
              in: course.modules.flatMap((m: { lessons: { id: string }[] }) => m.lessons.map((l: { id: string }) => l.id)),
            },
          },
          select: { lessonId: true },
        })
      ).map((p: { lessonId: string }) => p.lessonId)
    );

    const shapedModules = course.modules.map((m: { id: string; description: string | null; lessons: { id: string; materials: unknown[] }[] }) => {
      const status = lockMap[m.id];
      const unlocked = status?.unlocked ?? true; // fail open to "visible" for a module the lock map somehow didn't cover, never fail closed into hiding structure
      return {
        ...m,
        unlocked,
        completed: status?.completed ?? false,
        // M12 audit finding: only `materials` was being redacted for a
        // locked module — `description` (real content a module builder
        // writes, not just a label) was still shipped over the wire
        // and only hidden by the UI choosing not to render it. Same
        // "real redaction, not a client-side hide" standard applied
        // here now — a locked module's description is null on the
        // wire, not just unrendered.
        description: unlocked ? m.description : null,
        lessons: m.lessons.map((l: { id: string; materials: unknown[] }) => ({
          ...l,
          completedByMe: completedLessonIds.has(l.id),
          materials: unlocked ? l.materials : [],
        })),
      };
    });

    // M15 — include the trainee's own certificate for this course, if
    // one has been issued. Only ever their own (scoped by
    // session.userId, same as everything else in this branch) — never
    // exposes whether ANOTHER trainee has one, which would leak who's
    // completed the course to someone with no business knowing that.
    const certificate = await prisma.certificate.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: course.id } },
      select: { code: true, issuedAt: true, revokedAt: true },
    });

    // M20 — same reasoning as certificate above: only ever the
    // trainee's own badges, never a way to see another trainee's.
    const badges = await prisma.badge.findMany({
      where: { traineeId: session.userId, courseId: course.id },
      select: { threshold: true, awardedAt: true },
      orderBy: { threshold: "asc" },
    });

    // M22 — same reasoning as certificate/badges above: only ever
    // tells the trainee a course examination exists once the API has
    // actually confirmed it (generated AND published), never an
    // unconditional link that might land on "not available yet."
    const courseExam = await prisma.exam.findUnique({
      where: { courseId: course.id },
      select: { published: true },
    });

    // Audit finding, closed here: the course examination is the real
    // certificate-issuance gate (M23 moved it specifically from "100%
    // of modules" to "passed the course examination"), but nothing
    // previously stopped a trainee from starting — and potentially
    // passing — it before completing any course content at all. Reuses
    // the exact same `lockMap` already computed above for module
    // redaction, not a second calculation — `completed` is already
    // exactly what this needs per module. Requires at least one real
    // module to exist before ever considering a course "complete" —
    // an empty course being vacuously "done" would be a genuinely
    // dishonest signal, not a real edge case worth allowing through.
    const allModulesComplete =
      course.modules.length > 0 && course.modules.every((m: { id: string }) => lockMap[m.id]?.completed === true);

    return NextResponse.json({
      ...course,
      modules: shapedModules,
      certificate: certificate && !certificate.revokedAt ? certificate : null,
      badges,
      hasPublishedExamination: courseExam?.published ?? false,
      allModulesComplete,
    });
  });
}

const UpdateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  published: z.boolean().optional(),
  // Post-M15 milestone — see validateCoursePricing's own comment.
  isFree: z.boolean().optional(),
  priceKobo: z.number().int().positive().nullable().optional(),
  // M26 — same reasoning as priceKobo above.
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).nullable().optional(),
  // M38 — null (the default, and what's sent to explicitly turn the
  // feature off again) means disabled for this course; a positive
  // integer turns it on. Never defaults to a suggested number here —
  // an admin has to deliberately choose a threshold, the same
  // "opt-in, never a surprise default" discipline as the fields above.
  // Upper-bounded (not just positive) after a real gap was noticed:
  // nothing stopped an obviously-mistyped huge number from being
  // saved silently as a threshold that would functionally never fire.
  // 3650 days (10 years) and 1000 attempts are generous enough that no
  // genuine use case would ever hit them, while still catching a typo.
  inactivityThresholdDays: z.number().int().positive().max(3650).nullable().optional(),
  failedAttemptsThreshold: z.number().int().positive().max(1000).nullable().optional(),
  // M45 — null (the default) means "use the platform-wide global
  // default" (PlatformSettings.defaultAiCreditAllowance), the same
  // "default plus optional per-course override" shape already used
  // for the two thresholds above. A real, positive number here
  // overrides that default for this specific course only — a course
  // with genuinely different AI-usage needs (a heavier, more
  // AI-assisted curriculum vs. a lighter one) can be granted a
  // different allowance without changing the platform-wide default
  // every other course still relies on.
  aiCreditAllowanceOverride: z.number().int().min(0).max(1_000_000).nullable().optional(),
  // M41 — admin-configurable per course, matching the roadmap's own
  // explicit scope.
  qaScope: z.enum(["OPEN", "COHORT_SCOPED"]).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course || course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Post-M15 milestone — merged with the course's EXISTING state
    // (not just the incoming partial body) before validating, so an
    // admin adjusting only the price doesn't need to resend `isFree`
    // every time, while a genuinely inconsistent resulting state —
    // e.g. setting a price on a course that's currently free, without
    // also marking it paid in the same request — still gets caught.
    const resultingIsFree = parsed.data.isFree ?? course.isFree;
    const resultingPriceKobo = parsed.data.priceKobo !== undefined ? parsed.data.priceKobo : course.priceKobo;
    const resultingBillingInterval =
      parsed.data.billingInterval !== undefined ? parsed.data.billingInterval : course.billingInterval;
    const pricingError = validateCoursePricing(resultingIsFree, resultingPriceKobo, resultingBillingInterval);
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    // M26 — a real gap this closes: if price or interval genuinely
    // changed on a course that already had a Paystack Plan created for
    // it, that Plan is now stale and points at OLD pricing — carrying
    // it forward would silently charge new subscribers the wrong
    // amount. Reset here so the next payment attempt lazily creates a
    // fresh Plan matching the current price/interval, rather than ever
    // reusing one that no longer reflects what's actually being sold.
    const pricingChanged =
      resultingPriceKobo !== course.priceKobo || resultingBillingInterval !== course.billingInterval;
    const dataToSave = pricingChanged ? { ...parsed.data, paystackPlanCode: null } : parsed.data;

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: dataToSave,
      include: fullTree,
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course || course.createdById !== session.userId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    // M11 audit finding — a Course delete cascades through every one
    // of its modules' assessments too; see deletionGuards.ts.
    await guardCourseDeletable(params.id);
    await prisma.course.delete({ where: { id: params.id } }); // cascades to modules/lessons/materials
    return NextResponse.json({ ok: true });
  });
}
