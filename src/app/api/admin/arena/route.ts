import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";
import { organizationOfCourse, saveScope, scopeRow } from "@/lib/arena/config";
import { ARENA_DEFAULTS, RULE_KEYS, SWITCH_KEYS, availability, resolveArena, sanitizeArenaPatch, type ArenaRow } from "@/lib/arena/configCore";
import { realtimeMode } from "@/lib/arena/realtime";

export const dynamic = "force-dynamic";

const Scope = z.object({ scopeType: z.enum(["PLATFORM", "ORGANIZATION", "COURSE"]), scopeId: z.string().max(60).default("") });

async function describe(scopeType: "PLATFORM" | "ORGANIZATION" | "COURSE", scopeId: string) {
  const platform = await scopeRow("PLATFORM");
  let wider: (ArenaRow | null)[] = [];
  if (scopeType === "ORGANIZATION") wider = [platform];
  if (scopeType === "COURSE") {
    const { organizationId } = await organizationOfCourse(scopeId);
    wider = [platform, organizationId ? await scopeRow("ORGANIZATION", organizationId) : null];
  }
  const own = scopeType === "PLATFORM" ? platform : await scopeRow(scopeType, scopeId);
  const inherited = resolveArena(wider);
  const effective = resolveArena([...wider, own]);
  return { scopeType, scopeId, own: own ?? {}, inherited, effective, available: availability(effective) };
}

/** GET /api/admin/arena?scopeType=COURSE&scopeId=… — Super Admin only. Switches and rules for one scope, with what it inherits. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requirePermission("gaming_studio.settings:configure");
    const q = Scope.safeParse({ scopeType: req.nextUrl.searchParams.get("scopeType") ?? "PLATFORM", scopeId: req.nextUrl.searchParams.get("scopeId") ?? "" });
    if (!q.success) return NextResponse.json({ error: "Choose a platform, an organization or a course." }, { status: 400 });
    const [orgs, courses] = await Promise.all([
      prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.course.findMany({ orderBy: { title: "asc" }, take: 300, select: { id: true, title: true } }),
    ]);
    return NextResponse.json({ ...(await describe(q.data.scopeType, q.data.scopeId)), defaults: ARENA_DEFAULTS, realtime: realtimeMode(), organizations: orgs, courses });
  });
}

const Put = Scope.extend({ patch: z.record(z.unknown()) });

/** PUT /api/admin/arena — Super Admin only. Changes any switch or rule on one scope. A null value goes back to inheriting. */
export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("gaming_studio.settings:configure");
    const parsed = Put.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    const { scopeType, scopeId, patch } = parsed.data;
    if (scopeType === "PLATFORM" && scopeId !== "") return NextResponse.json({ error: "The platform has no id." }, { status: 400 });
    if (scopeType !== "PLATFORM") {
      const found = scopeType === "ORGANIZATION" ? await prisma.trainingOrganization.findUnique({ where: { id: scopeId }, select: { id: true } }) : await prisma.course.findUnique({ where: { id: scopeId }, select: { id: true } });
      if (!found) return NextResponse.json({ error: "That organization or course could not be found." }, { status: 404 });
    }
    const clean = sanitizeArenaPatch(patch, [...SWITCH_KEYS, ...RULE_KEYS]);
    if (Object.keys(clean).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    await saveScope(scopeType, scopeId, clean, session.userId);
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "ARENA_SETTINGS_CHANGED", resourceType: "arena", resourceId: `${scopeType}:${scopeId}`, after: { keys: Object.keys(clean) } });
    return NextResponse.json(await describe(scopeType, scopeId));
  });
}
