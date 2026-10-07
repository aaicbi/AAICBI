import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { requireOrgCourse } from "@/lib/ecosystem/orgScope";
import { cleanSkillList } from "@/lib/ecosystem/recommendCore";
import { ensureSkill } from "@/lib/ecosystem/skills";

const Body = z.object({ skills: z.array(z.string().max(60)).max(20) });

/** PUT /api/org/programs/[id]/skills — replace the skills one of the organization's own programs teaches. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const course = await requireOrgCourse(org, params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Send a list of skills." }, { status: 400 });
    const names = cleanSkillList(parsed.data.skills);
    await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const n of names) ids.push((await ensureSkill(tx, n)).id);
      await tx.courseSkill.deleteMany({ where: { courseId: course.id } });
      if (ids.length) await tx.courseSkill.createMany({ data: ids.map((skillId) => ({ courseId: course.id, skillId })) });
    });
    return NextResponse.json({ skills: names });
  });
}
