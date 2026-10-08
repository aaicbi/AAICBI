import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const emp = await prisma.employer.findUniqueOrThrow({ where: { email: "employer@dev.test" } });
  const t0 = await prisma.trainee.findUniqueOrThrow({ where: { email: "t0@dev.test" } });
  const t5 = await prisma.trainee.findUniqueOrThrow({ where: { email: "t5@dev.test" } });
  // an accepted introduction between the employer and t0; none with t5
  await prisma.introductionRequest.upsert({
    where: { employerId_traineeId: { employerId: emp.id, traineeId: t0.id } }, update: { status: "ACCEPTED" },
    create: { employerId: emp.id, traineeId: t0.id, status: "ACCEPTED", message: "We would like to talk.", includeContactInfo: false, respondedAt: new Date() },
  });
  let job = await prisma.jobPosting.findFirst({ where: { employerId: emp.id } });
  if (!job) job = await prisma.jobPosting.create({ data: { employerId: emp.id, title: "Junior Data Analyst", description: "Analyse data for clients.", closingDate: new Date(Date.now() + 30 * 864e5), status: "APPROVED" } });
  await prisma.platformSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  // org public profile + one event so Events/Explore have content
  const org = await prisma.trainingOrganization.findUniqueOrThrow({ where: { email: "org@dev.test" } });
  await prisma.organizationPublicProfile.upsert({ where: { trainingOrganizationId: org.id }, update: { publicEnabled: true }, create: { trainingOrganizationId: org.id, slug: "northwind-academy", tagline: "Practical data skills", description: "We teach data.", location: "Lagos", publicEnabled: true } });
  const ev = await prisma.organizationEvent.findFirst({ where: { trainingOrganizationId: org.id } });
  if (!ev) await prisma.organizationEvent.create({ data: { trainingOrganizationId: org.id, title: "Northwind open day", description: "Come and see.", startsAt: new Date(Date.now() + 5 * 864e5), locationText: "Lagos", status: "PUBLISHED" } });
  console.log("seed2 ok", { employer: emp.id, job: job.id });
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
