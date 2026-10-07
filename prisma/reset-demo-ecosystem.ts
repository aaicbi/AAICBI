/**
 * Removes everything prisma/seed-demo-ecosystem.ts created and nothing
 * else: rows flagged isDemo, and accounts on the @demo.aaicbi.invalid
 * domain. Real data is never matched.
 *
 *   npm run db:reset-demo
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DOMAIN = "@demo.aaicbi.invalid";

async function main() {
  const orgs = await prisma.trainingOrganization.findMany({ where: { isDemo: true, email: { endsWith: DOMAIN } }, select: { id: true, staffUserId: true } });
  const staffIds = orgs.map((o) => o.staffUserId).filter((x): x is string => !!x);

  await prisma.educationPost.deleteMany({ where: { isDemo: true } });
  await prisma.courseEnrollment.deleteMany({ where: { OR: [{ trainee: { isDemo: true, email: { endsWith: DOMAIN } } }, { course: { isDemo: true, createdById: { in: staffIds } } }] } });
  await prisma.course.deleteMany({ where: { isDemo: true, createdById: { in: staffIds } } });
  await prisma.trainee.deleteMany({ where: { isDemo: true, email: { endsWith: DOMAIN } } });
  await prisma.organizationPublicProfile.deleteMany({ where: { isDemo: true } });
  await prisma.trainingOrganization.deleteMany({ where: { id: { in: orgs.map((o) => o.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: staffIds }, email: { endsWith: DOMAIN } } });

  const employers = await prisma.employer.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  await prisma.jobPosting.deleteMany({ where: { employerId: { in: employers.map((e) => e.id) } } });
  await prisma.employer.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.investor.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  console.log("Demo ecosystem data removed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
