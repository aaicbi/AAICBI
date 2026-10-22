// Read-only: explains why a trainee cannot open the next module of a course. Writes nothing.
//   DATABASE_URL=... node scripts/diagnose-module-access.cjs "<trainee name or email>" "<course title>"
const { PrismaClient } = require('@prisma/client');
(async () => {
  const [who, courseWords] = process.argv.slice(2);
  if (!who || !courseWords) { console.log('Usage: node scripts/diagnose-module-access.cjs "<trainee name or email>" "<course title>"'); process.exit(1); }
  const prisma = new PrismaClient();
  const say = (s = '') => console.log(s);
  const trainees = await prisma.trainee.findMany({
    where: { OR: [{ name: { contains: who, mode: 'insensitive' } }, { email: { contains: who, mode: 'insensitive' } }] },
    select: { id: true, name: true, email: true },
  });
  if (trainees.length !== 1) { say(`${trainees.length} trainees match "${who}":`); trainees.forEach((t) => say(`  ${t.id} ${t.name} <${t.email}>`)); say('Use a more specific name or the email.'); process.exit(0); }
  const t = trainees[0];
  const courses = await prisma.course.findMany({
    where: { title: { contains: courseWords, mode: 'insensitive' } },
    select: { id: true, title: true, status: true, isFree: true, freePreviewModuleCount: true, modules: { orderBy: { order: 'asc' }, select: { id: true, order: true, title: true, lessons: { select: { id: true } }, assessment: { select: { id: true, title: true, published: true, passMarkPercent: true } } } } },
  });
  if (courses.length !== 1) { say(`${courses.length} courses match "${courseWords}":`); courses.forEach((c) => say(`  ${c.id} ${c.title}`)); process.exit(0); }
  const c = courses[0];
  say(`Trainee: ${t.name} <${t.email}> (${t.id})`);
  say(`Course:  ${c.title} (${c.id}) status=${c.status} isFree=${c.isFree} freePreviewModuleCount=${c.freePreviewModuleCount}`);
  const findings = [];

  const enr = await prisma.courseEnrollment.findUnique({ where: { traineeId_courseId: { traineeId: t.id, courseId: c.id } } });
  say(`\nEnrollment: ${enr ? `source=${enr.source} unlockedAt=${enr.unlockedAt?.toISOString() ?? 'null'} accessRevokedAt=${enr.accessRevokedAt?.toISOString() ?? 'null'} currentPeriodEnd=${enr.currentPeriodEnd?.toISOString() ?? 'null'}` : 'NONE'}`);
  const grant = await prisma.growthGrant.findUnique({ where: { traineeId_courseId: { traineeId: t.id, courseId: c.id } } }).catch(() => null);
  if (grant) say(`Growth grant: ${grant.modules} module(s) free from a taster campaign`);
  const pays = await prisma.payment.findMany({ where: { traineeId: t.id, courseId: c.id }, select: { status: true, amountKobo: true, confirmedAt: true, initiatedAt: true } });
  say(`Payments: ${pays.length ? pays.map((p) => `${p.status} N${p.amountKobo / 100}`).join(', ') : 'none'}`);

  const fullAccess = !!enr && !!enr.unlockedAt && !enr.accessRevokedAt;
  if (!enr) findings.push('Not enrolled in this course at all.');
  else if (enr.accessRevokedAt) findings.push(`Access was revoked on ${enr.accessRevokedAt.toISOString()} (staff action or a lapsed subscription).`);
  else if (!enr.unlockedAt) {
    if (enr.source === 'PREVIEW' || grant) findings.push(`PAYMENT LOCK: this is a free preview / taster enrolment (not unlocked). Only the first ${Math.max(grant?.modules ?? 0, c.freePreviewModuleCount ?? 0)} module(s) are open; Module 2 opens only after payment (or a scholarship seat). Passing Module 1 does not lift this by design.`);
    else findings.push('Enrolment exists but is not unlocked (never paid / never verified).');
  }

  say('\nModules:');
  const mods = c.modules;
  const att = await prisma.attempt.findMany({ where: { traineeId: t.id, exam: { moduleId: { in: mods.map((m) => m.id) } } }, orderBy: { startedAt: 'asc' }, select: { id: true, examId: true, status: true, passed: true, percentage: true, passMarkPercent: true, submittedAt: true, attemptNumber: true, exam: { select: { moduleId: true, passMarkPercent: true } } } });
  const done = await prisma.moduleCompletion.findMany({ where: { traineeId: t.id, moduleId: { in: mods.map((m) => m.id) } }, select: { moduleId: true, completedAt: true } });
  const lessonsDone = await prisma.lessonProgress.findMany({ where: { traineeId: t.id, lessonId: { in: mods.flatMap((m) => m.lessons.map((l) => l.id)) } }, select: { lessonId: true } });
  const doneLessons = new Set(lessonsDone.map((l) => l.lessonId));
  mods.forEach((m, i) => {
    const a = att.filter((x) => x.exam.moduleId === m.id);
    const sticky = done.find((d) => d.moduleId === m.id);
    const lessonsN = m.lessons.filter((l) => doneLessons.has(l.id)).length;
    say(`  ${i + 1}. ${m.title}  [assessment: ${m.assessment ? (m.assessment.published ? `published, pass mark ${m.assessment.passMarkPercent}%` : 'NOT published') : 'none'}] lessons ${lessonsN}/${m.lessons.length}  completion row: ${sticky ? sticky.completedAt.toISOString() : 'none'}`);
    a.forEach((x) => say(`       attempt #${x.attemptNumber} ${x.status} ${x.percentage == null ? '-' : Math.round(x.percentage) + '%'} passed=${x.passed} (mark ${x.passMarkPercent ?? x.exam.passMarkPercent}) ${x.submittedAt?.toISOString() ?? ''}`));
  });

  const m1 = mods[0];
  if (m1 && mods[1]) {
    const a = att.filter((x) => x.exam.moduleId === m1.id);
    const passed = a.some((x) => x.status === 'SUBMITTED' && x.passed === true);
    const sticky = done.some((d) => d.moduleId === m1.id);
    const gateFailed = a.filter((x) => x.status === 'SUBMITTED' && x.passed === false && x.percentage != null && x.percentage >= (x.passMarkPercent ?? x.exam.passMarkPercent));
    if (!m1.assessment) findings.push('Module 1 has no assessment record; completion depends on finishing every lesson.');
    else if (!m1.assessment.published) findings.push('Module 1 assessment is not published, so completion falls back to finishing every lesson.');
    if (!passed && !sticky && gateFailed.length) findings.push(`OLD GATE BUG: ${gateFailed.length} attempt(s) scored at or above the pass mark but are stored as passed=false (the old critical-objective gate). Run scripts/fix-gate-failed-attempts.cjs --apply on production, and make sure the fix (PR #114) is actually deployed.`);
    if (!passed && !sticky && !gateFailed.length) {
      const inProg = a.filter((x) => x.status !== 'SUBMITTED');
      if (inProg.length) findings.push(`The high score is on an attempt that is still ${inProg[0].status} (not submitted), so it does not count.`);
      else if (!a.length) findings.push('No attempt on the Module 1 assessment at all. The 92% may be on a different exam (a practice quiz, a standalone exam or another course).');
      else findings.push('Attempts exist but none is SUBMITTED with passed=true.');
    }
    if ((passed || sticky) && fullAccess) findings.push('Module 1 is complete and the enrolment is fully unlocked. The server would open Module 2. If the trainee still cannot see it, the page is stale (ask for a refresh or a fresh sign-in) or production is running older code.');
  }

  say('\nFINDINGS');
  if (!findings.length) say('  Nothing blocking found in the data.'); else findings.forEach((f) => say('  - ' + f));
  await prisma.$disconnect();
})();
