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

  // A second, unverified organization so the feed has variety and the
  // "one organization cannot dominate" rule is visible.
  let org2 = await prisma.trainingOrganization.findUnique({ where: { email: `demo-org2@${DOMAIN}` } });
  if (!org2) {
    const staff2 = await prisma.user.create({
      data: { name: "Demo Cloud Collective", email: `training-org-demo2@${DOMAIN}`, passwordHash: await bcrypt.hash(`${Math.random()}`, 10), role: "ADMIN" },
    });
    org2 = await prisma.trainingOrganization.create({
      data: { name: "Demo Cloud Collective", contactName: "Demo Admin 2", email: `demo-org2@${DOMAIN}`, passwordHash, approvalState: "APPROVED", approvedAt: new Date(), staffUserId: staff2.id, isDemo: true },
    });
  }
  await prisma.organizationPublicProfile.upsert({
    where: { trainingOrganizationId: org2.id },
    update: {},
    create: {
      trainingOrganizationId: org2.id,
      slug: "demo-cloud-collective",
      tagline: "Placeholder organization: cloud and DevOps for beginners.",
      description: "A second demo organization with placeholder content. Nothing here is real.",
      location: "Abuja, Nigeria (placeholder)",
      publicEnabled: true,
      verified: false,
      isDemo: true,
    },
  });
  let cloudCourse = await prisma.course.findFirst({ where: { title: "Cloud Fundamentals (demo)", createdById: org2.staffUserId! } });
  if (!cloudCourse) {
    cloudCourse = await prisma.course.create({
      data: { title: "Cloud Fundamentals (demo)", description: "Placeholder program.", category: "Cloud", durationDisplay: "8 weeks", status: "PUBLISHED", published: true, isFree: true, createdById: org2.staffUserId!, isDemo: true },
    });
  }
  const cloudTrainee = await prisma.trainee.upsert({
    where: { email: DEMO_EMAILS.trainee("trainee5") },
    update: {},
    create: { name: "Demo Ngozi Eze", email: DEMO_EMAILS.trainee("trainee5"), passwordHash, emailVerified: true, isDemo: true },
  });
  await prisma.courseEnrollment.upsert({
    where: { traineeId_courseId: { traineeId: cloudTrainee.id, courseId: cloudCourse.id } },
    update: {},
    create: { traineeId: cloudTrainee.id, courseId: cloudCourse.id, source: "ADMIN_GRANTED" },
  });
  for (const v of [
    { id: "ua-CiDNNj30", title: "What Is Cloud Computing?", skills: ["Cloud"] },
    { id: "3c-iBn73dDE", title: "Docker in One Hour", skills: ["Docker", "DevOps"] },
  ]) {
    if (await prisma.educationPost.findFirst({ where: { trainingOrganizationId: org2.id, youtubeId: v.id } })) continue;
    const skillRows = [];
    for (const name of v.skills) skillRows.push(await prisma.skill.upsert({ where: { name }, update: {}, create: { name } }));
    await prisma.educationPost.create({
      data: {
        trainingOrganizationId: org2.id, traineeId: cloudTrainee.id, courseId: cloudCourse.id, title: v.title,
        description: "Placeholder video for the second demo organization.",
        youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`, youtubeId: v.id, thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        category: "Cloud", topic: v.title, status: "PUBLISHED", consentRespondedAt: new Date(), publishedAt: new Date(Date.now() - 2 * 86_400_000),
        viewCount: 40, isDemo: true, skills: { create: skillRows.map((x) => ({ skillId: x.id })) },
      },
    });
  }

  // Engagement: a few likes, saves and follows from demo trainees.
  const allPosts = await prisma.educationPost.findMany({ where: { isDemo: true }, select: { id: true } });
  for (const [i, t] of trainees.entries()) {
    for (const [j, post] of allPosts.entries()) {
      if ((i + j) % 2 === 0) {
        await prisma.educationPostReaction.upsert({
          where: { postId_traineeId_kind: { postId: post.id, traineeId: t.id, kind: "LIKE" } }, update: {}, create: { postId: post.id, traineeId: t.id, kind: "LIKE" },
        });
      }
      if ((i + j) % 5 === 0) {
        await prisma.educationPostReaction.upsert({
          where: { postId_traineeId_kind: { postId: post.id, traineeId: t.id, kind: "SAVE" } }, update: {}, create: { postId: post.id, traineeId: t.id, kind: "SAVE" },
        });
      }
    }
  }
  await prisma.organizationFollow.upsert({
    where: { traineeId_trainingOrganizationId: { traineeId: trainees[0].id, trainingOrganizationId: org2.id } }, update: {}, create: { traineeId: trainees[0].id, trainingOrganizationId: org2.id },
  });
  // The demo trainee is discoverable so the feed shows them the demo job.
  await prisma.trainee.update({ where: { id: trainees[0].id }, data: { publiclyDiscoverable: true } });

  // One approved showcase project.
  if (!(await prisma.project.findFirst({ where: { traineeId: trainees[1].id, title: "Sales Dashboard (demo)" } }))) {
    await prisma.project.create({
      data: {
        traineeId: trainees[1].id, title: "Sales Dashboard (demo)", description: "Placeholder project: a Power BI sales dashboard.",
        listedInShowcase: true, showcaseStatus: "APPROVED", reviewedAt: new Date(),
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
  console.log(`  Trainee (/trainee/login):    ${DEMO_EMAILS.trainee("trainee1")} (trainee1..5)`);
  console.log(`  Employer (/employer/login):  ${DEMO_EMAILS.employer}`);
  console.log(`  Investor (/investor/login):  ${DEMO_EMAILS.investor}`);
  console.log("Then turn the public pages on in /admin/ecosystem and visit /feed, /learn and /organizations/demo-tech-academy.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
