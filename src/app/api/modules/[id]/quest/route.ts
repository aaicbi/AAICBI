import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { ALL_REWARDS, QUEST_DEFAULTS, REWARD_LABELS, poolCoverage, suggestSplit } from "@/lib/quest/core";
import { cleanRewards, loadQuestSettings } from "@/lib/quest/server";

/**
 * Instructor side of Knowledge Quest for one module: the practice/formal
 * question pools, critical objectives (mastery gates), and settings.
 * Same access as the assessment routes: staff who own or share the course.
 */

async function snapshot(moduleId: string) {
  const [mod, objectives, questions, settings] = await Promise.all([
    prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, title: true, courseId: true, course: { select: { title: true } } } }),
    prisma.moduleLearningObjective.findMany({
      where: { moduleId },
      orderBy: { order: "asc" },
      select: { id: true, text: true, isCritical: true },
    }),
    prisma.question.findMany({
      where: { exam: { moduleId }, bankStatus: "APPROVED", bankObjectiveId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true, bankObjectiveId: true, bankPool: true },
    }),
    loadQuestSettings(moduleId),
  ]);
  const coverage = poolCoverage(
    objectives.map((o) => o.id),
    questions.map((q) => ({ objectiveId: q.bankObjectiveId, pool: q.bankPool }))
  );
  return {
    module: mod ? { id: mod.id, title: mod.title, courseId: mod.courseId, courseTitle: mod.course.title } : null,
    settings,
    objectives: objectives.map((o) => ({
      ...o,
      coverage: coverage.objectives.find((c) => c.objectiveId === o.id),
      questions: questions
        .filter((q) => q.bankObjectiveId === o.id)
        .map((q) => ({ id: q.id, text: q.text.length > 140 ? `${q.text.slice(0, 140)}…` : q.text, pool: q.bankPool })),
    })),
    ready: coverage.ready,
    minimums: QUEST_DEFAULTS.poolMinimum,
    rewardOptions: ALL_REWARDS.map((k) => ({ kind: k, label: REWARD_LABELS[k] })),
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId, session.role);
    return NextResponse.json(await snapshot(params.id));
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
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId, session.role);
    const parsed = SettingsBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
    const b = parsed.data;

    if (b.practiceEnabled) {
      const snap = await snapshot(params.id);
      if (!snap.ready) {
        return NextResponse.json(
          {
            error: `Practice can go live once every objective has at least ${QUEST_DEFAULTS.poolMinimum.practice} approved practice questions and ${QUEST_DEFAULTS.poolMinimum.formal} approved formal questions.`,
          },
          { status: 409 }
        );
      }
    }

    const data = {
      ...(b.practiceEnabled !== undefined ? { practiceEnabled: b.practiceEnabled } : {}),
      ...(b.practiceBeforeFormal !== undefined ? { practiceBeforeFormal: b.practiceBeforeFormal } : {}),
      ...(b.practiceRequiredPercent !== undefined ? { practiceRequiredPercent: b.practiceRequiredPercent } : {}),
      ...(b.enabledRewards !== undefined ? { enabledRewards: cleanRewards(b.enabledRewards) } : {}),
    };
    await prisma.moduleQuestSettings.upsert({
      where: { moduleId: params.id },
      create: { moduleId: params.id, ...data },
      update: data,
    });

    if (b.criticalObjectiveIds) {
      const mine = await prisma.moduleLearningObjective.findMany({ where: { moduleId: params.id }, select: { id: true } });
      const critical = new Set(b.criticalObjectiveIds);
      await prisma.$transaction(
        mine.map((o) => prisma.moduleLearningObjective.update({ where: { id: o.id }, data: { isCritical: critical.has(o.id) } }))
      );
    }
    return NextResponse.json(await snapshot(params.id));
  });
}

const PostBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setPool"), questionIds: z.array(z.string()).min(1).max(500), pool: z.enum(["PRACTICE", "FORMAL"]).nullable() }),
  z.object({ action: z.literal("autoSplit") }),
]);

/** POST — tag questions into a pool, or split every untagged approved question automatically. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId, session.role);
    const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const body = parsed.data;

    if (body.action === "setPool") {
      // Only this module's approved bank questions can be tagged.
      await prisma.question.updateMany({
        where: { id: { in: body.questionIds }, exam: { moduleId: params.id }, bankStatus: "APPROVED" },
        data: { bankPool: body.pool },
      });
    } else {
      const snap = await snapshot(params.id);
      for (const o of snap.objectives) {
        const untagged = o.questions.filter((q) => q.pool === null).map((q) => q.id);
        if (untagged.length === 0) continue;
        const split = suggestSplit(untagged, o.coverage?.practice ?? 0, o.coverage?.formal ?? 0);
        if (split.formal.length) await prisma.question.updateMany({ where: { id: { in: split.formal } }, data: { bankPool: "FORMAL" } });
        if (split.practice.length) await prisma.question.updateMany({ where: { id: { in: split.practice } }, data: { bankPool: "PRACTICE" } });
      }
    }
    return NextResponse.json(await snapshot(params.id));
  });
}
