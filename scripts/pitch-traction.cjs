// Read-only: prints the platform's real numbers for the pitch deck's Traction slide. Nothing is written.
//   DATABASE_URL=<production url> node scripts/pitch-traction.cjs
// Every figure below is a plain count or ratio from your own database, so each one can be opened and shown to a judge.
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const DAY = 86400000, now = Date.now(), since = (d) => new Date(now - d * DAY);
  const first = await p.trainee.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
  const weeks = first ? Math.max(1, Math.round((now - first.createdAt.getTime()) / (7 * DAY))) : 0;

  const [learners, learners30, orgsApproved, orgsAll, courses, enrolments, completedEnrol, attempts, passed, certs, plays, startups, employers, investors, events] = await Promise.all([
    p.trainee.count(),
    p.trainee.count({ where: { createdAt: { gte: since(30) } } }),
    p.trainingOrganization.count({ where: { approvedAt: { not: null } } }),
    p.trainingOrganization.count(),
    p.course.count({ where: { isDemo: false } }),
    p.courseEnrollment.count(),
    p.courseEnrollment.count({ where: { completedAt: { not: null } } }),
    p.attempt.count({ where: { status: 'SUBMITTED' } }),
    p.attempt.count({ where: { status: 'SUBMITTED', passed: true } }),
    p.certificate.count({ where: { revokedAt: null } }),
    p.gamePlay.count({ where: { answeredAt: { not: null } } }),
    p.startup.count({ where: { status: { not: 'DRAFT' } } }).catch(() => null),
    p.employer.count().catch(() => null),
    p.investor.count().catch(() => null),
    p.event.count({ where: { status: 'SCHEDULED' } }).catch(() => null),
  ]);

  // Active learners: anyone with a recorded login or lesson/assessment event in the window.
  const active = async (d) => (await p.analyticsEvent.findMany({ where: { recipientType: 'TRAINEE', createdAt: { gte: since(d) } }, select: { userId: true }, distinct: ['userId'] })).length;
  const [active7, active30] = await Promise.all([active(7), active(30)]);

  // Retention: of learners who joined 14–60 days ago, how many were active again in the last 14 days.
  const cohort = await p.trainee.findMany({ where: { createdAt: { gte: since(60), lte: since(14) } }, select: { id: true } });
  let retained = 0;
  if (cohort.length) {
    const back = await p.analyticsEvent.findMany({ where: { recipientType: 'TRAINEE', userId: { in: cohort.map((c) => c.id) }, createdAt: { gte: since(14) } }, select: { userId: true }, distinct: ['userId'] });
    retained = back.length;
  }
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');

  const rows = [
    ['Weeks since the first learner joined', weeks],
    ['Learners (registered trainees)', learners],
    ['  joined in the last 30 days', learners30],
    ['  active in the last 7 days', active7],
    ['  active in the last 30 days', active30],
    ['Training organisations (approved)', `${orgsApproved} of ${orgsAll} registered`],
    ['Courses (excluding demo courses)', courses],
    ['Enrolments', enrolments],
    ['  completed', `${completedEnrol} (${pct(completedEnrol, enrolments)})`],
    ['Assessment attempts submitted', attempts],
    ['  passed', `${passed} (${pct(passed, attempts)})`],
    ['Certificates issued (not revoked)', certs],
    ['Game questions answered', plays],
    ['Startups on the platform (not draft)', startups],
    ['Employers', employers],
    ['Investors', investors],
    ['Scheduled events', events],
    [`Retention: of ${cohort.length} learners who joined 14–60 days ago, active again in the last 14 days`, cohort.length ? `${retained} (${pct(retained, cohort.length)})` : 'n/a (no learners in that window)'],
  ];
  const w = Math.max(...rows.map((r) => r[0].length));
  console.log('\nAAICBI platform figures, ' + new Date().toISOString().slice(0, 10) + '\n');
  for (const [k, v] of rows) console.log(k.padEnd(w + 2) + v);
  console.log('\nDemo and test accounts are NOT filtered out of learner counts. Remove them first, or subtract them, before quoting a number.\n');
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
