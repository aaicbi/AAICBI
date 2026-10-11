import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * An independent copy of a course for another organization (or instructor): the course page, its modules, lessons and
 * materials, the skills it teaches, and the assessments and examination with their questions. The copy is a DRAFT that
 * belongs to the new owner, who sets their own price, certificate and schedule. Nothing about trainees comes across:
 * enrolments, attempts, results, certificates, questions' history. Materials point at the same files (they are shared, not
 * duplicated). The original is never touched.
 */
async function copyExam(tx: Prisma.TransactionClient, examId: string, target: { ownerId: string; moduleId?: string; courseId?: string }) {
  const e = await tx.exam.findUnique({ where: { id: examId }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
  if (!e) return;
  await tx.exam.create({
    data: {
      code: `COPY-${randomBytes(5).toString("hex").toUpperCase()}`,
      title: e.title, description: e.description, instructions: e.instructions, durationMinutes: e.durationMinutes, passMarkPercent: e.passMarkPercent,
      numQuestions: e.numQuestions, maxAttempts: e.maxAttempts, randomizeQuestions: e.randomizeQuestions, randomizeOptions: e.randomizeOptions,
      showResultImmediately: e.showResultImmediately, showCorrectAnswers: e.showCorrectAnswers, allowReview: e.allowReview, monitoringEnabled: e.monitoringEnabled,
      certificateEnabled: false, retakeCooldownHours: e.retakeCooldownHours, published: false,
      createdById: target.ownerId, moduleId: target.moduleId ?? null, courseId: target.courseId ?? null,
      questions: {
        create: e.questions.map((q) => ({
          text: q.text, type: q.type, topic: q.topic, difficulty: q.difficulty, explanation: q.explanation, order: q.order, needsReview: q.needsReview, reviewReason: q.reviewReason,
          options: { create: q.options.map((o) => ({ text: o.text, key: o.key, isCorrect: o.isCorrect, order: o.order })) },
        })),
      },
    },
  });
}

export async function copyCourseTo(sourceCourseId: string, newOwnerId: string): Promise<{ id: string; title: string }> {
  const src = await prisma.course.findUnique({
    where: { id: sourceCourseId },
    include: { skills: true, modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, include: { materials: { orderBy: { order: "asc" } } } }, assessment: { select: { id: true } } } }, },
  });
  if (!src) throw new Error("Course not found.");
  const examination = await prisma.exam.findUnique({ where: { courseId: src.id }, select: { id: true } });

  return prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        title: `${src.title} (copy)`, description: src.description, status: "DRAFT", isFree: true,
        category: src.category, level: src.level, durationDisplay: src.durationDisplay, trainingFormat: src.trainingFormat, instructorNames: src.instructorNames,
        prerequisites: src.prerequisites, targetAudience: src.targetAudience, skillsGained: src.skillsGained, learningOutcomes: src.learningOutcomes, whatToExpect: src.whatToExpect,
        showWhatYoullLearn: src.showWhatYoullLearn, showOutline: src.showOutline, showWhatToExpect: src.showWhatToExpect, showRequirements: src.showRequirements,
        showAudience: src.showAudience, showCurriculumDownload: src.showCurriculumDownload, showFlyer: src.showFlyer, flyerUrl: src.flyerUrl, curriculumUrl: src.curriculumUrl,
        createdById: newOwnerId,
        skills: { create: src.skills.map((s) => ({ skillId: s.skillId })) },
      },
      select: { id: true, title: true },
    });
    for (const m of src.modules) {
      const mod = await tx.module.create({
        data: {
          courseId: course.id, title: m.title, description: m.description, order: m.order,
          lessons: { create: m.lessons.map((l) => ({ title: l.title, description: l.description, order: l.order, materials: { create: l.materials.map((x) => ({ type: x.type, title: x.title, url: x.url, order: x.order })) } })) },
        },
        select: { id: true },
      });
      if (m.assessment) await copyExam(tx, m.assessment.id, { ownerId: newOwnerId, moduleId: mod.id });
    }
    if (examination) await copyExam(tx, examination.id, { ownerId: newOwnerId, courseId: course.id });
    return course;
  }, { timeout: 60_000 });
}
