import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/admin/loop/objectives/confirm — the ONE place a module's
 * learning objectives are actually saved. Deliberately no Anthropic
 * import, no reasoning, no AI call of any kind — the literal, structural
 * enforcement of "Loop only drafts, a human decides." Fires only when
 * the Super Admin's own browser calls it, which only happens from the
 * objectives-proposal card's Confirm button in
 * src/app/admin/command/page.tsx, after POST /api/admin/loop/ask
 * already returned a `{kind: "objectivesProposal", ...}` for the admin
 * to review.
 *
 * `requireRole("SUPER_ADMIN")` only, no ownership check — the user
 * confirmed Loop's question-bank actions should extend Loop's existing
 * platform-wide reach (its read-only tools already ignore per-course
 * ownership) rather than the stricter "no SUPER_ADMIN bypass on any
 * mutation" rule this app's courseOwnership.ts otherwise enforces.
 *
 * `confirmedById` always comes from the session, never the request
 * body — the actual mechanism behind "Loop only ever drafts, a human
 * decision is what makes an objective real."
 */
const ConfirmObjectivesSchema = z.object({
  moduleId: z.string().min(1),
  objectives: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
});

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`loop-objectives-confirm:${session.userId}:${clientIp(req)}`, 15, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many confirmations in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ConfirmObjectivesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A module and at least one objective are required." }, { status: 400 });
    }

    const moduleExists = await prisma.module.findUnique({ where: { id: parsed.data.moduleId }, select: { id: true } });
    if (!moduleExists) {
      return NextResponse.json({ error: "That module could not be found." }, { status: 404 });
    }

    const created = await prisma.$transaction(
      parsed.data.objectives.map((text, order) =>
        prisma.moduleLearningObjective.create({
          data: { moduleId: parsed.data.moduleId, text, order, confirmedById: session.userId },
        })
      )
    );

    return NextResponse.json({ objectives: created }, { status: 201 });
  });
}
