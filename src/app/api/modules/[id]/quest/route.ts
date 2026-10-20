import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { requireStudioUser, requireStudioModule, requireStudioCan, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { QuestAdminError, applyQuestSettings, autoSplitPools, questSnapshot, setQuestionPool } from "@/lib/quest/admin";

/**
 * Instructor side of Knowledge Quest for one module: the practice/formal
 * question pools, critical objectives (mastery gates), and settings.
 * Same access as the assessment routes: staff who own or share the course.
 * The operations themselves live in src/lib/quest/admin.ts, shared with Loop.
 */

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser(); // the Game Studio's data: Studio access only
    requireStudioCan(session, "gaming_studio.configs:view");
    await requireStudioModule(params.id, session);
    return NextResponse.json(await questSnapshot(params.id));
  });
}

const SettingsBody = z.object({
  practiceEnabled: z.boolean().optional(),
  practiceBeforeFormal: z.boolean().optional(),
  practiceRequiredPercent: z.number().int().min(10).max(100).optional(),
  enabledRewards: z.array(z.string()).optional(),
  criticalObjectiveIds: z.array(z.string()).optional(),
});

/** PUT — settings, rewards and critical objectives. Practice can't go live until both pools are big enough. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "QUESTIONS");
    await requireStudioModule(params.id, session);
    const parsed = SettingsBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    try {
      await applyQuestSettings(params.id, parsed.data);
    } catch (e) {
      if (e instanceof QuestAdminError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await questSnapshot(params.id));
  });
}

const PostBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setPool"), questionIds: z.array(z.string()).min(1).max(500), pool: z.enum(["PRACTICE", "FORMAL"]).nullable() }),
  z.object({ action: z.literal("autoSplit") }),
]);

/** POST — tag questions into a pool, or split every untagged approved question automatically. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "QUESTIONS");
    await requireStudioModule(params.id, session);
    const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    if (parsed.data.action === "setPool") await setQuestionPool(params.id, parsed.data.questionIds, parsed.data.pool);
    else await autoSplitPools(params.id);
    return NextResponse.json(await questSnapshot(params.id));
  });
}
