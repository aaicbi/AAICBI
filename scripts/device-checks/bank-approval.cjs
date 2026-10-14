// "Approve as-is" on a generated bank question must move it through the bank's gates, not just clear its review flag.
const { B, log, cookiesFor, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  for (const c of await prisma.course.findMany({ where: { title: 'Bank approval course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  const course = await prisma.course.create({ data: { title: 'Bank approval course', status: 'PUBLISHED', published: true, isFree: true, createdById: superUser.id } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Bank approval module', order: 0 } });
  const exam = await prisma.exam.create({ data: { code: 'BNK-' + Math.random().toString(36).slice(2, 8).toUpperCase(), title: 'Bank approval', moduleId: mod.id, createdById: superUser.id, published: true, passMarkPercent: 80, durationMinutes: 30 } });
  const obj = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Explain a trigger', order: 0, confirmedById: superUser.id } });
  const mk = (n, bankStatus, needsReview) => prisma.question.create({ data: { examId: exam.id, text: `Bank question ${n} about triggers?`, order: n, bankStatus, bankObjectiveId: obj.id, needsReview, options: { create: [{ key: 'A', text: 'Right', isCorrect: true, order: 0 }, { key: 'B', text: 'Wrong', order: 1 }] } } });
  const q1 = await mk(1, 'PENDING_REVIEW', true);
  const qFlag = await mk(2, 'VALIDATED_FLAGGED', true);
  const qWait = await mk(3, 'PENDING_VALIDATION', true);
  const qRej = await mk(4, 'REJECTED', true);
  const plain = await prisma.question.create({ data: { examId: exam.id, text: 'A hand-written question?', order: 5, needsReview: true, options: { create: [{ key: 'A', text: 'Yes', isCorrect: true, order: 0 }, { key: 'B', text: 'No', order: 1 }] } } });

  let r = await api(sa, 'PUT', `/api/questions/${q1.id}`, { approve: true });
  let row = await prisma.question.findUnique({ where: { id: q1.id } });
  log(r.status === 200 && row.bankStatus === 'PENDING_VALIDATION' && row.needsReview === true, 'approving a freshly generated question sends it to validation and keeps it out of exams');
  log((await prisma.questionBankEvent.count({ where: { questionId: q1.id, kind: 'GATE1_APPROVED' } })) === 1, 'and the bank records the approval');
  r = await api(sa, 'PUT', `/api/questions/${q1.id}`, { approve: true });
  log(r.status === 409 && /waiting for validation/i.test(r.json.error), 'approving it again says it is waiting for validation');
  r = await api(sa, 'PUT', `/api/questions/${qWait.id}`, { approve: true });
  log(r.status === 409, 'a question already queued for validation cannot be approved by hand');
  r = await api(sa, 'PUT', `/api/questions/${qFlag.id}`, { approve: true });
  row = await prisma.question.findUnique({ where: { id: qFlag.id } });
  log(r.status === 200 && row.bankStatus === 'APPROVED' && row.needsReview === false, 'a flagged question approved after validation goes live');
  r = await api(sa, 'PUT', `/api/questions/${qRej.id}`, { approve: true });
  log(r.status === 409, 'a rejected question cannot be approved');
  r = await api(sa, 'PUT', `/api/questions/${plain.id}`, { approve: true });
  row = await prisma.question.findUnique({ where: { id: plain.id } });
  log(r.status === 200 && row.needsReview === false && row.bankStatus === null, 'an ordinary question is still approved by clearing its flag');
  const q6 = await mk(6, 'PENDING_REVIEW', true);
  r = await api(staff, 'PUT', `/api/questions/${q6.id}`, { approve: true });
  log([403, 404].includes(r.status), 'staff cannot push a generated question through the bank');

  // the bank's own route now finds it at validation, and the studio counts it after validation passes
  r = await api(sa, 'POST', `/api/questions/${q6.id}/bank/gate1`, { action: 'approve' });
  log(r.status === 200, 'the Question bank page still approves a generated question for validation');
  await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
