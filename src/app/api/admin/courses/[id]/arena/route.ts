import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { requireOrgGamesCapability } from "@/lib/rbac/guard";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";
import { organizationOfCourse, saveScope, scopeRow } from "@/lib/arena/config";
import { ARENA_DEFAULTS, RULE_KEYS, availability, resolveArena, sanitizeArenaPatch } from "@/lib/arena/configCore";

export const dynamic = "force-dynamic";

async function describe(courseId: string) {
  const { organizationId } = await organizationOfCourse(courseId);
  const [platform, org, own] = await Promise.all([scopeRow("PLATFORM"), organizationId ? scopeRow("ORGANIZATION", organizationId) : null, scopeRow("COURSE", courseId)]);
  const inherited = resolveArena([platform, org]);
  const effective = resolveArena([platform, org, own]);
  const rules = Object.fromEntries(RULE_KEYS.map((k) => [k, { value: effective[k], own: own?.[k] ?? null, inherited: inherited[k], default: ARENA_DEFAULTS[k] }]));
  return { available: availability(effective), rules };
}

/** GET — the rules of play for one course (the arena switches themselves belong to the Super Admin). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    return NextResponse.json(await describe(params.id));
  });
}

/** PUT — the course owner (or someone it is shared with, or a Super Admin) sets seconds per question, the bonus and the rest. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, s.userId, s.role);
    await requireOrgGamesCapability(s, "org_games.settings:configure", "courseRules");
    const body = await req.json().catch(() => null);
    const clean = sanitizeArenaPatch(body, RULE_KEYS);
    if (Object.keys(clean).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    await saveScope("COURSE", params.id, clean, s.userId);
    return NextResponse.json(await describe(params.id));
  });
}
