// Knowledge Quest, end to end against the private test database:
// instructor setup (pools, critical objectives, go-live rules), trainee practice
// (server-graded, XP, mastery, hints, daily cap), and the formal-assessment gates.
const { B, log, launch, device, cookiesFor, signedIn } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MARK = 'Quest check — AI Automation';

async function seed(traineeEmail) {
  const staff = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  // fresh start every run
  const old = await prisma.course.findMany({ where: { title: MARK } });
  for (const c of old) {
    const mods = await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } });
    const ids = mods.map((m) => m.id);
    await prisma.attempt.deleteMany({ where: { exam: { moduleId: { in: ids } } } });
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  const trainee = await prisma.trainee.findUnique({ where: { email: traineeEmail } });
  const course = await prisma.course.create({
    data: { title: MARK, description: 'Seeded for the Knowledge Quest check.', status: 'PUBLISHED', published: true, isFree: true, createdById: staff.id },
  });
  await prisma.courseEnrollment.upsert({
    where: { traineeId_courseId: { traineeId: trainee.id, courseId: course.id } },
    update: { unlockedAt: new Date() }, create: { traineeId: trainee.id, courseId: course.id, source: 'ADMIN_GRANTED', unlockedAt: new Date() },
  });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Automation basics', order: 0 } });
  const lesson = await prisma.lesson.create({ data: { moduleId: mod.id, title: 'What is a workflow?', order: 0 } });
  const material = await prisma.material.create({ data: { lessonId: lesson.id, type: 'VIDEO', title: 'Workflow primer', url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', order: 0 } }).catch(async () =>
    prisma.material.findFirst({ where: { lessonId: lesson.id } }));
  const exam = await prisma.exam.create({
    data: { code: 'QUEST-' + Math.random().toString(36).slice(2, 8).toUpperCase(), title: 'Automation basics — Assessment', moduleId: mod.id, createdById: staff.id, published: true, passMarkPercent: 80, durationMinutes: 30, randomizeQuestions: false, randomizeOptions: false },
  });
  const objectives = [];
  for (const [i, text] of ['Explain what a trigger is', 'Choose a suitable automation tool'].entries()) {
    objectives.push(await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text, order: i, confirmedById: staff.id } }));
  }
  let n = 0;
  for (const o of objectives) {
    for (let k = 0; k < 16; k++) {
      n++;
      const q = await prisma.question.create({
        data: {
          examId: exam.id, text: `Q${n}: ${o.text} — item ${k + 1}?`, explanation: `Because of reason ${n}.`, order: n,
          bankStatus: 'APPROVED', bankObjectiveId: o.id, needsReview: false,
          options: { create: [{ key: 'A', text: 'Right answer', isCorrect: true, order: 0 }, { key: 'B', text: 'Wrong one', order: 1 }, { key: 'C', text: 'Another wrong', order: 2 }] },
        },
      });
      if (material && k === 0) await prisma.questionSourceMaterial.create({ data: { questionId: q.id, materialId: material.id } }).catch(() => {});
    }
  }
  await prisma.xpEntry.deleteMany({ where: { traineeId: trainee.id } });
  return { course, mod, exam, objectives, trainee };
}

