import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { guardCourseDeletable } from "@/lib/deletionGuards";
import { getModuleLockMap } from "@/lib/progress";
import { validateCoursePricing } from "@/lib/coursePricing";
import { hasCourseAccess, expireLapsedEnrollmentsForTrainee } from "@/lib/courseAccess";
import { isModuleIndexInFreePreview } from "@/lib/courseAccessCore";
import { isCoursePubliclyVisible } from "@/lib/courseStatus";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { buildMarketingView } from "@/lib/courseMarketing";
import { publisherNames } from "@/lib/courseOrg";
import { safeUrl } from "@/lib/materialUrl";
import { validateCourseSchedule } from "@/lib/courseSchedule";
import { trackEvent } from "@/lib/analytics/track";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const fullTree = {
  createdBy: { select: { name: true } },
  // Training Organizations, Phase 2 — lets the admin course-builder page
  // show which template (if any) is currently assigned, without a
  // second round-trip; see the staff branch below for the full list of
  // templates it could be reassigned to.
  certificateTemplate: { select: { id: true, name: true } },
  modules: {
    orderBy: { order: "asc" as const },
    include: {
      lessons: {
        orderBy: { order: "asc" as const },
        include: { materials: { orderBy: { order: "asc" as const } } },
      },
    },
  },
  // Coming Soon Courses — feeds the "X of Y seats registered" display
  // in buildMarketingView; cheap enough to always include rather than
  // conditionally select it per caller.
  _count: { select: { courseEnrollments: true } },
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
 *   - Trainee: reachable if the course is PUBLISHED or UNLISTED (a
 *     direct link, never a catalog listing — see the comment on
 *     statusReachableByDirectLink below). DRAFT/UNPUBLISHED/ARCHIVED
 *     404 for a trainee exactly the same way a nonexistent course
 *     would — never reveal that one of those exists. Actual course
 *     CONTENT stays enrollment-gated regardless of status, via the
 *     not-enrolled branch a few lines down.
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

    // Unlisted-course direct-link access — an UNLISTED course is
    // excluded from every catalog/browse listing (that filtering
    // happens in the LIST routes, untouched by this), but a trainee
    // with the actual direct link can now reach this DETAIL route the
    // same way they would a published course's — never 404'd purely
    // for being unlisted. This is what makes a paid unlisted course
    // sellable via a direct link at all (see the pay route's own
    // comment): without it, a not-yet-enrolled trainee had no way to
    // even see the course to pay for it, only an admin grant could get
    // them in. The branch below (not enrolled -> marketing view + 403)
    // already existed for published courses and does the real content
    // gating here — this just stops UNLISTED from being turned away
    // before ever reaching it. DRAFT/UNPUBLISHED/ARCHIVED are
    // deliberately NOT included — those stay 404, never revealed via a
    // guessed or leaked link.
    const statusReachableByDirectLink = isCoursePubliclyVisible(course.status) || course.status === "UNLISTED";

    if (!statusReachableByDirectLink && !isOwner) {
      // Same 404 whether the course doesn't exist or just isn't visible
      // to this requester — don't confirm a draft course's existence to
      // anyone who shouldn't see it.
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    // Staff always see the full, unlocked tree — that's what building
    // and reviewing a course *is*. M12 locking is a trainee-facing
    // concept only.
    if (isStaff) {
      // Training Organizations, Phase 2 — the certificate-template
      // picker only ever appears on a course that belongs to a training
      // organization (via its shadow staff createdById, see
      // TrainingOrganization.staffUserId's own schema comment); for
      // every other course this is simply null and the admin page
      // renders nothing extra. Visible to whoever is editing the course
      // — the org's own session, or SUPER_ADMIN reviewing it — not
      // gated further, since seeing which templates exist for an org
      // you can already edit this course for isn't a new exposure.
      const org = await findTrainingOrgByStaffUserId(course.createdById);
      const trainingOrganization = org
        ? {
            id: org.id,
            name: org.name,
            availableCertificateTemplates: await prisma.certificateTemplate.findMany({
              where: { trainingOrganizationId: org.id, approvedAt: { not: null } },
              orderBy: { createdAt: "desc" },
              select: { id: true, name: true },
            }),
          }
        : null;
      return NextResponse.json({ ...course, trainingOrganization });
    }

    // Analytics System Phase 1 — a trainee reaching this point has
    // genuinely viewed this course's detail page, enrolled or not yet;
    // the not-yet-enrolled case is exactly the "interest before
    // conversion" signal the content-performance dashboard cares about,
    // so this fires before the enrollment-gate check below, not after.
    await trackEvent({ recipientType: "TRAINEE", userId: session.userId, type: "COURSE_VIEWED", courseId: course.id });

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
    // Course enrollment/subscription system — this is the exact place
    // hasCourseAccess itself is checked below, so it's the natural
    // touchpoint for the lazy per-trainee expiry sweep too: a trainee
    // whose access lapsed since their last visit sees the honest,
    // revoked state immediately on their very next course-page load,
    // rather than waiting for the dashboard's own sweep or a future
    // cron run.
    await expireLapsedEnrollmentsForTrainee(session.userId);

    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: course.id } },
      select: { source: true, unlockedAt: true, accessRevokedAt: true, completedAt: true, currentPeriodEnd: true },
    });

    const isExpired = !!existingEnrollment?.accessRevokedAt;
    const enrolled = await hasCourseAccess(session.userId, course.id);

    // Free preview modules — a PREVIEW-source row isn't "enrolled" by
    // hasCourseAccess's own (unchanged) definition, but it isn't
    // "no access at all" either. Distinct from `enrolled`: this trainee
    // still gets the real module tree below, just with a payment-based
    // lock layered on top past the preview boundary, instead of the
    // marketing-only 403 every other not-yet-enrolled trainee gets.
    const previewing = !enrolled && !isExpired && existingEnrollment?.source === "PREVIEW";

    if (!enrolled && !previewing) {
      return NextResponse.json(
        {
          error: isExpired ? "Your access to this course has expired." : "You're not enrolled in this course yet.",
          notEnrolled: !isExpired,
          expired: isExpired,
          enrollmentStatus: isExpired ? "EXPIRED" : existingEnrollment ? (!existingEnrollment.unlockedAt ? "AWAITING_UNLOCK" : "NOT_ENROLLED") : "NOT_ENROLLED",
          // Course catalogue upgrade — the full pre-enrollment marketing
          // view (outline titles, curriculum, flyer, etc.), the same
          // shape-builder the staff preview route and the public
          // catalogue detail route both use, so all three surfaces can
          // never quietly drift apart on what a prospective trainee sees.
          course: buildMarketingView(course, (await publisherNames([{ id: course.id, createdById: course.createdById }])).get(course.id) ?? null),
          // Free preview modules — lets the trainee page offer "Start
          // Free Preview" alongside Pay/Enroll, only when genuinely
          // configured on a paid course and not already tried (a
          // revoked preview enrollment doesn't get offered again).
          previewAvailable: !isExpired && !course.isFree && !!course.freePreviewModuleCount && !existingEnrollment,
          previewModuleCount: course.freePreviewModuleCount ?? null,
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

    // Free preview modules — only relevant while `previewing` (a
    // fully-enrolled/paid trainee's `enrolled` is already true and this
    // is never consulted for them). Same shared, pure, unit-tested rank
    // check getModuleAccessLevel (courseAccess.ts) uses — course.modules
    // is already ordered by `order: asc` (see fullTree above), so the
    // array index IS the rank, no second query needed here.
    const shapedModules = course.modules.map(
      (m: { id: string; description: string | null; lessons: { id: string; materials: unknown[] }[] }, index: number) => {
        const status = lockMap[m.id];
        const progressUnlocked = status?.unlocked ?? true; // fail open to "visible" for a module the lock map somehow didn't cover, never fail closed into hiding structure
        const paymentLocked = previewing && !isModuleIndexInFreePreview(index, course.freePreviewModuleCount, course.modules.length);
        const unlocked = progressUnlocked && !paymentLocked;
        return {
          ...m,
          unlocked,
          completed: status?.completed ?? false,
          // Free preview modules — only ever set when payment, not
          // progress, is what's actually blocking this module; the
          // trainee page uses this to show "Pay to continue" instead
          // of "complete the previous module first."
          lockedReason: unlocked ? null : paymentLocked ? "payment" : "progress",
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
      }
    );

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

    // Course enrollment/subscription system — currentPeriodEnd lives on
    // CourseEnrollment, not Course, so it's fetched separately here
    // rather than being part of the `course` row already spread below.
    // `daysRemaining` is computed server-side, deliberately never left
    // for the client to derive from a raw date — a manipulated client
    // clock must never be able to misrepresent how much access is left.
    const myEnrollment = await prisma.courseEnrollment.findUnique({
      where: { traineeId_courseId: { traineeId: session.userId, courseId: course.id } },
      select: { source: true, unlockedAt: true, accessRevokedAt: true, completedAt: true, currentPeriodEnd: true },
    });
    const daysRemaining = myEnrollment?.currentPeriodEnd
      ? Math.ceil((myEnrollment.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const enrollmentStatus = myEnrollment?.completedAt
      ? "COMPLETED"
      : myEnrollment?.accessRevokedAt
        ? "EXPIRED"
        : !myEnrollment?.unlockedAt
          ? "AWAITING_UNLOCK"
          : "ACTIVE";

    return NextResponse.json({
      ...course,
      publisherName: (await publisherNames([{ id: course.id, createdById: course.createdById }])).get(course.id) ?? null,
      modules: shapedModules,
      certificate: certificate && !certificate.revokedAt ? certificate : null,
      badges,
      hasPublishedExamination: courseExam?.published ?? false,
      allModulesComplete,
      currentPeriodEnd: myEnrollment?.currentPeriodEnd ?? null,
      daysRemaining,
      enrollmentStatus,
      enrollmentSource: myEnrollment?.source ?? null,
      isPaid: myEnrollment?.source === "PAID" || !course.isFree,
      // Free preview modules — lets the trainee page show "Pay to
      // continue" messaging referencing the actual boundary without
      // having to re-derive it by counting locked modules itself.
      isPreviewing: previewing,
      freePreviewModuleCount: previewing ? course.freePreviewModuleCount : null,
    });
  });
}

const UpdateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED", "UNLISTED", "ARCHIVED"]).optional(),
  // Post-M15 milestone — see validateCoursePricing's own comment.
  isFree: z.boolean().optional(),
  priceKobo: z.number().int().positive().nullable().optional(),
  // Course discounts — see Course.discountPercent's own schema comment.
  discountPercent: z.number().int().min(1).max(99).nullable().optional(),
  // Free preview modules — see Course.freePreviewModuleCount's own
  // schema comment. Cross-validated against the course's real module
  // count below (merged-with-existing-state, same pattern as pricing).
  freePreviewModuleCount: z.number().int().min(0).max(1000).nullable().optional(),
  // M26 — same reasoning as priceKobo above.
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]).nullable().optional(),
  // Course enrollment/subscription system — same reasoning as
  // priceKobo/billingInterval above.
  accessModel: z.enum(["RECURRING_SUBSCRIPTION", "FIXED_DURATION"]).optional(),
  accessDurationValue: z.number().int().positive().nullable().optional(),
  accessDurationUnit: z.enum(["DAYS", "MONTHS", "LIFETIME"]).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysBeforeExpiry: z.array(z.number().int().positive()).optional(),
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

  // Course catalogue upgrade — marketing/discovery content. All
  // optional, all edited via CourseMarketingSettings on the builder
  // page, same "settled after creation, not part of the create form"
  // pattern as every other settings block on this page.
  category: z.string().trim().max(100).nullable().optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).nullable().optional(),
  durationDisplay: z.string().trim().max(100).nullable().optional(),
  trainingFormat: z.enum(["SELF_PACED", "INSTRUCTOR_LED", "HYBRID"]).nullable().optional(),
  instructorNames: z.string().trim().max(300).nullable().optional(),
  prerequisites: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  targetAudience: z.string().trim().max(1000).nullable().optional(),
  skillsGained: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  learningOutcomes: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  whatToExpect: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  showWhatYoullLearn: z.boolean().optional(),
  showOutline: z.boolean().optional(),
  showWhatToExpect: z.boolean().optional(),
  showRequirements: z.boolean().optional(),
  showAudience: z.boolean().optional(),
  showCurriculumDownload: z.boolean().optional(),
  showFlyer: z.boolean().optional(),

  // WhatsApp group-study link — restricted to the real invite-link
  // domain (not just "any URL") so this field actually does what its
  // name says, the same discipline as isAllowedVideoUrl for VIDEO
  // materials. null clears it (removes the trainee-facing button).
  whatsappGroupUrl: safeUrl
    .refine((url) => new URL(url).hostname === "chat.whatsapp.com", {
      message: "Enter a real WhatsApp group invite link (starts with https://chat.whatsapp.com/...).",
    })
    .nullable()
    .optional(),

  // Coming Soon Courses — schedule/registration fields. All optional,
  // edited via CourseScheduleSettings on the builder page, same
  // "settled after creation, not part of the create form" pattern as
  // every other settings block on this page.
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  locationType: z.enum(["PHYSICAL", "ONLINE", "HYBRID"]).nullable().optional(),
  venue: z.string().trim().max(300).nullable().optional(),
  capacity: z.number().int().positive().max(100_000).nullable().optional(),
  lifecyclePhaseOverride: z
    .enum(["COMING_SOON", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "STARTED", "COMPLETED"])
    .nullable()
    .optional(),

  // Training Organizations, Phase 2 — replaces Phase 1's retired
  // /api/org/courses/[id] PATCH (see that route's own former comment):
  // the org admin (or SUPER_ADMIN reviewing the course) picks which of
  // the organization's own approved templates applies here, from the
  // real course editor now instead of a separate bespoke page. null
  // clears it back to AAICBI's own default certificate.
  certificateTemplateId: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    // Course catalogue upgrade — folded into the shared requireOwnedCourse
    // helper (courseOwnership.ts) instead of the inline check this route
    // used to hand-roll; same "not found" wording either way, so no
    // observable behavior change, just one fewer duplicated check.
    const course = await requireOwnedCourse(params.id, session.userId, session.role);

    const body = await req.json();
    const parsed = UpdateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Training Organizations, Phase 2 — a non-null template id must
    // belong to the same organization that owns this course (via its
    // shadow staff createdById) and already be approved. Same
    // non-oracle 404 either way Phase 1's retired PATCH route used —
    // never confirms a template id exists but belongs to someone else.
    if (parsed.data.certificateTemplateId) {
      const org = await findTrainingOrgByStaffUserId(course.createdById);
      const template = org
        ? await prisma.certificateTemplate.findUnique({ where: { id: parsed.data.certificateTemplateId } })
        : null;
      if (!template || template.trainingOrganizationId !== org!.id || !template.approvedAt) {
        return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
      }
    }

    // Post-M15 milestone — merged with the course's EXISTING state
    // (not just the incoming partial body) before validating, so an
    // admin adjusting only the price doesn't need to resend `isFree`
    // every time, while a genuinely inconsistent resulting state —
    // e.g. setting a price on a course that's currently free, without
    // also marking it paid in the same request — still gets caught.
    const resultingIsFree = parsed.data.isFree ?? course.isFree;
    const resultingPriceKobo = parsed.data.priceKobo !== undefined ? parsed.data.priceKobo : course.priceKobo;
    const resultingDiscountPercent =
      parsed.data.discountPercent !== undefined ? parsed.data.discountPercent : course.discountPercent;
    const resultingBillingInterval =
      parsed.data.billingInterval !== undefined ? parsed.data.billingInterval : course.billingInterval;
    const resultingAccessModel = parsed.data.accessModel ?? course.accessModel;
    const resultingAccessDurationValue =
      parsed.data.accessDurationValue !== undefined ? parsed.data.accessDurationValue : course.accessDurationValue;
    const resultingAccessDurationUnit =
      parsed.data.accessDurationUnit !== undefined ? parsed.data.accessDurationUnit : course.accessDurationUnit;
    const resultingReminderEnabled = parsed.data.reminderEnabled ?? course.reminderEnabled;
    const resultingFreePreviewModuleCount =
      parsed.data.freePreviewModuleCount !== undefined ? parsed.data.freePreviewModuleCount : course.freePreviewModuleCount;
    // Free preview modules — a course can never be configured so every
    // module is free preview (that would just be a paid course nobody
    // ever pays for). Only queried when actually relevant — every
    // other course update keeps its existing single-query cost.
    if (resultingFreePreviewModuleCount != null) {
      const moduleCount = await prisma.module.count({ where: { courseId: params.id } });
      if (resultingFreePreviewModuleCount >= moduleCount) {
        return NextResponse.json(
          { error: `Free preview modules must be less than the course's total module count (${moduleCount}).` },
          { status: 400 }
        );
      }
    }
    const pricingError = validateCoursePricing(
      resultingIsFree,
      resultingPriceKobo,
      resultingBillingInterval,
      {
        accessModel: resultingAccessModel,
        accessDurationValue: resultingAccessDurationValue,
        accessDurationUnit: resultingAccessDurationUnit,
        reminderEnabled: resultingReminderEnabled,
      },
      resultingDiscountPercent,
      resultingFreePreviewModuleCount
    );
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 });
    }

    // Coming Soon Courses — same merge-with-existing-state-before-
    // validating reasoning as pricing above, so an admin adjusting only
    // one schedule field doesn't need to resend the others.
    const resultingStartDate = parsed.data.startDate !== undefined ? parsed.data.startDate : course.startDate;
    const resultingEndDate = parsed.data.endDate !== undefined ? parsed.data.endDate : course.endDate;
    const resultingRegistrationDeadline =
      parsed.data.registrationDeadline !== undefined ? parsed.data.registrationDeadline : course.registrationDeadline;
    const scheduleError = validateCourseSchedule(resultingStartDate, resultingEndDate, resultingRegistrationDeadline);
    if (scheduleError) {
      return NextResponse.json({ error: scheduleError }, { status: 400 });
    }

    // M26 — a real gap this closes: if price or interval genuinely
    // changed on a course that already had a Paystack Plan created for
    // it, that Plan is now stale and points at OLD pricing — carrying
    // it forward would silently charge new subscribers the wrong
    // amount. Reset here so the next payment attempt lazily creates a
    // fresh Plan matching the current price/interval, rather than ever
    // reusing one that no longer reflects what's actually being sold.
    // Course enrollment/subscription system — accessModel switching
    // (e.g. RECURRING_SUBSCRIPTION to FIXED_DURATION) added to the same
    // check: a stale Plan code left behind after switching away from
    // recurring billing entirely is just as wrong to carry forward.
    const pricingChanged =
      resultingPriceKobo !== course.priceKobo ||
      resultingDiscountPercent !== course.discountPercent ||
      resultingBillingInterval !== course.billingInterval ||
      resultingAccessModel !== course.accessModel;
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
    await requireOwnedCourse(params.id, session.userId, session.role);
    // M11 audit finding — a Course delete cascades through every one
    // of its modules' assessments too; see deletionGuards.ts.
    await guardCourseDeletable(params.id);
    await prisma.course.delete({ where: { id: params.id } }); // cascades to modules/lessons/materials
    return NextResponse.json({ ok: true });
  });
}
