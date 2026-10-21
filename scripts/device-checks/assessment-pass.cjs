// A module assessment is passed by reaching the pass mark, and nothing else. Builds a small course in the local test database (two modules, a
// critical objective that the trainee will mostly miss, a published assessment) and takes it as a real trainee over HTTP.
// Needs the app on :3113 (see docs/events.md for how the checks are run).
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const { B, cookiesFor, clearThrottle } = require('./lib.cjs');
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };

async function api(cookie, method, path, body) {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
}

(async () => {
  clearThrottle();
  const admin = await prisma.user.findFirstOrThrow({ where: { email: 'super@dev.test' } });
  const trainee = await prisma.trainee.findFirstOrThrow({ where: { email: 't11@dev.test' } });
  const cookie = (await cookiesFor('/api/auth/trainee-login', 't11@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  // clean any earlier run
  const old = await prisma.course.findMany({ where: { title: 'ZZ Pass rule course' }, select: { id: true } });
  const wipe = async (id) => { await prisma.attempt.deleteMany({ where: { exam: { courseModule: { courseId: id } } } }); await prisma.exam.deleteMany({ where: { courseModule: { courseId: id } } }); await prisma.course.delete({ where: { id } }); };
  for (const c of old) await wipe(c.id);

  const course = await prisma.course.create({ data: { title: 'ZZ Pass rule course', createdById: admin.id, published: true, status: 'PUBLISHED' } }).catch(async () => prisma.course.create({ data: { title: 'ZZ Pass rule course', createdById: admin.id } }));
  await prisma.course.update({ where: { id: course.id }, data: { published: true } }).catch(() => undefined);
  const m1 = await prisma.module.create({ data: { courseId: course.id, title: 'Module 1', order: 1 } });
  const m2 = await prisma.module.create({ data: { courseId: course.id, title: 'Module 2', order: 2 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: m1.id, title: 'Lesson 1', order: 1 } });
  await prisma.lesson.create({ data: { moduleId: m2.id, title: 'Lesson 2', order: 1 } });
  const obj = {};
  for (const [k, text, critical] of [['A', 'Critical objective A', true], ['B', 'Objective B', false], ['C', 'Objective C', false]]) {
    obj[k] = await prisma.moduleLearningObjective.create({ data: { moduleId: m1.id, text, order: k.charCodeAt(0), confirmedById: admin.id, isCritical: critical } });
  }
  const exam = await prisma.exam.create({ data: { code: 'ZZPASS' + Date.now().toString(36), title: 'Module 1 assessment', createdById: admin.id, moduleId: m1.id, published: true, passMarkPercent: 80, durationMinutes: 30, showResultImmediately: true, randomizeQuestions: true } });
  // 10 questions: 3 on critical objective A, 3 on B, 4 on C. Correct option is always "A".
  const plan = [['A', 3], ['B', 3], ['C', 4]];
  const qs = [];
  for (const [o, n] of plan) for (let i = 1; i <= n; i++) {
    const q = await prisma.question.create({ data: { examId: exam.id, text: `${o}${i}?`, bankObjectiveId: obj[o].id, bankPool: 'FORMAL', order: qs.length + 1, options: { create: [{ key: 'A', text: 'right', isCorrect: true, order: 1 }, { key: 'B', text: 'wrong', isCorrect: false, order: 2 }] } } });
    qs.push({ id: q.id, objective: o });
  }
  const exam2 = await prisma.exam.create({ data: { code: 'ZZPASS2' + Date.now().toString(36), title: 'Module 2 assessment', createdById: admin.id, moduleId: m2.id, published: true, passMarkPercent: 80, durationMinutes: 30, showResultImmediately: true } });
  await prisma.question.create({ data: { examId: exam2.id, text: 'M2?', bankPool: 'FORMAL', order: 1, options: { create: [{ key: 'A', text: 'right', isCorrect: true, order: 1 }, { key: 'B', text: 'wrong', isCorrect: false, order: 2 }] } } });
  await prisma.courseEnrollment.create({ data: { traineeId: trainee.id, courseId: course.id, source: 'FREE', unlockedAt: new Date() } });
  await prisma.lessonProgress.create({ data: { lessonId: lesson.id, traineeId: trainee.id } });

  // Takes the assessment, answering the first `count` questions of objective `missObjective` wrongly and everything else correctly.
  const takeAttempt = async (missObjective, count) => {
    const start = await api(cookie, 'POST', `/api/modules/${m1.id}/attempts`, {});
    if (start.s !== 200) throw new Error('could not start: ' + JSON.stringify(start));
    const served = start.j.questions;
    ok(served.length === 10 && new Set(served.map((q) => qs.find((x) => x.id === q.id).objective)).size === 3, 'the assessment asks all 10 questions, covering all three objectives');
    let missed = 0;
    for (const sq of served) {
      const wrong = qs.find((q) => q.id === sq.id).objective === missObjective && missed < count;
      if (wrong) missed++;
      await api(cookie, 'POST', `/api/attempts/${start.j.attemptId}/answers`, { questionId: sq.id, selectedOptionKey: wrong ? 'B' : 'A' });
    }
    return { start, sub: await api(cookie, 'POST', `/api/attempts/${start.j.attemptId}/submit`, {}) };
  };

  // Objective A is the critical one and has only 3 questions: missing 2 of them used to fail the whole assessment despite 80%.
  const first = await takeAttempt('A', 2);
  ok(first.sub.s === 200 && Math.round(first.sub.j.percentage) === 80, 'two wrong answers out of ten is 80%');
  ok(first.sub.j.passed === true, '80% passes, even though most of the "critical" objective was missed');
  ok(Number(await prisma.moduleCompletion.count({ where: { traineeId: trainee.id, moduleId: m1.id } })) === 1, 'passing completes the module straight away');
  const second = await api(cookie, 'POST', `/api/modules/${m2.id}/attempts`, {});
  ok(second.s === 200, 'the next module is open as soon as the assessment is passed (no "complete the previous module first")');

  // A real fail still fails: 3 wrong of 10 is 70%.
  await prisma.attempt.deleteMany({ where: { examId: exam.id } });
  await prisma.moduleCompletion.deleteMany({ where: { traineeId: trainee.id, moduleId: m1.id } });
  const fail1 = await takeAttempt('C', 3);
  ok(Math.round(fail1.sub.j.percentage) === 70 && fail1.sub.j.passed === false, '70% does not pass');
  const locked = await api(cookie, 'POST', `/api/modules/${m2.id}/attempts`, {});
  ok(locked.s === 403, 'and the next module stays closed (got ' + locked.s + ' ' + JSON.stringify(locked.j).slice(0, 120) + ')');

  await prisma.attempt.deleteMany({ where: { examId: exam.id } });
  // Exactly at the pass mark counts: 8 of 10.
  const exact = await takeAttempt('B', 2);
  ok(exact.sub.j.passed === true && Math.round(exact.sub.j.percentage) === 80, 'exactly 80% passes');

  await wipe(course.id);
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(2); });
