/**
 * Demo world for the public ecosystem: one demo organization with
 * trainees, programs and published videos, plus a demo employer (with a
 * job) and investor. Every row is either flagged isDemo or uses an
 * @demo.aaicbi.invalid address (which can never receive email), so it is
 * identifiable and fully removable with `npm run db:reset-demo`.
 *
 *   npm run db:seed-demo
 *
 * Idempotent — safe to run again. In production it refuses to run unless
 * ALLOW_DEMO_SEED=1 and DEMO_PASSWORD (not the dev default) are set.
 * It never switches the public feature flags on; do that in
 * /admin/ecosystem when you want the demo visible.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DOMAIN = "demo.aaicbi.invalid";
export const DEMO_EMAILS = {
  organization: `demo-org@${DOMAIN}`,
  employer: `demo-employer@${DOMAIN}`,
  investor: `demo-investor@${DOMAIN}`,
  trainee: (n: string) => `${n}@${DOMAIN}`,
};

async function main() {
  const inProd = process.env.NODE_ENV === "production";
  if (inProd && (process.env.ALLOW_DEMO_SEED !== "1" || !process.env.DEMO_PASSWORD)) {
    throw new Error("Refusing to seed demo accounts in production without ALLOW_DEMO_SEED=1 and a DEMO_PASSWORD.");
  }
  const password = process.env.DEMO_PASSWORD ?? "Demo-Pass-123!";
  const passwordHash = await bcrypt.hash(password, 10);

  // Organization + its internal staff account (same pattern as a real approval).
  let org = await prisma.trainingOrganization.findUnique({ where: { email: DEMO_EMAILS.organization } });
  if (!org) {
    const staff = await prisma.user.create({
      data: { name: "Demo Tech Academy", email: `training-org-demo@${DOMAIN}`, passwordHash: await bcrypt.hash(`${Math.random()}`, 10), role: "ADMIN" },
    });
    org = await prisma.trainingOrganization.create({
      data: {
        name: "Demo Tech Academy",
        contactName: "Demo Admin",
        email: DEMO_EMAILS.organization,
        passwordHash,
        approvalState: "APPROVED",
        approvedAt: new Date(),
        staffUserId: staff.id,
        isDemo: true,
      },
    });
  }
  const staffUserId = org.staffUserId!;

  await prisma.organizationPublicProfile.upsert({
    where: { trainingOrganizationId: org.id },
    update: {},
    create: {
      trainingOrganizationId: org.id,
      slug: "demo-tech-academy",
      tagline: "Placeholder organization: practical data and software training.",
      description:
        "This is a demo organization with placeholder content so every part of the AAICBI public ecosystem can be explored. Nothing here is real.",
      location: "Lagos, Nigeria (placeholder)",
      publicEnabled: true,
      verified: true,
      isDemo: true,
    },
  });

  // Programs.
  const programDefs = [
    { title: "Data Analytics Professional Program (demo)", category: "Data Analytics", durationDisplay: "4 months", trainingFormat: undefined },
    { title: "Python Foundations (demo)", category: "Programming", durationDisplay: "6 weeks", trainingFormat: undefined },
  ];
  const courses = [];
  for (const def of programDefs) {
    const existing = await prisma.course.findFirst({ where: { title: def.title, createdById: staffUserId } });
    courses.push(
      existing ??
        (await prisma.course.create({
          data: {
            title: def.title,
            description: "Placeholder program used to demonstrate how videos lead to programs.",
            category: def.category,
            durationDisplay: def.durationDisplay,
            status: "PUBLISHED",
            published: true,
            isFree: true,
            createdById: staffUserId,
            isDemo: true,
          },
        }))
    );
  }

  // Trainees, enrolled in the demo programs.
  const traineeNames = ["Demo John Udoh", "Demo Jane Doe", "Demo Amina Bello", "Demo Tunde Okafor"];
  const trainees = [];
  for (const [i, name] of traineeNames.entries()) {
    const email = DEMO_EMAILS.trainee(`trainee${i + 1}`);
    const t = await prisma.trainee.upsert({
      where: { email },
      update: {},
      create: { name, email, passwordHash, emailVerified: true, isDemo: true },
    });
    trainees.push(t);
    const course = courses[i % courses.length];
    await prisma.courseEnrollment.upsert({
      where: { traineeId_courseId: { traineeId: t.id, courseId: course.id } },
      update: {},
      create: { traineeId: t.id, courseId: course.id, source: "ADMIN_GRANTED" },
    });
  }

  // Published placeholder videos (public YouTube tutorials stand in for trainee videos).
  const videos = [
    { id: "rfscVS0vtbw", title: "Introduction to Data Cleaning with Python", skills: ["Python", "Data Cleaning"], course: 0, trainee: 0 },
    { id: "HXV3zeQKqGY", title: "SQL Joins Explained", skills: ["SQL", "Data Analytics"], course: 0, trainee: 1 },
    { id: "kqtD5dpn9C8", title: "Python Basics for Absolute Beginners", skills: ["Python"], course: 1, trainee: 2 },
    { id: "PkZNo7MFNFg", title: "JavaScript First Steps", skills: ["JavaScript", "Web Development"], course: 1, trainee: 3 },
  ];
  for (const v of videos) {
    const exists = await prisma.educationPost.findFirst({ where: { trainingOrganizationId: org.id, youtubeId: v.id } });
    if (exists) continue;
    const course = courses[v.course];
    const skillRows = [];
    for (const name of v.skills) skillRows.push(await prisma.skill.upsert({ where: { name }, update: {}, create: { name } }));
    await prisma.educationPost.create({
      data: {
        trainingOrganizationId: org.id,
        traineeId: trainees[v.trainee].id,
        courseId: course.id,
        title: v.title,
        description: "Placeholder video for the demo organization.",
        youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
        youtubeId: v.id,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        category: course.category,
        topic: v.title,
        status: "PUBLISHED",
        consentRespondedAt: new Date(),
        publishedAt: new Date(),
        viewCount: 120 + v.trainee * 37,
        isDemo: true,
        skills: { create: skillRows.map((s) => ({ skillId: s.id })) },
      },
    });
  }

  // Demo employer with one approved job, and a demo investor.
  const employer = await prisma.employer.upsert({
    where: { email: DEMO_EMAILS.employer },
    update: {},
    create: {
      companyName: "Demo Analytics Ltd",
      contactName: "Demo Employer",
      email: DEMO_EMAILS.employer,
      passwordHash,
      registrationNumber: "DEMO-0001",
      phone: "+000000000",
      approvalState: "APPROVED",
      approvedAt: new Date(),
    },
  });
  if (!(await prisma.jobPosting.findFirst({ where: { employerId: employer.id } }))) {
    await prisma.jobPosting.create({
      data: {
        employerId: employer.id,
        title: "Junior Data Analyst (demo)",
        description: "Placeholder job posting for the demo employer.",
        closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "APPROVED",
      },
    });
  }
  await prisma.investor.upsert({
    where: { email: DEMO_EMAILS.investor },
    update: {},
    create: {
      name: "Demo Investor",
      email: DEMO_EMAILS.investor,
      passwordHash,
      organization: "Demo Ventures",
      approvalState: "APPROVED",
      approvedAt: new Date(),
    },
  });

  console.log("Demo ecosystem ready. Sign in with password:", inProd ? "(your DEMO_PASSWORD)" : password);
  console.log(`  Organization (/org/login):   ${DEMO_EMAILS.organization}`);
  console.log(`  Trainee (/trainee/login):    ${DEMO_EMAILS.trainee("trainee1")} (trainee1..4)`);
  console.log(`  Employer (/employer/login):  ${DEMO_EMAILS.employer}`);
  console.log(`  Investor (/investor/login):  ${DEMO_EMAILS.investor}`);
  console.log("Then turn the public pages on in /admin/ecosystem and visit /organizations/demo-tech-academy and /learn.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
