/**
 * Loop broadcast messaging — the single source of truth for "who does
 * this criteria mean." Used by both the read-only Loop tool
 * (src/lib/loop/tools.ts's resolveRecipientsTool, so Claude only ever
 * sees a count and a short preview, never the underlying filter or id
 * list) and the deterministic send endpoint (src/app/api/admin/
 * messages/broadcast/route.ts, which re-runs this fresh against the
 * live database rather than trusting any stored id list — see that
 * route's own comment).
 *
 * Real groups only: this app has Trainee, Employer, and staff
 * User.role (SUPER_ADMIN/ADMIN/INSTRUCTOR) — no "Mentor"/"Manager"
 * concepts exist here, and none are invented. "Cohort" (Cohort/
 * EnrollmentRecord — a reporting-only intake roster) and "course"
 * (CourseEnrollment — the real, live paid-access relationship) are two
 * genuinely different groupings a phrase like "Data Analyst trainees"
 * could mean, so both are supported as distinct scopes rather than
 * picking one and guessing.
 */
import { prisma } from "@/lib/prisma";

export type RecipientType = "TRAINEE" | "STAFF" | "EMPLOYER";

export type RecipientFilter =
  | { scope: "INDIVIDUALS"; refs: { type: RecipientType; id: string }[] }
  | { scope: "COURSE"; courseQuery: string }
  | { scope: "COHORT"; cohortQuery: string }
  | { scope: "ROLE"; role: "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" }
  | { scope: "ALL_TRAINEES" }
  | { scope: "ALL_STAFF" }
  | { scope: "ALL_EMPLOYERS" }
  | { scope: "EVERYONE" };

export interface ResolvedRecipient {
  type: RecipientType;
  id: string;
  name: string;
  email: string;
}

export interface ResolveRecipientsResult {
  recipients: ResolvedRecipient[];
  truncated: boolean;
  // 2+ courses/cohorts matched a COURSE/COHORT query's free-text
  // search — the caller (Loop's own reasoning, or a human reviewing
  // the proposal) should ask which one was meant, never guess by
  // picking the first match.
  ambiguousMatches?: string[];
}

// A safety valve against a runaway "everyone," not a real scale claim
// — if a genuine send ever gets meaningfully close to this, that's the
// actual signal a queue becomes worth building, not before.
const MAX_BROADCAST_RECIPIENTS = 5000;

