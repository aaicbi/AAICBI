import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, orgPolicyOf } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** GET — what this organization may do with its trainees' games. Needs "Global game settings: Configure". */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requirePermission("gaming_studio.settings:configure");
    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
    if (!org) return NextResponse.json({ error: "That organization could not be found." }, { status: 404 });
    return NextResponse.json({ organization: org, policy: await orgPolicyOf(org.id) }, { headers: { "Cache-Control": "no-store" } });
  });
}

const Body = z.object({
  resultsView: z.boolean().optional(), resultsExport: z.boolean().optional(), liveMonitor: z.boolean().optional(), endSessions: z.boolean().optional(),
  restrictTrainees: z.boolean().optional(), removeParticipants: z.boolean().optional(), chatGameModeration: z.boolean().optional(), toggleGames: z.boolean().optional(), courseRules: z.boolean().optional(),
}).strict();

/** PUT — change any of the organization's game capabilities. Recorded with the before and after; applies on the organization's next request. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("gaming_studio.settings:configure");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Choose a capability to change." }, { status: 400 });
    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "That organization could not be found." }, { status: 404 });
    const before = await orgPolicyOf(org.id);
    await prisma.orgGamingPolicy.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...before, ...parsed.data, updatedById: session.userId }, update: { ...parsed.data, updatedById: session.userId } });
    const after = await orgPolicyOf(org.id);
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "ORG_GAMING_POLICY_CHANGED", resourceType: "organization", resourceId: org.id, organizationId: org.id, before, after });
    return NextResponse.json({ policy: after });
  });
}
