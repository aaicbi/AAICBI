import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const AddSchema = z.object({
  name: z.string().trim().min(1).max(60),
  proficiency: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).default("INTERMEDIATE"),
});

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const skills = await prisma.traineeSkill.findMany({
      where: { traineeId: session.userId },
      select: { id: true, proficiency: true, skill: { select: { id: true, name: true, category: true } } },
      orderBy: { skill: { name: "asc" } },
    });
    return NextResponse.json(
      skills.map((s: (typeof skills)[number]) => ({
        id: s.id,
        proficiency: s.proficiency,
        skillId: s.skill.id,
        name: s.skill.name,
        category: s.skill.category,
      }))
    );
  });
}

/**
 * POST /api/trainee/skills — find-or-create on the canonical Skill
 * table by case-insensitive name, so the profile page's skill picker
 * works immediately (type a skill, pick a suggestion or add a new one)
 * without requiring an admin skill-management screen to exist first —
 * that curation tool is real, later scope (Phase 3's admin console),
 * not a blocker for a trainee using this feature today.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = AddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    let skill = await prisma.skill.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
    if (!skill) {
      skill = await prisma.skill.create({ data: { name: parsed.data.name } });
    }

    try {
      const created = await prisma.traineeSkill.create({
        data: { traineeId: session.userId, skillId: skill.id, proficiency: parsed.data.proficiency },
        select: { id: true, proficiency: true, skill: { select: { id: true, name: true, category: true } } },
      });
      return NextResponse.json(
        {
          id: created.id,
          proficiency: created.proficiency,
          skillId: created.skill.id,
          name: created.skill.name,
          category: created.skill.category,
        },
        { status: 201 }
      );
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "You've already added this skill." }, { status: 409 });
      }
      throw e;
    }
  });
}