(async () => {
  const staffCk = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const trCk = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const { course, mod, exam, objectives, trainee } = await seed('t0@dev.test');
  const base = `/api/modules/${mod.id}`;

  // ---------- instructor side ----------
  let r = await api(staffCk, 'GET', `${base}/quest`);
  log(r.status === 200 && r.json.objectives.length === 2 && r.json.ready === false, 'instructor sees the module, not ready (no questions assigned to pools yet)');
  r = await api(staffCk, 'PUT', `${base}/quest`, { practiceEnabled: true });
  log(r.status === 409, 'practice cannot go live before both pools are big enough');
  r = await api(trCk, 'GET', `${base}/practice`);
  log(r.status === 404, 'trainee cannot open practice while it is off');
  r = await api(staffCk, 'POST', `${base}/quest`, { action: 'autoSplit' });
  const cov = r.json.objectives.map((o) => o.coverage);
  log(r.status === 200 && cov.every((c) => c.practice === 10 && c.formal === 6 && c.untagged === 0) && r.json.ready === true, 'auto-split gives each objective 10 practice and 6 formal questions, and the module becomes ready');
  r = await api(staffCk, 'PUT', `${base}/quest`, { criticalObjectiveIds: [objectives[0].id] });
  log(r.status === 200 && r.json.objectives[0].isCritical && !r.json.objectives[1].isCritical, 'an objective can be marked required for the assessment (mastery gate)');
  r = await api(staffCk, 'PUT', `${base}/quest`, { practiceEnabled: true });
  log(r.status === 200 && r.json.settings.practiceEnabled === true, 'practice goes live once ready');
  r = await api(trCk, 'POST', `${base}/quest`, { action: 'autoSplit' });
  log(r.status === 401 || r.status === 403, 'a trainee cannot use the instructor settings');

  // ---------- trainee practice (API) ----------
  r = await api(trCk, 'GET', `${base}/practice`);
  log(r.status === 200 && r.json.objectives.length === 2 && r.json.objectives.every((o) => o.mastery.state === 'NOT_STARTED' && o.questions === 10), 'trainee overview: two objectives, 10 practice questions each, not started');
  log(r.json.xp.dailyCap === 100 && r.json.level.level === 'EXPLORER', 'starts as Explorer with a 100 XP daily cap');

  r = await api(trCk, 'POST', `${base}/practice/next`, { objectiveId: objectives[0].id });
  const served = r.json;
  const leaked = JSON.stringify(served);
  log(r.status === 200 && served.done === false && served.question.options.length === 3 && !/isCorrect|correctOptionKey|Because of reason/.test(leaked), 'a question is served without the answer key or explanation');
  const formalPoolIds = (await prisma.question.findMany({ where: { examId: exam.id, bankPool: 'FORMAL' }, select: { id: true } })).map((q) => q.id);
  const servedRow = await prisma.practiceAnswer.findUnique({ where: { id: served.practiceAnswerId } });
  log(!formalPoolIds.includes(servedRow.questionId), 'practice never serves a formal-pool question');

  // answered too fast: wrong answer is graded, no XP
  r = await api(trCk, 'POST', `${base}/practice/answer`, { practiceAnswerId: served.practiceAnswerId, selectedKey: 'A' });
  log(r.status === 200 && r.json.correct === true && r.json.tooFast === true && r.json.xp.earned === 0, 'a correct answer given too fast earns no XP and is flagged');
  const again = await api(trCk, 'POST', `${base}/practice/answer`, { practiceAnswerId: served.practiceAnswerId, selectedKey: 'B' });
  log(again.json.repeated === true && again.json.correct === true, 'answering the same served question twice changes nothing');

  // normal pace answers: wait past the minimum time
  const goodAnswer = async (objectiveId, key = 'A', hint = false) => {
    const s = (await api(trCk, 'POST', `${base}/practice/next`, { objectiveId })).json;
    if (s.done) return { s, a: null };
    if (hint) await api(trCk, 'POST', `${base}/practice/hint`, { practiceAnswerId: s.practiceAnswerId });
    await sleep((s.minSeconds + 0.3) * 1000);
    const a = (await api(trCk, 'POST', `${base}/practice/answer`, { practiceAnswerId: s.practiceAnswerId, selectedKey: key })).json;
    return { s, a };
  };
  // Pre-age the recent window so the same question is not blocked; we have 10 questions so no reuse needed yet.
  const first = await goodAnswer(objectives[0].id);
  log(first.a.correct === true && first.a.xp.answer === 10 && first.a.tooFast === false, 'a correct answer at a normal pace earns 10 XP');
  const hinted = await goodAnswer(objectives[0].id, 'A', true);
  log(hinted.a.xp.answer === 5, 'a correct answer after a hint earns 5 XP');
  const wrong = await goodAnswer(objectives[0].id, 'B');
  log(wrong.a.correct === false && wrong.a.correctOptionKey === 'A' && wrong.a.xp.earned === 0 && !!wrong.a.explanation, 'a wrong answer earns nothing, then shows the right answer and explanation');
  const streak = await prisma.xpEntry.count({ where: { traineeId: trainee.id, kind: 'STREAK' } });
  log(streak === 0, 'no streak bonus on the first day');

  // one question pays once per day, whichever way it is reached
  const entries = await prisma.xpEntry.findMany({ where: { traineeId: trainee.id, kind: 'ANSWER' }, select: { dedupeKey: true } });
  log(new Set(entries.map((e) => e.dedupeKey)).size === entries.length && entries.length === 2, 'the XP ledger holds one entry per question per day');

  // ---------- mastery over days (simulate earlier days by back-dating answers) ----------
  const objId = objectives[1].id;
  const poolQs = await prisma.question.findMany({ where: { examId: exam.id, bankObjectiveId: objId, bankPool: 'PRACTICE' }, select: { id: true }, take: 6 });
  const back = (d) => new Date(Date.now() - d * 86_400_000);
  for (const [i, q] of poolQs.entries()) {
    await prisma.practiceAnswer.create({ data: { traineeId: trainee.id, moduleId: mod.id, objectiveId: objId, questionId: q.id, servedAt: back(i < 3 ? 3 : 1), answeredAt: back(i < 3 ? 3 : 1), selectedOptionKey: 'A', correct: true, secondsTaken: 20, tooFast: false } });
  }
  r = await api(trCk, 'GET', `${base}/practice`);
  const o2 = r.json.objectives.find((o) => o.id === objId);
  log(o2.mastery.state === 'MASTERED' && o2.mastery.distinctCorrect === 6 && o2.mastery.days === 2, 'six different questions correct on two separate days makes an objective mastered');
  const o1 = r.json.objectives.find((o) => o.id === objectives[0].id);
  log(o1.mastery.state !== 'MASTERED', 'an objective with one day of practice is not mastered');
  log(r.json.level.level === 'EXPLORER' || r.json.level.level === 'PROBLEM_SOLVER', 'level is reported');

  // ---------- daily cap ----------
  await prisma.xpEntry.create({ data: { traineeId: trainee.id, moduleId: mod.id, kind: 'ANSWER', points: 95, dayKey: new Date(Date.now() + 3600_000).toISOString().slice(0, 10), dedupeKey: 'TEST-CAP-' + Date.now() } });
  const capped = await goodAnswer(objectives[0].id);
  log(capped.a.correct === true && capped.a.xp.answer <= 5 && capped.a.xp.cappedByDailyLimit === true, 'the daily XP cap trims XP once the day is nearly full');

  // ---------- formal assessment gates ----------
  // practice-before-formal: needs 100% of objectives mastered; objective 1 is not
  r = await api(staffCk, 'PUT', `${base}/quest`, { practiceBeforeFormal: true, practiceRequiredPercent: 100 });
  r = await api(trCk, 'POST', `${base}/attempts`);
  log(r.status === 403 && /Practise first/.test(r.json.error), 'with "practice first" on, the assessment stays closed until enough objectives are mastered');
  const meta = (await api(trCk, 'GET', `${base}/assessment`)).json;
  log(meta.practiceRequired && meta.practiceRequired.masteredObjectives === 1, 'the assessment page is told what is still needed');
  // master objective 1 too, then it opens
  const q1 = await prisma.question.findMany({ where: { examId: exam.id, bankObjectiveId: objectives[0].id, bankPool: 'PRACTICE' }, select: { id: true }, take: 6 });
  for (const [i, q] of q1.entries()) {
    await prisma.practiceAnswer.create({ data: { traineeId: trainee.id, moduleId: mod.id, objectiveId: objectives[0].id, questionId: q.id, servedAt: back(i < 3 ? 4 : 2), answeredAt: back(i < 3 ? 4 : 2), selectedOptionKey: 'A', correct: true, secondsTaken: 20, tooFast: false } });
  }
  r = await api(trCk, 'POST', `${base}/attempts`);
  log(r.status === 200 && r.json.attemptId, 'once practice is enough, the assessment opens');
  const served2 = r.json.questions;
  const formalNow = new Set((await prisma.question.findMany({ where: { examId: exam.id, bankPool: 'FORMAL' }, select: { id: true } })).map((q) => q.id));
  log(served2.length === 12 && served2.every((q) => formalNow.has(q.id)), 'the assessment draws only formal-pool questions (12 of them, none from practice)');
  const unlock = await prisma.formalUnlock.count({ where: { traineeId: trainee.id, moduleId: mod.id } });
  log(unlock === 1, 'the unlock is remembered');

  // gate: critical objective 0 — get 100% overall except fail the critical one
  const attemptId = r.json.attemptId;
  const qs = await prisma.question.findMany({ where: { id: { in: served2.map((q) => q.id) } }, select: { id: true, bankObjectiveId: true, options: true } });
  for (const q of qs) {
    const right = q.options.find((o) => o.isCorrect).key;
    const wrongKey = q.options.find((o) => !o.isCorrect).key;
    // objective 0 (critical): answer 4 of 6 right (67% < 80%); objective 1: all right => overall (4+6)/12 = 83%
    const sameObj = qs.filter((x) => x.bankObjectiveId === q.bankObjectiveId);
    const idx = sameObj.indexOf(q);
    const pick = q.bankObjectiveId === objectives[0].id ? (idx < 4 ? right : wrongKey) : right;
    await api(trCk, 'POST', `/api/attempts/${attemptId}/answers`, { questionId: q.id, selectedOptionKey: pick });
  }
  r = await api(trCk, 'POST', `/api/attempts/${attemptId}/submit`);
  log(r.status === 200 && Math.round(r.json.percentage) === 83 && r.json.passed === false, 'overall 83% (above the 80% pass mark) still fails when a required objective is not cleared');
  log(Array.isArray(r.json.gateFailures) && r.json.gateFailures.length === 1 && /trigger/.test(r.json.gateFailures[0]), 'the result names the required objective to revise');

  // same answers but the objective is not critical => passes
  await api(staffCk, 'PUT', `${base}/quest`, { criticalObjectiveIds: [], practiceBeforeFormal: false });
  r = await api(trCk, 'POST', `${base}/attempts`);
  const att2 = r.json.attemptId;
  for (const q of r.json.questions) {
    const full = qs.find((x) => x.id === q.id) || (await prisma.question.findUnique({ where: { id: q.id }, include: { options: true } }));
    await api(trCk, 'POST', `/api/attempts/${att2}/answers`, { questionId: q.id, selectedOptionKey: full.options.find((o) => o.isCorrect).key });
  }
  r = await api(trCk, 'POST', `/api/attempts/${att2}/submit`);
  log(r.json.passed === true && r.json.percentage === 100, 'with no required objectives, a full score passes as before');

  // ---------- screens ----------
  await prisma.moduleQuestSettings.update({ where: { moduleId: mod.id }, data: { practiceBeforeFormal: false } });
  await prisma.practiceAnswer.deleteMany({ where: { traineeId: trainee.id, moduleId: mod.id, answeredAt: { lt: new Date(Date.now() - 3600_000) } } });
  const br = await launch();
  const ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${B}/trainee/courses/${course.id}`, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  if (!(await p.getByTestId('practice-strip').count())) await p.getByText('Automation basics').first().click().catch(() => {});
  await p.getByTestId('practice-strip').first().waitFor();
  log(true, 'the course page shows a Practice strip for the module');
  await p.goto(`${B}/trainee/courses/${course.id}/modules/${mod.id}/practice`, { waitUntil: 'load' });
  await p.getByRole('heading', { name: /Practice: Automation basics/ }).waitFor();
  const txt = await p.locator('main').innerText();
  log(/never counts\s+toward your certificate/.test(txt.replace(/\n/g, ' ')) , 'the practice screen says practice never counts toward the certificate');
  log(/explorer|problem solver/i.test(txt) && /streak/i.test(txt) && /xp today/i.test(txt), 'level, streak and XP today are shown');
  await p.screenshot({ path: '/tmp/dev/quest-overview-phone.png', fullPage: true });
  await p.getByRole('button', { name: 'Practise what needs work' }).click();
  await p.getByTestId('round-start').click();   // the round's welcome comes first; the question follows the countdown
  await p.getByRole('button', { name: 'Skip' }).click();
  await p.getByRole('button', { name: 'Check answer' }).waitFor();
  await p.getByRole('button', { name: 'Show a hint' }).click();
  await p.getByRole('note').waitFor();
  log(true, 'the hint button points to where the answer is taught');
  await p.locator('fieldset button[aria-pressed]').first().click();
  await sleep(4500);
  await p.getByRole('button', { name: 'Check answer' }).click();
  await p.getByText(/Correct|Not quite/).first().waitFor();
  log(true, 'checking an answer shows feedback');
  await p.screenshot({ path: '/tmp/dev/quest-question-phone.png', fullPage: true });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(overflow <= 1, 'no sideways scrolling at phone width');
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));

  // instructor page
  const sctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const sp = await sctx.newPage(); sp.setDefaultTimeout(20000);
  await sp.goto(`${B}/admin/modules/${mod.id}/quest`, { waitUntil: 'load' });
  await sp.getByRole('heading', { name: 'Practice and mastery' }).waitFor();
  const stxt = await sp.locator('main').innerText();
  log(/Practice 10\/10/.test(stxt) && /Formal 6\/6/.test(stxt), 'the instructor page shows pool coverage per objective');
  await sp.screenshot({ path: '/tmp/dev/quest-admin.png', fullPage: true });
  await br.close();

  await prisma.$disconnect();
  const fails = require('./lib.cjs').results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