function dedupe(recipients: ResolvedRecipient[]): ResolvedRecipient[] {
  const seen = new Set<string>();
  const out: ResolvedRecipient[] = [];
  for (const r of recipients) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function resolveRecipients(filter: RecipientFilter): Promise<ResolveRecipientsResult> {
  let recipients: ResolvedRecipient[] = [];

  switch (filter.scope) {
    case "INDIVIDUALS": {
      const traineeIds = filter.refs.filter((r) => r.type === "TRAINEE").map((r) => r.id);
      const staffIds = filter.refs.filter((r) => r.type === "STAFF").map((r) => r.id);
      const employerIds = filter.refs.filter((r) => r.type === "EMPLOYER").map((r) => r.id);
      const [trainees, staff, employers] = await Promise.all([
        traineeIds.length ? prisma.trainee.findMany({ where: { id: { in: traineeIds } }, select: { id: true, name: true, email: true } }) : [],
        staffIds.length ? prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true } }) : [],
        employerIds.length
          ? prisma.employer.findMany({ where: { id: { in: employerIds } }, select: { id: true, companyName: true, email: true } })
          : [],
      ]);
      recipients = [
        ...trainees.map((t: { id: string; name: string; email: string }) => ({ type: "TRAINEE" as const, id: t.id, name: t.name, email: t.email })),
        ...staff.map((s: { id: string; name: string; email: string }) => ({ type: "STAFF" as const, id: s.id, name: s.name, email: s.email })),
        ...employers.map((e: { id: string; companyName: string; email: string }) => ({ type: "EMPLOYER" as const, id: e.id, name: e.companyName, email: e.email })),
      ];
      break;
    }

    case "COURSE": {
      const courses = await prisma.course.findMany({
        where: { title: { contains: filter.courseQuery, mode: "insensitive" } },
        select: { id: true, title: true },
      });
      if (courses.length === 0) return { recipients: [], truncated: false };
      if (courses.length > 1) {
        return { recipients: [], truncated: false, ambiguousMatches: courses.map((c: { title: string }) => c.title) };
      }
      const enrollments = await prisma.courseEnrollment.findMany({
        where: { courseId: courses[0].id, accessRevokedAt: null },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
      recipients = enrollments.map((e: { trainee: { id: string; name: string; email: string } }) => ({
        type: "TRAINEE" as const,
        id: e.trainee.id,
        name: e.trainee.name,
        email: e.trainee.email,
      }));
      break;
    }

    case "COHORT": {
      const cohorts = await prisma.cohort.findMany({
        where: { name: { contains: filter.cohortQuery, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      if (cohorts.length === 0) return { recipients: [], truncated: false };
      if (cohorts.length > 1) {
        return { recipients: [], truncated: false, ambiguousMatches: cohorts.map((c: { name: string }) => c.name) };
      }
      const enrollments = await prisma.enrollmentRecord.findMany({
        where: { cohortId: cohorts[0].id },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
      recipients = enrollments.map((e: { trainee: { id: string; name: string; email: string } }) => ({
        type: "TRAINEE" as const,
        id: e.trainee.id,
        name: e.trainee.name,
        email: e.trainee.email,
      }));
      break;
    }

    case "ROLE": {
      const staff = await prisma.user.findMany({ where: { role: filter.role }, select: { id: true, name: true, email: true } });
      recipients = staff.map((s: { id: string; name: string; email: string }) => ({ type: "STAFF" as const, id: s.id, name: s.name, email: s.email }));
      break;
    }

    case "ALL_TRAINEES": {
      const trainees = await prisma.trainee.findMany({ select: { id: true, name: true, email: true } });
      recipients = trainees.map((t: { id: string; name: string; email: string }) => ({ type: "TRAINEE" as const, id: t.id, name: t.name, email: t.email }));
      break;
    }

    case "ALL_STAFF": {
      const staff = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
      recipients = staff.map((s: { id: string; name: string; email: string }) => ({ type: "STAFF" as const, id: s.id, name: s.name, email: s.email }));
      break;
    }

    case "ALL_EMPLOYERS": {
      // Approved only — a still-pending employer hasn't been vetted
      // yet and shouldn't receive platform-wide staff communications
      // framed as if they're a full member. A specific pending
      // employer can still be messaged individually via INDIVIDUALS.
      const employers = await prisma.employer.findMany({
        where: { approvalState: "APPROVED" },
        select: { id: true, companyName: true, email: true },
      });
      recipients = employers.map((e: { id: string; companyName: string; email: string }) => ({
        type: "EMPLOYER" as const,
        id: e.id,
        name: e.companyName,
        email: e.email,
      }));
      break;
    }

    case "EVERYONE": {
      const [trainees, staff, employers] = await Promise.all([
        prisma.trainee.findMany({ select: { id: true, name: true, email: true } }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        prisma.employer.findMany({ where: { approvalState: "APPROVED" }, select: { id: true, companyName: true, email: true } }),
      ]);
      recipients = [
        ...trainees.map((t: { id: string; name: string; email: string }) => ({ type: "TRAINEE" as const, id: t.id, name: t.name, email: t.email })),
        ...staff.map((s: { id: string; name: string; email: string }) => ({ type: "STAFF" as const, id: s.id, name: s.name, email: s.email })),
        ...employers.map((e: { id: string; companyName: string; email: string }) => ({ type: "EMPLOYER" as const, id: e.id, name: e.companyName, email: e.email })),
      ];
      break;
    }
  }

  recipients = dedupe(recipients);
  const truncated = recipients.length > MAX_BROADCAST_RECIPIENTS;
  return { recipients: truncated ? recipients.slice(0, MAX_BROADCAST_RECIPIENTS) : recipients, truncated };
}
