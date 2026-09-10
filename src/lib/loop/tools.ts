/**
 * Loop — the AI Command Center's actual "eyes" on the platform.
 *
 * Every function in this file is a plain Prisma READ: `findUnique`,
 * `findMany`, `count`, or `groupBy`. There is no `create`, `update`,
 * `upsert`, or `delete` anywhere in this file, on purpose — that's the
 * real, structural guarantee behind "Loop can only report, never act."
 * The API route that calls these (src/app/api/admin/loop/ask/route.ts)
 * hands Claude exactly this list as its available tools and nothing
 * else; there is no write tool for it to call even if it tried. The
 * system prompt says the same thing in words, but the actual safety
 * boundary is that no such function exists here to be called.
 *
 * Deliberately does NOT reuse `getModuleLockMap` (src/lib/progress.ts)
 * for completion numbers, even though that's what every trainee-facing
 * page already uses — that function has a real, documented side
 * effect (it persists a newly-detected module completion and can
 * trigger a badge/notification send). A reporting tool must never
 * have a write side effect purely from being asked a question, so
 * completion here is read directly off already-persisted
 * `ModuleCompletion` rows instead — an honest count of what's been
 * committed so far, computed with zero writes.
 */
import { prisma } from "@/lib/prisma";
import type { RecipientFilter } from "@/lib/messaging/recipients";
import { resolveModuleByQuery } from "@/lib/loop/moduleLookup";
import { generateBankQuestionBatch } from "@/lib/ai/generateBankQuestions";
import { validateBankQuestionBatch } from "@/lib/ai/validateBankQuestions";

// ---------------------------------------------------------------------
// search_people

export async function searchPeople(query: string) {
  const q = query.trim();
  if (!q) return { trainees: [], employers: [], staff: [] };

  const [trainees, employers, staff] = await Promise.all([
    prisma.trainee.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, email: true },
      take: 5,
    }),
    prisma.employer.findMany({
      where: { OR: [{ companyName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true, companyName: true, approvalState: true },
      take: 5,
    }),
    prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, role: true },
      take: 5,
    }),
  ]);

  return {
    trainees: trainees.map((t: { id: string; name: string; email: string }) => ({ id: t.id, name: t.name, email: t.email })),
    employers: employers.map((e: { id: string; companyName: string; approvalState: string }) => ({
      id: e.id, companyName: e.companyName, approvalState: e.approvalState,
    })),
    staff: staff.map((s: { id: string; name: string; role: string }) => ({ id: s.id, name: s.name, role: s.role })),
  };
}

// ---------------------------------------------------------------------
// get_trainee_report

export async function getTraineeReport(traineeId: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true },
  });
  if (!trainee) return { error: "No trainee found with that id." };

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { traineeId },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { enrolledAt: "desc" },
  });

  const enrollmentDetails = await Promise.all(
    enrollments.map(
      async (e: {
        course: { id: string; title: string };
        source: string;
        enrolledAt: Date;
        currentPeriodEnd: Date | null;
        accessRevokedAt: Date | null;
        unlockedAt: Date | null;
        completedAt: Date | null;
      }) => {
        const [totalModules, completedModules] = await Promise.all([
          prisma.module.count({ where: { courseId: e.course.id } }),
          prisma.moduleCompletion.count({ where: { traineeId, module: { courseId: e.course.id } } }),
        ]);
        return {
          courseTitle: e.course.title,
          source: e.source,
          enrolledAt: e.enrolledAt,
          status: e.completedAt ? "completed" : e.accessRevokedAt ? "expired_or_revoked" : e.unlockedAt ? "active" : "awaiting_unlock",
          currentPeriodEnd: e.currentPeriodEnd,
          totalModules,
          completedModules,
        };
      }
    )
  );

  const certificates = await prisma.certificate.findMany({
    where: { traineeId, revokedAt: null },
    include: { course: { select: { title: true } } },
  });

  const recentPayments = await prisma.payment.findMany({
    where: { traineeId },
    orderBy: { initiatedAt: "desc" },
    take: 5,
    include: { course: { select: { title: true } } },
  });

  return {
    name: trainee.name,
    email: trainee.email,
    accountCreatedAt: trainee.createdAt,
    lastLoginAt: trainee.lastLoginAt,
    enrollments: enrollmentDetails,
    certificatesEarned: certificates.map((c: { code: string; issuedAt: Date; course: { title: string } }) => ({
      courseTitle: c.course.title, code: c.code, issuedAt: c.issuedAt,
    })),
    recentPayments: recentPayments.map(
      (p: { amountKobo: number; status: string; method: string | null; confirmedAt: Date | null; course: { title: string } }) => ({
        courseTitle: p.course.title, amountNaira: p.amountKobo / 100, status: p.status, method: p.method, confirmedAt: p.confirmedAt,
      })
    ),
  };
}

