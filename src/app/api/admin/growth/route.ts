import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { appUrl } from "@/lib/appUrl";
import { GrowthError, courseGrowth, setCourseOptIn, setGlobalSwitch, setOrganization, settingRow } from "@/lib/growth/growth";
import { bpsToPercent, percentToBps } from "@/lib/growth/growthCore";
import { revokeSeat, scholarshipOverview, setOwnScholarships, setSeats } from "@/lib/growth/scholarship";

export const dynamic = "force-dynamic";

async function courseCard(c: { id: string; title: string }) {
  const g = await courseGrowth(c.id);
  return {
    id: c.id, title: c.title, enabled: !!g.campaign?.enabled, live: g.live,
    link: g.campaign ? appUrl(`/play/${g.campaign.slug}`) : null,
    readinessIssues: g.readiness.issues, blockers: g.blockers,
    scholarship: await scholarshipOverview(c.id),
  };
}

async function overview() {
  const [platform, own, orgsRow, orgs, ownCourses, log] = await Promise.all([
    settingRow("PLATFORM"), settingRow("OWN"), settingRow("ORGS"),
    prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true, staffUserId: true } }),
    prisma.course.findMany({ where: { createdBy: { trainingOrgAsStaffUser: null } }, orderBy: { title: "asc" }, take: 100, select: { id: true, title: true } }),
    prisma.growthAudit.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const orgCards = [];
  for (const o of orgs) {
    const [row, courses] = await Promise.all([
      settingRow("ORGANIZATION", o.id),
      o.staffUserId ? prisma.course.findMany({ where: { createdById: o.staffUserId }, orderBy: { title: "asc" }, take: 50, select: { id: true, title: true } }) : [],
    ]);
    orgCards.push({
      id: o.id, name: o.name, enabled: !!row?.enabled, agreementAt: row?.agreementAt ?? null,
      commissionPercent: bpsToPercent(row?.commissionBps), scholarshipEnabled: !!row?.scholarshipEnabled,
      courses: await Promise.all(courses.map(courseCard)),
    });
  }
  const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(log.map((l) => l.actorId))] } }, select: { id: true, name: true } });
  const nameOf = new Map(actors.map((a) => [a.id, a.name]));
  return {
    switches: { platform: !!platform?.enabled, own: !!own?.enabled, orgs: !!orgsRow?.enabled, ownScholarships: !!own?.scholarshipEnabled },
    ownCourses: await Promise.all(ownCourses.map(courseCard)),
    organizations: orgCards,
    log: log.map((l) => ({ id: l.id, action: l.action, scopeType: l.scopeType, detail: l.detail, at: l.createdAt, by: nameOf.get(l.actorId) ?? "Someone" })),
  };
}

/** GET — every growth switch, organization and course with what is blocking it. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json(await overview());
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("global"), scope: z.enum(["PLATFORM", "OWN", "ORGS"]), enabled: z.boolean() }),
  z.object({ action: z.literal("org"), organizationId: z.string().min(1).max(60), enabled: z.boolean().optional(), agree: z.boolean().optional(), commissionPercent: z.union([z.number(), z.string(), z.null()]).optional(), scholarshipEnabled: z.boolean().optional() }),
  z.object({ action: z.literal("ownScholarships"), enabled: z.boolean() }),
  z.object({ action: z.literal("seats"), courseId: z.string().min(1).max(60), seats: z.union([z.number(), z.string()]), minPlays: z.union([z.number(), z.string()]) }),
  z.object({ action: z.literal("revokeSeat"), scholarshipId: z.string().min(1).max(60), note: z.string().max(200).optional() }),
  z.object({ action: z.literal("course"), courseId: z.string().min(1).max(60), enabled: z.boolean() }),
]);

/** POST — change a switch, record an organization's agreement, set its commission, or opt a course in. Super Admin only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      if (b.action === "global") await setGlobalSwitch(s.userId, b.scope, b.enabled);
      else if (b.action === "ownScholarships") await setOwnScholarships(s.userId, b.enabled);
      else if (b.action === "seats") await setSeats(s.userId, b.courseId, b.seats, b.minPlays);
      else if (b.action === "revokeSeat") await revokeSeat(s.userId, b.scholarshipId, b.note);
      else if (b.action === "course") await setCourseOptIn(s.userId, b.courseId, b.enabled);
      else {
        let commissionBps: number | null | undefined;
        if (b.commissionPercent !== undefined) {
          commissionBps = b.commissionPercent === null || b.commissionPercent === "" ? null : percentToBps(b.commissionPercent);
          if (commissionBps === null && b.commissionPercent !== null && b.commissionPercent !== "") throw new GrowthError("Commission is a percentage from 0 to 100.");
        }
        await setOrganization(s.userId, b.organizationId, { enabled: b.enabled, agree: b.agree, commissionBps, scholarshipEnabled: b.scholarshipEnabled });
      }
      return NextResponse.json(await overview());
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message, issues: e.issues }, { status: e.status });
      throw e;
    }
  });
}
