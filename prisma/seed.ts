/**
 * Demo data — one admin, one published exam with a handful of Excel
 * questions, matching the pattern the DOCX importer produces. Run with:
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@aaicbi.africa" },
    update: {},
    create: {
      name: "Kufreh Johnson",
      email: "admin@aaicbi.africa",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  const exam = await prisma.exam.upsert({
    where: { code: "AAICBI-EXCEL-DEMO" },
    update: {},
    create: {
      code: "AAICBI-EXCEL-DEMO",
      title: "AAICBI Excel for Data Analytics — Week 1 Assessment",
      description: "Foundational check on data concepts and the Excel window.",
      course: "Excel for Data Analytics",
      module: "Module 1",
      instructions:
        "Read each question carefully. Select only one answer. You have 20 minutes for this demo exam.",
      durationMinutes: 20,
      passMarkPercent: 80,
      randomizeQuestions: true,
      randomizeOptions: true,
      showResultImmediately: true,
      showCorrectAnswers: true,
      allowReview: true,
      published: true,
      createdById: admin.id,
    },
  });

  const demoQuestions = [
    {
      text: "Which of these is 'information' rather than raw 'data'?",
      topic: "Data vs Information",
      difficulty: "BEGINNER" as const,
      explanation:
        "A sentence that gives a fact context and meaning is information; a bare number or word on its own is just data.",
      options: [
        { text: "45", key: "A", isCorrect: false },
        { text: "JSS2", key: "B", isCorrect: false },
        { text: "Chinedu scored 45 in JSS2", key: "C", isCorrect: true },
        { text: "08031112233", key: "D", isCorrect: false },
      ],
    },
    {
      text: "Which file type keeps formulas, formatting, and multiple sheets intact?",
      topic: "File Types",
      difficulty: "BEGINNER" as const,
      explanation: ".xlsx is the default Excel Workbook format and preserves everything.",
      options: [
        { text: ".csv", key: "A", isCorrect: false },
        { text: ".xlsx", key: "B", isCorrect: true },
        { text: ".txt", key: "C", isCorrect: false },
        { text: ".jpg", key: "D", isCorrect: false },
      ],
    },
    {
      text: "Which part of the Excel window shows the address of the currently selected cell?",
      topic: "Excel Window",
      difficulty: "BEGINNER" as const,
      explanation: "The Name Box always shows the address of whatever cell is currently selected.",
      options: [
        { text: "Formula Bar", key: "A", isCorrect: false },
        { text: "Status Bar", key: "B", isCorrect: false },
        { text: "Name Box", key: "C", isCorrect: true },
        { text: "Ribbon", key: "D", isCorrect: false },
      ],
    },
  ];

  for (let i = 0; i < demoQuestions.length; i++) {
    const q = demoQuestions[i];
    await prisma.question.create({
      data: {
        examId: exam.id,
        text: q.text,
        topic: q.topic,
        difficulty: q.difficulty,
        explanation: q.explanation,
        order: i,
        options: {
          create: q.options.map((o, idx) => ({
            text: o.text,
            key: o.key,
            isCorrect: o.isCorrect,
            order: idx,
          })),
        },
      },
    });
  }

  // M11 demo — a real Course → Module → (module-scoped) Assessment, so
  // the module-scoped "take assessment from inside a course" flow has
  // something to click through immediately, alongside the pre-existing
  // by-code demo exam above (that flow stays as its own separate demo
  // on purpose — see the M11 update comment in
  // src/app/api/attempts/route.ts for why both are still real,
  // supported paths, not one superseding the other).
  const course = await prisma.course.upsert({
    where: { id: "demo-course-excel" }, // fixed id so this seed is safely re-runnable
    update: {},
    create: {
      id: "demo-course-excel",
      title: "Excel for Data Analytics",
      description: "AAICBI's foundational Excel programme for the data analytics track.",
      published: true,
      createdById: admin.id,
    },
  });

  const courseModule = await prisma.module.upsert({
    where: { id: "demo-module-excel-week1" },
    update: {},
    create: {
      id: "demo-module-excel-week1",
      courseId: course.id,
      title: "Week 1 — Excel Foundations",
      description: "Data vs. information, file types, and the Excel window.",
      order: 0,
    },
  });

  const moduleExam = await prisma.exam.upsert({
    where: { moduleId: courseModule.id },
    update: {},
    create: {
      code: "AAICBI-EXCEL-W1-MODULE",
      title: "Week 1 — Excel Foundations Assessment",
      moduleId: courseModule.id,
      instructions:
        "Read each question carefully. Select only one answer. You have 20 minutes for this assessment.",
      durationMinutes: 20,
      passMarkPercent: 80,
      randomizeQuestions: true,
      randomizeOptions: true,
      showResultImmediately: true,
      showCorrectAnswers: true,
      allowReview: true,
      published: true,
      createdById: admin.id,
    },
  });

  const existingModuleQuestions = await prisma.question.count({ where: { examId: moduleExam.id } });
  if (existingModuleQuestions === 0) {
    for (let i = 0; i < demoQuestions.length; i++) {
      const q = demoQuestions[i];
      await prisma.question.create({
        data: {
          examId: moduleExam.id,
          text: q.text,
          topic: q.topic,
          difficulty: q.difficulty,
          explanation: q.explanation,
          order: i,
          options: {
            create: q.options.map((o, idx) => ({
              text: o.text,
              key: o.key,
              isCorrect: o.isCorrect,
              order: idx,
            })),
          },
        },
      });
    }
  }

  // M12 demo — a second module with no assessment or content of its
  // own to complete, so the demo course actually demonstrates locking:
  // Module 2 stays locked (per progressCore.ts's rule) until the demo
  // trainee passes Module 1's assessment above. Module 1 has a
  // published assessment, so it's gated on passing that — not on
  // clicking through its lessons — matching the spec's "score 80% on
  // Module 1" framing (see the "why" comment on computeModuleProgress).
  const courseModule2 = await prisma.module.upsert({
    where: { id: "demo-module-excel-week2" },
    update: {},
    create: {
      id: "demo-module-excel-week2",
      courseId: course.id,
      title: "Week 2 — Formulas & Functions",
      description: "Locked until Week 1's assessment is passed — a live demo of M12's module locking.",
      order: 1,
    },
  });
  await prisma.lesson.upsert({
    where: { id: "demo-lesson-excel-week2-intro" },
    update: {},
    create: {
      id: "demo-lesson-excel-week2-intro",
      moduleId: courseModule2.id,
      title: "Introduction to Formulas",
      order: 0,
    },
  });

  const traineePasswordHash = await bcrypt.hash("TraineeDemo123!", 10);
  const trainee = await prisma.trainee.upsert({
    where: { email: "demo.trainee@example.com" },
    update: {},
    create: {
      name: "Demo Trainee",
      email: "demo.trainee@example.com",
      passwordHash: traineePasswordHash,
      emailVerified: true, // pre-verified so the seed is immediately usable for a demo login
      // Stage 6 demo — discoverable by default so a demo employer
      // account actually has someone real to find when browsing,
      // rather than an empty list on first login.
      publiclyDiscoverable: true,
      discoverableHeadline: "Aspiring data analyst, AAICBI Cohort 2026",
    },
  });

  // Stage 6 demo — a pre-approved employer account so the employer
  // portal has something to log into and explore immediately, rather
  // than requiring a fresh registration + manual admin approval before
  // any of it is visible. Genuinely APPROVED, not PENDING — the whole
  // point is a working demo, not a demo of the approval queue itself.
  const employerPasswordHash = await bcrypt.hash("EmployerDemo123!", 10);
  const employer = await prisma.employer.upsert({
    where: { email: "demo.employer@example.com" },
    update: {},
    create: {
      companyName: "Acme Technologies Ltd",
      contactName: "Ada Obi",
      email: "demo.employer@example.com",
      passwordHash: employerPasswordHash,
      registrationNumber: "RC-0000000",
      phone: "+2348000000000",
      approvalState: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date(),
    },
  });

  // Stage 6 demo — one real, published testimonial so the landing
  // page shows something when you first visit it, rather than an
  // empty section (see page.tsx's own comment on why it hides
  // entirely with zero published testimonials).
  await prisma.testimonial.upsert({
    where: { id: "demo-testimonial-1" },
    update: {},
    create: {
      id: "demo-testimonial-1",
      traineeName: "Chinedu Eze",
      quote:
        "Real instructors, real feedback on my code. Nothing like the self-paced courses I'd tried before joining AAICBI.",
      rating: 5,
      courseTitle: "Excel for Data Analytics",
      createdById: admin.id,
    },
  });

  console.log("Seeded:");
  console.log(`  Admin login:      admin@aaicbi.africa / ChangeMe123!  (SUPER_ADMIN — sees every course/exam/result org-wide, not just their own)`);
  console.log(`  By-code exam:     ${exam.code}  (visit /exam/enter)`);
  console.log(`  Demo course:      "${course.title}" → Module "${courseModule.title}" (Module 2 starts locked — M12 demo)`);
  console.log(`                    (visit /trainee/courses after logging in as the demo trainee)`);
  console.log(`                    complete both modules to see M15's certificate issue automatically`);
  console.log(`  Trainee login:    ${trainee.email} / TraineeDemo123!`);
  console.log(`  Employer login:   ${employer.email} / EmployerDemo123!  (pre-approved — visit /employer/discover)`);
  console.log(`  Landing page:     / shows one published demo testimonial`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