// ---------------------------------------------------------------------
// get_employer_report

export async function getEmployerReport(employerId: string) {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true, companyName: true, approvalState: true, createdAt: true, approvedAt: true },
  });
  if (!employer) return { error: "No employer found with that id." };

  const [postingsByStatus, introsByStatus] = await Promise.all([
    prisma.jobPosting.groupBy({ by: ["status"], where: { employerId }, _count: { _all: true } }),
    prisma.introductionRequest.groupBy({ by: ["status"], where: { employerId }, _count: { _all: true } }),
  ]);

  return {
    companyName: employer.companyName,
    approvalState: employer.approvalState,
    accountCreatedAt: employer.createdAt,
    approvedAt: employer.approvedAt,
    jobPostingsByStatus: Object.fromEntries(postingsByStatus.map((r: { status: string; _count: { _all: number } }) => [r.status, r._count._all])),
    introductionRequestsByStatus: Object.fromEntries(introsByStatus.map((r: { status: string; _count: { _all: number } }) => [r.status, r._count._all])),
  };
}

// ---------------------------------------------------------------------
// list_cohorts

export async function listCohorts() {
  const cohorts = await prisma.cohort.findMany({
    select: {
      id: true, name: true, startDate: true, endDate: true,
      course: { select: { title: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return cohorts.map((c: { id: string; name: string; startDate: Date | null; endDate: Date | null; course: { title: string }; _count: { enrollments: number } }) => ({
    id: c.id, name: c.name, courseTitle: c.course.title, enrolledCount: c._count.enrollments, startDate: c.startDate, endDate: c.endDate,
  }));
}

// ---------------------------------------------------------------------
// get_cohort_report

const AT_RISK_IDLE_DAYS = 14;

export async function getCohortReport(cohortId: string) {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      course: { select: { id: true, title: true } },
      enrollments: { include: { trainee: { select: { id: true, name: true } } }, orderBy: { enrolledAt: "asc" } },
    },
  });
  if (!cohort) return { error: "No cohort found with that id." };

  const totalModules = await prisma.module.count({ where: { courseId: cohort.course.id } });
  const now = Date.now();

  const roster = await Promise.all(
    cohort.enrollments.map(async (e: { trainee: { id: string; name: string }; enrolledAt: Date }) => {
      const completedModules = await prisma.moduleCompletion.count({
        where: { traineeId: e.trainee.id, module: { courseId: cohort.course.id } },
      });
      const daysSinceEnrolled = (now - e.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
      const atRisk = daysSinceEnrolled >= AT_RISK_IDLE_DAYS && completedModules === 0;
      return { traineeId: e.trainee.id, traineeName: e.trainee.name, completedModules, atRisk };
    })
  );

  const enrolledCount = roster.length;
  const avgCompletionPct =
    enrolledCount === 0 || totalModules === 0
      ? 0
      : Math.round((roster.reduce((sum: number, r: { completedModules: number }) => sum + r.completedModules, 0) / (enrolledCount * totalModules)) * 100);
  const atRiskCount = roster.filter((r: { atRisk: boolean }) => r.atRisk).length;
  const fullyCompletedCount = totalModules > 0 ? roster.filter((r: { completedModules: number }) => r.completedModules === totalModules).length : 0;

  return {
    cohortName: cohort.name,
    courseTitle: cohort.course.title,
    startDate: cohort.startDate,
    endDate: cohort.endDate,
    enrolledCount,
    totalModulesInCourse: totalModules,
    averageCompletionPct: avgCompletionPct,
    fullyCompletedCount,
    atRiskCount,
    atRiskTrainees: roster.filter((r: { atRisk: boolean }) => r.atRisk).map((r: { traineeName: string }) => r.traineeName),
  };
}

// ---------------------------------------------------------------------
// get_staff_report

export async function getStaffReport(staffId: string) {
  const staff = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, role: true, createdAt: true, lastLoginAt: true },
  });
  if (!staff) return { error: "No staff member found with that id." };

  const [coursesCreated, examsCreated, employersApproved, jobPostingsReviewed, qaModerationActions, accessExtensionsGranted] = await Promise.all([
    prisma.course.count({ where: { createdById: staffId } }),
    prisma.exam.count({ where: { createdById: staffId } }),
    prisma.employer.count({ where: { approvedById: staffId } }),
    prisma.jobPosting.count({ where: { reviewedById: staffId } }),
    prisma.qaModerationAction.count({ where: { issuedById: staffId } }),
    prisma.accessExtension.count({ where: { extendedById: staffId } }),
  ]);

  return {
    name: staff.name,
    role: staff.role,
    staffSince: staff.createdAt,
    lastLoginAt: staff.lastLoginAt,
    coursesCreated,
    examsCreated,
    employersApproved,
    jobPostingsReviewed,
    qaModerationActionsIssued: qaModerationActions,
    accessExtensionsGranted,
  };
}

