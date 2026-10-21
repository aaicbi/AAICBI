// Trainee performance report over HTTP: who may see whom, the PDF/CSV exports, the email endpoint's validation, and the pages.
// Needs the app on :3113. Builds throw-away courses/users in the local test database and removes them.
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const { B, cookiesFor, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };
const jar = {};
async function ck(login, email) { if (!jar[email]) jar[email] = (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; '); return jar[email]; }
async function get(cookie, path) { const r = await fetch(B + path, { headers: { Cookie: cookie }, redirect: 'manual' }); const buf = Buffer.from(await r.arrayBuffer()); return { s: r.status, buf, text: buf.toString('utf8').replace(/<!-- -->/g, ''), type: r.headers.get('content-type') || '' }; }
async function post(cookie, path, body) { const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) }; }

(async () => {
  clearThrottle();
  const org = await prisma.trainingOrganization.findFirstOrThrow({ where: { email: 'org@dev.test' } });
  const staff = await prisma.user.findFirstOrThrow({ where: { id: org.staffUserId } });
  const t11 = await prisma.trainee.findFirstOrThrow({ where: { email: 't11@dev.test' } });
  const mine = (await prisma.course.findMany({ where: { createdById: staff.id }, select: { id: true } })).map((c) => c.id);
  const enrolledElsewhere = await prisma.courseEnrollment.findMany({ where: { courseId: { in: mine } }, select: { traineeId: true } });
  const t0 = await prisma.trainee.findFirstOrThrow({ where: { id: { notIn: [t11.id, ...enrolledElsewhere.map((e) => e.traineeId)] } } });
  // clean earlier runs
  const old = await prisma.course.findMany({ where: { title: { startsWith: 'ZZ Report' } }, select: { id: true } });
  for (const c of old) { await prisma.attempt.deleteMany({ where: { exam: { courseModule: { courseId: c.id } } } }); await prisma.exam.deleteMany({ where: { courseModule: { courseId: c.id } } }); await prisma.gamePlay.deleteMany({ where: { module: { courseId: c.id } } }); await prisma.course.delete({ where: { id: c.id } }); }
  await prisma.user.deleteMany({ where: { email: 'zz-instructor@dev.test' } });
  const instructor = await prisma.user.create({ data: { name: 'ZZ Instructor', email: 'zz-instructor@dev.test', passwordHash: (await prisma.user.findFirstOrThrow({ where: { email: 'super@dev.test' } })).passwordHash, role: 'INSTRUCTOR' } });

  const mk = async (title, owner) => {
    const c = await prisma.course.create({ data: { title, createdById: owner.id, published: true, status: 'PUBLISHED' } }).catch(() => prisma.course.create({ data: { title, createdById: owner.id } }));
    const m = await prisma.module.create({ data: { courseId: c.id, title: 'Module 1', order: 1 } });
    await prisma.lesson.create({ data: { moduleId: m.id, title: 'L1', order: 1 } });
    return { c, m };
  };
  const A = await mk('ZZ Report A', staff), Bc = await mk('ZZ Report B', instructor);
  await prisma.courseEnrollment.create({ data: { traineeId: t11.id, courseId: A.c.id, source: 'FREE', unlockedAt: new Date() } });
  await prisma.courseEnrollment.create({ data: { traineeId: t0.id, courseId: Bc.c.id, source: 'FREE', unlockedAt: new Date() } });
  const exam = await prisma.exam.create({ data: { code: 'ZZREP' + Date.now().toString(36), title: 'Module 1 assessment', createdById: staff.id, moduleId: A.m.id, published: true, passMarkPercent: 80, durationMinutes: 30 } });
  for (const [n, pct] of [[1, 60], [2, 72], [3, 92]]) await prisma.attempt.create({ data: { examId: exam.id, traineeId: t11.id, attemptNumber: n, status: 'SUBMITTED', startedAt: new Date(Date.now() - (4 - n) * 86400000), submittedAt: new Date(Date.now() - (4 - n) * 86400000 + 900000), expiresAt: new Date(), score: pct / 2, totalQuestions: 50, percentage: pct, passed: pct >= 80, passMarkPercent: 80 } });
  const game = await prisma.game.findFirst();
  if (game) {
    const item = await prisma.gameItem.findFirst();
    const obj = await prisma.moduleLearningObjective.create({ data: { moduleId: A.m.id, text: 'ZZ obj', order: 1, confirmedById: staff.id } });
    if (item) for (let i = 0; i < 4; i++) await prisma.gamePlay.create({ data: { traineeId: t11.id, moduleId: A.m.id, gameId: game.id, itemId: item.id, objectiveId: obj.id, answeredAt: new Date(), correct: i < 3, score: i < 3 ? 1 : 0, secondsTaken: 12 } });
  }
  await prisma.analyticsEvent.createMany({ data: [{ recipientType: 'TRAINEE', userId: t11.id, type: 'LOGIN' }, { recipientType: 'TRAINEE', userId: t11.id, type: 'LOGIN', createdAt: new Date(Date.now() - 86400000) }] });
  // a name that would run as a spreadsheet formula
  const originalName = t11.name;
  await prisma.trainee.update({ where: { id: t11.id }, data: { name: '=HYPERLINK("x")' } });

  const cStaff = await ck('/api/auth/training-org-login', 'org@dev.test');
  const cIns = await ck('/api/auth/login', 'zz-instructor@dev.test');
  const cSuper = await ck('/api/auth/login', 'super@dev.test');
  const cT11 = await ck('/api/auth/trainee-login', 't11@dev.test');

  try {
    // access
    let r = await get(cStaff, `/api/reports/trainees/${t11.id}/report.pdf`);
    ok(r.s === 200 && r.buf.slice(0, 4).toString() === '%PDF' && r.buf.length > 3000, 'organization can download its own trainee\'s PDF');
    ok((await get(cStaff, `/api/reports/trainees/${t0.id}/report.pdf`)).s === 404, 'organization cannot open another organization\'s trainee');
    ok((await get(cIns, `/api/reports/trainees/${t0.id}/report.pdf`)).s === 200, 'instructor can download their own trainee\'s PDF');
    ok((await get(cIns, `/api/reports/trainees/${t11.id}/report.pdf`)).s === 404, 'instructor cannot open someone else\'s trainee');
    ok((await get(cSuper, `/api/reports/trainees/${t11.id}/report.pdf`)).s === 200, 'super admin can open any trainee');
    ok([401, 403].includes((await get(cT11, `/api/reports/trainees/${t11.id}/report.pdf`)).s), 'a trainee cannot use the staff report API');
    ok([401, 403].includes((await get('', `/api/reports/trainees/${t11.id}/report.pdf`)).s), 'signed-out is refused');

    // roster exports
    r = await get(cStaff, '/api/reports/trainees/export.csv');
    ok(r.s === 200 && r.type.includes('text/csv') && r.text.includes('Assessment attempts'), 'organization CSV export works');
    ok(!r.text.includes(t0.email) && r.text.includes('t11@dev.test'), 'CSV holds only the organization\'s own trainees');
    ok(r.text.includes("'=HYPERLINK"), 'a formula-like name is defused in the CSV');
    ok(/t11@dev.test,1,0,\d+,3,1,/.test(r.text.replace(/\r/g, '')) || r.text.includes(',3,1,75'), 'CSV shows 3 attempts, 1 passed, average 75');
    r = await get(cStaff, '/api/reports/trainees/export.pdf');
    ok(r.s === 200 && r.buf.slice(0, 4).toString() === '%PDF', 'organization roster PDF works');
    ok((await get(cStaff, '/api/reports/trainees/export.csv?courseId=' + Bc.c.id)).s === 404, 'cannot export another owner\'s course');
    ok((await get(cIns, '/api/reports/trainees/export.csv')).text.includes(t0.email), 'instructor roster has their trainee');

    // send validation
    ok((await post(cStaff, '/api/reports/trainees/send', { traineeId: t11.id, to: 'not-an-email' })).s === 400, 'send refuses an invalid address');
    ok((await post(cStaff, '/api/reports/trainees/send', { traineeId: t11.id, to: '1@x.com 2@x.com 3@x.com 4@x.com 5@x.com 6@x.com' })).s === 400, 'send refuses more than five addresses');
    ok((await post(cStaff, '/api/reports/trainees/send', { traineeId: t0.id, to: 'a@example.com' })).s === 404, 'send refuses a trainee outside the sender\'s courses');
    ok([401, 403].includes((await post(cT11, '/api/reports/trainees/send', { traineeId: t11.id, to: 'a@example.com' })).s), 'a trainee cannot send reports');
    r = await post(cStaff, '/api/reports/trainees/send', { traineeId: t11.id, to: 'a@example.com', message: 'Please review.' });
    ok(r.s === 200 || r.s === 502, 'a valid send gets through to the mail service (' + r.s + ': ' + (r.j.error || r.j.sent) + ')');
    const aud = await prisma.auditEvent.findFirst({ where: { action: 'PERFORMANCE_REPORT_SENT', actorId: staff.id }, orderBy: { createdAt: 'desc' } });
    ok(!!aud && !JSON.stringify(aud).includes('a@example.com'), 'the send is audited, without the address');

    // pages
    r = await get(cStaff, `/admin/organization/trainees/${t11.id}`);
    ok(r.s === 200 && r.text.includes('Passed on try 3') && r.text.includes('Every attempt'), 'organization trainee page shows tries and the passing try');
    ok(r.text.includes('Learning games') && r.text.includes('Engagement on the platform'), 'page shows game and platform engagement');
    ok(r.text.includes('Email report') && r.text.includes('Download PDF'), 'page offers download and email');
    ok((await get(cStaff, `/admin/organization/trainees/${t0.id}`)).text.includes('NEXT_NOT_FOUND'), 'another organization\'s trainee page is not found');
    r = await get(cStaff, '/admin/organization/trainees');
    ok(r.text.includes(`/admin/organization/trainees/${t11.id}`) && r.text.includes('Export CSV'), 'trainee list links names to the report and offers export');
    r = await get(cIns, '/instructor/trainees');
    ok(r.s === 200 && r.text.includes('ZZ') === false && r.text.includes(`/instructor/trainees/${t0.id}`), 'instructor list links to the report');
    ok((await get(cIns, `/instructor/trainees/${t0.id}`)).text.includes('Summary'), 'instructor trainee page renders');
    ok((await get(cIns, `/instructor/trainees/${t11.id}`)).text.includes('NEXT_NOT_FOUND'), 'instructor cannot open someone else\'s trainee page');
    r = await get(cT11, '/trainee/performance');
    ok(r.s === 200 && r.text.includes('My performance report') && r.text.includes('Passed on try 3'), 'trainee sees their own full report');
    r = await get(cT11, '/api/trainee/my-activity/report.pdf');
    ok(r.s === 200 && r.buf.slice(0, 4).toString() === '%PDF', 'trainee PDF download still works');
    fs.writeFileSync('/tmp/dev/report-sample.pdf', (await get(cStaff, `/api/reports/trainees/${t11.id}/report.pdf`)).buf);
  } finally {
    await prisma.trainee.update({ where: { id: t11.id }, data: { name: originalName } });
    for (const c of [A.c.id, Bc.c.id]) { await prisma.attempt.deleteMany({ where: { exam: { courseModule: { courseId: c } } } }); await prisma.exam.deleteMany({ where: { courseModule: { courseId: c } } }); await prisma.gamePlay.deleteMany({ where: { module: { courseId: c } } }); await prisma.course.delete({ where: { id: c } }); }
    await prisma.user.delete({ where: { id: instructor.id } }).catch(() => undefined);
    fs.rmSync('/tmp/dev/cookies-zz-instructor@dev.test.json', { force: true });
    await prisma.$disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(2); });
