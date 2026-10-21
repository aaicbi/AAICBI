// One-off correction: attempts that scored at or above their pass mark but were marked failed by the old
// "critical objective" mastery gate. Dry run by default; pass --apply to write.
//   DATABASE_URL=... node scripts/fix-gate-failed-attempts.cjs [--apply]
// Modules open on the trainee's next visit (the lock map is derived from passed attempts).
const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const apply = process.argv.includes('--apply');
  const rows = await prisma.attempt.findMany({
    where: { status: 'SUBMITTED', passed: false, percentage: { not: null }, exam: { moduleId: { not: null } } },
    select: { id: true, percentage: true, passMarkPercent: true, traineeId: true, exam: { select: { title: true, passMarkPercent: true } } },
  });
  const hit = rows.filter((a) => a.percentage >= (a.passMarkPercent ?? a.exam.passMarkPercent));
  for (const a of hit) console.log(`${apply ? 'fix ' : 'would fix '}${a.id} trainee=${a.traineeId} ${Math.round(a.percentage)}% (mark ${a.passMarkPercent ?? a.exam.passMarkPercent}) ${a.exam.title}`);
  if (apply && hit.length) await prisma.attempt.updateMany({ where: { id: { in: hit.map((a) => a.id) } }, data: { passed: true } });
  console.log(`${hit.length} attempt(s) ${apply ? 'corrected' : 'found (dry run; use --apply)'}`);
  await prisma.$disconnect();
})();