// ---------------------------------------------------------------------
// get_platform_overview

export async function getPlatformOverview() {
  const [
    traineeCount,
    employersByState,
    publishedCourseCount,
    activeEnrollmentCount,
    revenueAgg,
    pendingEmployerCount,
    pendingJobPostingCount,
  ] = await Promise.all([
    prisma.trainee.count(),
    prisma.employer.groupBy({ by: ["approvalState"], _count: { _all: true } }),
    prisma.course.count({ where: { published: true } }),
    prisma.courseEnrollment.count({ where: { accessRevokedAt: null, unlockedAt: { not: null } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amountKobo: true } }),
    prisma.employer.count({ where: { approvalState: "PENDING" } }),
    prisma.jobPosting.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  return {
    totalTrainees: traineeCount,
    employersByApprovalState: Object.fromEntries(employersByState.map((r: { approvalState: string; _count: { _all: number } }) => [r.approvalState, r._count._all])),
    publishedCourseCount,
    activeEnrollmentCount,
    totalRevenueNaira: (revenueAgg._sum.amountKobo ?? 0) / 100,
    pendingEmployerApprovals: pendingEmployerCount,
    pendingJobPostingReviews: pendingJobPostingCount,
  };
}

// ---------------------------------------------------------------------
// resolve_recipients — a read-only lookup (still just a set of
// `findMany` calls under the hood, see src/lib/messaging/recipients.ts)
// with one deliberate difference from every tool above: its full
// result is NEVER handed to Claude. src/app/api/admin/loop/ask/route.ts
// intercepts this specific tool name before the generic dispatch below
// ever runs, calls `resolveRecipients` itself, keeps the real
// RecipientFilter + resolved list server-side, and gives Claude back
// only a count and a short name preview — see that route's own comment
// for why (Claude structurally cannot see or alter who a message
// actually goes to). `buildRecipientFilterFromToolInput` is exported
// so the route builds the exact same filter shape this tool's schema
// describes, rather than a second, hand-rolled mapping that could
// drift from it.
export function buildRecipientFilterFromToolInput(input: Record<string, unknown>): RecipientFilter {
  const scope = String(input.scope ?? "");
  switch (scope) {
    case "INDIVIDUALS": {
      const refs = Array.isArray(input.refs) ? (input.refs as { type: string; id: string }[]) : [];
      return { scope: "INDIVIDUALS", refs: refs.map((r) => ({ type: r.type as "TRAINEE" | "STAFF" | "EMPLOYER", id: r.id })) };
    }
    case "COURSE":
      return { scope: "COURSE", courseQuery: String(input.courseQuery ?? "") };
    case "COHORT":
      return { scope: "COHORT", cohortQuery: String(input.cohortQuery ?? "") };
    case "ROLE":
      return { scope: "ROLE", role: String(input.role ?? "INSTRUCTOR") as "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" };
    case "ALL_TRAINEES":
      return { scope: "ALL_TRAINEES" };
    case "ALL_STAFF":
      return { scope: "ALL_STAFF" };
    case "ALL_EMPLOYERS":
      return { scope: "ALL_EMPLOYERS" };
    case "EVERYONE":
    default:
      return { scope: "EVERYONE" };
  }
}

export const RESOLVE_RECIPIENTS_TOOL = {
  name: "resolve_recipients",
  description:
    "Figure out who a messaging instruction refers to — a named individual (use search_people first for their id), a course's currently-enrolled trainees, a cohort's roster, a staff role, or a broad bucket like all trainees / all employers / everyone. Call this before propose_message whenever the admin asks you to notify, message, or announce something to people. Returns only a count and a short name preview, never the underlying list — you don't need the actual list to draft a message.",
  input_schema: {
    type: "object" as const,
    properties: {
      scope: {
        type: "string",
        enum: ["INDIVIDUALS", "COURSE", "COHORT", "ROLE", "ALL_TRAINEES", "ALL_STAFF", "ALL_EMPLOYERS", "EVERYONE"],
        description: "Which kind of recipient group this is.",
      },
      refs: {
        type: "array",
        description: "Only for scope=INDIVIDUALS — the specific people, found via search_people first.",
        items: {
          type: "object",
          properties: { type: { type: "string", enum: ["TRAINEE", "STAFF", "EMPLOYER"] }, id: { type: "string" } },
          required: ["type", "id"],
        },
      },
      courseQuery: { type: "string", description: "Only for scope=COURSE — the course name or a fragment of it." },
      cohortQuery: { type: "string", description: "Only for scope=COHORT — the cohort/intake name or a fragment of it." },
      role: { type: "string", enum: ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"], description: "Only for scope=ROLE." },
      description: {
        type: "string",
        description: "Your own short, human-readable phrasing of this group, e.g. \"All instructors\" or \"Trainees enrolled in Power BI Essentials\" — shown to the admin on the confirmation screen.",
      },
    },
    required: ["scope", "description"],
  },
};

// ---------------------------------------------------------------------
// analyze_module_materials — Loop Question Bank's first step. Real
// work (reading a module's Word-document materials and drafting
// learning objectives from them), so — like resolve_recipients above —
// its full result is NEVER handed to Claude. src/app/api/admin/loop/
// ask/route.ts intercepts this tool name before the generic dispatch
// below ever runs, resolves the module, extracts its materials, drafts
// objectives, keeps the real module id + draft server-side, and gives
// Claude back only a summary: how many materials were analyzed vs.
// skipped (and why), and the draft objectives themselves — which
// Claude may restate/polish in its own propose_learning_objectives
// call, but the module id and material list it's grounded in never
// pass through Claude's hands at all.

export const ANALYZE_MODULE_MATERIALS_TOOL = {
  name: "analyze_module_materials",
  description:
    "Read a module's lesson materials (Word documents only, for now) and draft learning objectives grounded in them. Call this before propose_learning_objectives whenever the admin asks about a module's objectives, or asks you to generate exam questions for a module that doesn't have confirmed objectives yet.",
  input_schema: {
    type: "object" as const,
    properties: {
      moduleQuery: { type: "string", description: "The module's name or a fragment of it, e.g. \"Data Cleaning\" or \"Module 3\"." },
      description: {
        type: "string",
        description: "Your own short phrasing of which module this is, e.g. \"Data Analytics — Module 3: Data Cleaning\" — shown to the admin.",
      },
    },
    required: ["moduleQuery", "description"],
  },
};

// ---------------------------------------------------------------------
// generate_bank_questions — Loop Question Bank's Phase 3. Unlike
// resolve_recipients/analyze_module_materials above, this is NOT
// intercepted before the generic dispatcher: the write it performs is
// a draft write, safe by the same structural guarantee every other
// direct-write AI action in this codebase already relies on (a
// needsReview: true question is invisible to every trainee attempt —
// see src/lib/examEngine.ts's own filter — regardless of Exam.
// published), so there's nothing here that needs protecting from
// Claude the way a message's recipient list or a proposal's module id
// does. Returns Claude only a count summary — never the generated
// question or answer text, which the admin reviews separately in the
// gate 1 screen.
export const GENERATE_BANK_QUESTIONS_TOOL = {
  name: "generate_bank_questions",
  description:
    "Generate new exam questions for a module's question bank, grounded in its lesson materials, testing one specific CONFIRMED learning objective. Only call this once the module has confirmed objectives (use analyze_module_materials + propose_learning_objectives first if it doesn't yet). The generated questions are never visible to trainees until a human reviews them — this only drafts them.",
  input_schema: {
    type: "object" as const,
    properties: {
      moduleQuery: { type: "string", description: "The module's name or a fragment of it." },
      objectiveQuery: { type: "string", description: "The confirmed learning objective's text or a fragment of it." },
      count: { type: "number", description: "How many questions to generate — may be capped lower by the system for one request." },
    },
    required: ["moduleQuery", "objectiveQuery", "count"],
  },
};

async function generateBankQuestionsTool(input: Record<string, unknown>, askedById: string): Promise<unknown> {
  const moduleQuery = typeof input.moduleQuery === "string" ? input.moduleQuery : "";
  const objectiveQuery = typeof input.objectiveQuery === "string" ? input.objectiveQuery : "";
  const requestedCount = typeof input.count === "number" && input.count > 0 ? Math.floor(input.count) : 10;

  const moduleLookup = await resolveModuleByQuery(moduleQuery);
  if (!moduleLookup.module) {
    return { error: "No matching module found.", ambiguousMatches: moduleLookup.ambiguousMatches };
  }

  const objectives = await prisma.moduleLearningObjective.findMany({
    where: { moduleId: moduleLookup.module.id, text: { contains: objectiveQuery, mode: "insensitive" } },
    select: { id: true, text: true },
  });
  if (objectives.length === 0) {
    return {
      error:
        "No confirmed learning objective matched that description for this module. Draft and confirm objectives first (analyze_module_materials + propose_learning_objectives).",
    };
  }
  if (objectives.length > 1) {
    return { error: "More than one confirmed objective matched — be more specific.", ambiguousMatches: objectives.map((o) => o.text) };
  }

  try {
    const result = await generateBankQuestionBatch(moduleLookup.module.id, objectives[0].id, askedById, requestedCount);
    return { module: `${moduleLookup.module.courseTitle} — ${moduleLookup.module.title}`, objective: objectives[0].text, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Question generation failed." };
  }
}

// ---------------------------------------------------------------------
// run_bank_validation — Loop Question Bank's Phase 4. Same reasoning as
// generate_bank_questions above for NOT intercepting this: a clean
// pass auto-promotes straight to APPROVED (the one write in this whole
// feature that happens with no human confirmation at all, per the
// user's own confirmed scoping decision), and everything else only
// ever moves between the invisible (needsReview: true) states pending
// a human's gate 2 review — nothing here needs protecting from Claude
// the way a message's recipient list or a proposal's identifying
// fields do.
export const RUN_BANK_VALIDATION_TOOL = {
  name: "run_bank_validation",
  description:
    "Run independent AI validation on a module's questions that have already passed the first human review and are waiting for validation. A clean pass is auto-approved into the live bank; anything flagged is left for the admin's second review. Returns only a count summary.",
  input_schema: {
    type: "object" as const,
    properties: {
      moduleQuery: { type: "string", description: "The module's name or a fragment of it." },
      count: { type: "number", description: "How many pending questions to validate — may be capped lower by the system for one request." },
    },
    required: ["moduleQuery", "count"],
  },
};

async function runBankValidationTool(input: Record<string, unknown>): Promise<unknown> {
  const moduleQuery = typeof input.moduleQuery === "string" ? input.moduleQuery : "";
  const requestedCount = typeof input.count === "number" && input.count > 0 ? Math.floor(input.count) : 10;

  const moduleLookup = await resolveModuleByQuery(moduleQuery);
  if (!moduleLookup.module) {
    return { error: "No matching module found.", ambiguousMatches: moduleLookup.ambiguousMatches };
  }

  try {
    const result = await validateBankQuestionBatch(moduleLookup.module.id, requestedCount);
    return { module: `${moduleLookup.module.courseTitle} — ${moduleLookup.module.title}`, ...result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Validation failed." };
  }
}

// ---------------------------------------------------------------------
// Tool registry — the Anthropic-facing schemas plus the dispatcher.
// This array IS the complete set of things Loop can ever do; nothing
// outside this list is reachable from a Loop conversation.

export const LOOP_TOOL_SCHEMAS = [
  {
    name: "search_people",
    description: "Search for a trainee, employer, or staff member by name or email. Use this first when the admin names a person or company but you don't have their id yet.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string", description: "Name or email fragment to search for." } },
      required: ["query"],
    },
  },
  {
    name: "get_trainee_report",
    description: "Get a full report on one trainee: enrollments, progress per course, certificates earned, and recent payments.",
    input_schema: {
      type: "object" as const,
      properties: { traineeId: { type: "string", description: "The trainee's id, from search_people." } },
      required: ["traineeId"],
    },
  },
  {
    name: "get_employer_report",
    description: "Get a full report on one employer: approval state, job postings by status, and introduction requests by status.",
    input_schema: {
      type: "object" as const,
      properties: { employerId: { type: "string", description: "The employer's id, from search_people." } },
      required: ["employerId"],
    },
  },
  {
    name: "list_cohorts",
    description: "List all cohorts (course intakes) with their enrollment counts, most recent first. Use this to find a cohort's id before calling get_cohort_report.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_cohort_report",
    description: "Get a full report on one cohort: enrollment count, average completion rate, how many trainees have fully finished, and which trainees are at risk (14+ days enrolled with zero progress).",
    input_schema: {
      type: "object" as const,
      properties: { cohortId: { type: "string", description: "The cohort's id, from list_cohorts." } },
      required: ["cohortId"],
    },
  },
  {
    name: "get_staff_report",
    description: "Get a full activity report on one staff member: courses and exams created, employers approved, job postings reviewed, moderation actions, and access extensions granted.",
    input_schema: {
      type: "object" as const,
      properties: { staffId: { type: "string", description: "The staff member's id, from search_people." } },
      required: ["staffId"],
    },
  },
  {
    name: "get_platform_overview",
    description: "Get platform-wide numbers: total trainees, employers by approval state, published courses, active enrollments, total revenue, and pending approvals. Use this for general questions not about one specific person, employer, or cohort.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  RESOLVE_RECIPIENTS_TOOL,
  ANALYZE_MODULE_MATERIALS_TOOL,
  GENERATE_BANK_QUESTIONS_TOOL,
  RUN_BANK_VALIDATION_TOOL,
];

export async function runLoopTool(name: string, input: Record<string, unknown>, askedById: string): Promise<unknown> {
  switch (name) {
    case "search_people":
      return searchPeople(String(input.query ?? ""));
    case "get_trainee_report":
      return getTraineeReport(String(input.traineeId ?? ""));
    case "get_employer_report":
      return getEmployerReport(String(input.employerId ?? ""));
    case "list_cohorts":
      return listCohorts();
    case "get_cohort_report":
      return getCohortReport(String(input.cohortId ?? ""));
    case "get_staff_report":
      return getStaffReport(String(input.staffId ?? ""));
    case "get_platform_overview":
      return getPlatformOverview();
    case "resolve_recipients":
      // Deliberately NOT handled here — src/app/api/admin/loop/ask/
      // route.ts intercepts this tool name before ever reaching
      // runLoopTool, so it can keep the real RecipientFilter
      // server-side instead of handing it to Claude. Reaching this
      // branch would mean that interception was skipped somewhere,
      // which should never happen — fail loudly rather than silently
      // give Claude a raw recipient list.
      return { error: "resolve_recipients must be handled by the ask route, not the generic dispatcher." };
    case "analyze_module_materials":
      // Same reasoning as resolve_recipients directly above — this is
      // intercepted in the ask route before ever reaching here.
      return { error: "analyze_module_materials must be handled by the ask route, not the generic dispatcher." };
    case "generate_bank_questions":
      return generateBankQuestionsTool(input, askedById);
    case "run_bank_validation":
      return runBankValidationTool(input);
    default:
      // Genuinely unreachable given LOOP_TOOL_SCHEMAS is the exact list
      // handed to the model — Claude cannot name a tool that isn't in
      // it. Kept as an explicit, honest error rather than a silent
      // no-op if that assumption is ever wrong.
      return { error: `Unknown tool: ${name}` };
  }
}
