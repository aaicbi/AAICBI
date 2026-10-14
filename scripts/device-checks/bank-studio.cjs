// The question bank inside the Game Studio: a writer model and a DIFFERENT reviewer model, automatic review before a person
// looks, one approval that also splits the pools, Loop's access to the bank, and the studio panel. Run against the private test
// database and the stand-in Claude API (the stand-in answers like a reviewer: it disagrees with a question that says TRAP/WRONG
// and calls one that says AMBIG ambiguous).
const { B, log, launch, device, cookiesFor, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
async function chat(cookie, { message, level, studio }) {
  const form = new FormData();
  form.set('message', message); if (level) form.set('level', String(level)); if (studio) form.set('studio', JSON.stringify(studio));
  const res = await fetch(B + '/api/admin/loop/chat', { method: 'POST', headers: { Cookie: cookie }, body: form });
  if (!res.ok) return { status: res.status, events: [], cards: [], text: '' };
  const events = []; const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2); if (!line) continue; events.push(JSON.parse(line.slice(6))); } }
  return { status: 200, events, cards: events.filter((e) => e.type === 'action').map((e) => e.card), text: events.filter((e) => e.type === 'text').map((e) => e.delta).join('') };
}
const fakeLog = () => fs.readFileSync('/tmp/fakeclaude-stream.log', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

const DETAIL = (extra = {}) => ({ correctness: { agrees: false, verifiedOptionIndex: 1, originalOptionIndex: 0 }, alignment: { aligned: true, reason: null }, ambiguity: { ambiguous: false, reason: null }, duplicate: null, reviewedBy: 'claude-opus-5-5', ...extra });

(async () => {
  fs.writeFileSync('/tmp/fakeclaude-stream.log', ''); clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@dev.test' } });
  for (const title of ['Bank studio course', 'Bank staff course']) for (const c of await prisma.course.findMany({ where: { title } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null, loopMaxLevel: 3, loopLevel: 3 } });

  async function world(courseTitle, moduleTitle, owner) {
    const course = await prisma.course.create({ data: { title: courseTitle, status: 'PUBLISHED', published: true, isFree: true, createdById: owner.id } });
    const mod = await prisma.module.create({ data: { courseId: course.id, title: moduleTitle, order: 0 } });
    const exam = await prisma.exam.create({ data: { code: 'BNS-' + Math.random().toString(36).slice(2, 8).toUpperCase(), title: moduleTitle + ' assessment', moduleId: mod.id, createdById: owner.id, published: false, passMarkPercent: 80, durationMinutes: 30 } });
    const o1 = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Explain what a trigger is', order: 0, confirmedById: superUser.id } });
    const o2 = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Choose a suitable automation tool', order: 1, confirmedById: superUser.id } });
    let n = 0;
    const mk = (o, text, bankStatus, extra = {}) => prisma.question.create({ data: { examId: exam.id, text, order: ++n, bankStatus, bankObjectiveId: o.id, needsReview: bankStatus !== 'APPROVED', options: { create: [{ key: 'A', text: 'Right', isCorrect: true, order: 0 }, { key: 'B', text: 'Wrong', order: 1 }] }, ...extra } });
    return { course, mod, exam, o1, o2, mk };
  }
  const W = await world('Bank studio course', 'Bank studio module', superUser);
  const M = W.mod.id;
  const pass = []; for (let i = 1; i <= 4; i++) pass.push(await W.mk(W.o1, `Passed question ${i} about triggers?`, 'VALIDATED_PASS'));
  const flagged = await W.mk(W.o1, 'FLAGME-WRONG question about triggers?', 'VALIDATED_FLAGGED');
  await prisma.questionBankEvent.create({ data: { questionId: flagged.id, fromStatus: 'PENDING_REVIEW', toStatus: 'VALIDATED_FLAGGED', kind: 'INDEPENDENT_VALIDATION_REJECTED', detail: DETAIL(), actedById: null } });
  const waiting = await W.mk(W.o1, 'FLAGME-AMBIG waiting question about triggers?', 'PENDING_REVIEW');
  for (let i = 1; i <= 6; i++) await W.mk(W.o2, `Approved formal ${i} about tools?`, 'APPROVED', { bankPool: 'FORMAL' });
  for (let i = 1; i <= 10; i++) await W.mk(W.o2, `Approved practice ${i} about tools?`, 'APPROVED', { bankPool: 'PRACTICE' });
  await prisma.question.create({ data: { examId: W.exam.id, text: 'An older hand-written question?', order: 99, needsReview: false, options: { create: [{ key: 'A', text: 'Yes', isCorrect: true, order: 0 }, { key: 'B', text: 'No', order: 1 }] } } });

  // ---------- the bank, as the studio sees it ----------
  let r = await api(sa, 'GET', `/api/admin/studio/modules/${M}/bank`);
  const o1 = r.json.objectives.find((o) => o.id === W.o1.id); const o2 = r.json.objectives.find((o) => o.id === W.o2.id);
  log(r.status === 200 && r.json.models.independent === true && r.json.models.generator !== r.json.models.reviewer, 'one model writes and a different model reviews');
  log(r.json.totals.ready === 4 && r.json.totals.flagged === 1 && r.json.totals.awaiting === 1 && r.json.legacyCount === 1, 'the bank counts what passed, what was flagged, what waits, and older questions');
  log(o1.need === 10 && o2.need === 0, 'it works out how many more questions each objective needs');
  const fq = r.json.questions.find((q) => q.id === flagged.id);
  log(fq.bucket === 'FLAGGED' && /option B/.test(fq.reasons[0]) && fq.reviewedBy === 'claude-opus-5-5', 'a flagged question says why, in plain words, and which model reviewed it');

  // ---------- who may use it ----------
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'review' });
  log(r.status === 403 || r.status === 404, 'staff cannot work another person’s bank');
  r = await api(staff, 'GET', `/api/admin/studio/modules/${M}/bank`);
  log(r.status === 404, 'nor read it');

  // ---------- review: automatic, by the reviewer model ----------
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'review' });
  log(r.status === 200 && r.json.validated === 1 && r.json.needsReview === 1 && r.json.remaining === 0, 'the reviewer checks the waiting question and flags the ambiguous one');
  const calls = fakeLog().filter((c) => c.stream === false || c.stream === undefined);
  log(calls.length >= 2 && calls.every((c) => c.model === 'claude-opus-5-5'), 'every review call went to the reviewer model, never the writer’s');
  let row = await prisma.question.findUnique({ where: { id: waiting.id } });
  log(row.bankStatus === 'VALIDATED_FLAGGED' && row.needsReview === true, 'a flagged question stays out of exams and practice');

  // ---------- one approval ----------
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve', allPassed: true });
  const nowApproved = await prisma.question.findMany({ where: { id: { in: pass.map((p) => p.id) } } });
  log(r.status === 200 && r.json.approved === 4 && nowApproved.every((q) => q.bankStatus === 'APPROVED' && q.needsReview === false), 'one click approves everything that passed');
  log(nowApproved.every((q) => q.bankPool !== null) && r.json.split.practice + r.json.split.formal === 4, 'and puts them straight into the practice and formal pools');
  row = await prisma.question.findUnique({ where: { id: flagged.id } });
  log(row.bankStatus === 'VALIDATED_FLAGGED', 'a flagged question is never approved in bulk');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve', allPassed: true });
  log(r.status === 200 && r.json.approved === 0, 'approving again changes nothing');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve', ids: [flagged.id] });
  row = await prisma.question.findUnique({ where: { id: flagged.id } });
  log(r.json.approved === 1 && row.bankStatus === 'APPROVED' && row.bankPool !== null, 'a person can approve a flagged question anyway, one at a time');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve' });
  log(r.status === 400, 'approving needs a choice');

  // ---------- edit and reject ----------
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'edit', id: waiting.id, text: 'A clear rewritten question about triggers?', options: [{ text: 'Right', isCorrect: true }, { text: 'Wrong', isCorrect: false }] });
  row = await prisma.question.findUnique({ where: { id: waiting.id } });
  log(r.status === 200 && row.bankStatus === 'VALIDATED_PASS' && row.text.startsWith('A clear rewritten'), 'editing a flagged question has the reviewer check it again, and it can now pass');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'edit', id: waiting.id, text: 'x', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] });
  log(r.status === 400, 'an edit with two correct answers is refused');
  const doomed = await W.mk(W.o1, 'Reject me please?', 'VALIDATED_FLAGGED');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'reject', ids: [doomed.id] });
  row = await prisma.question.findUnique({ where: { id: doomed.id } });
  log(r.json.rejected === 1 && row.bankStatus === 'REJECTED', 'a question can be thrown out');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'generate', objectiveId: W.o1.id, count: 5 });
  log(r.status === 409 && /No usable materials/.test(r.json.error), 'asking for questions on a module with nothing to read gives a plain reason');

  // ---------- Loop reads and approves, from the studio chat ----------
  r = await chat(sa, { message: 'BANK:Bank studio module', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.status === 200 && /BANK-READ/.test(r.text) && /claude-opus-5-5/.test(r.text), 'Loop can read the bank and say which model reviews');
  const freshPass = await W.mk(W.o1, 'A fresh passed question about triggers?', 'VALIDATED_PASS');
  r = await chat(sa, { message: 'BANKAPPROVE:Bank studio module', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].status === 'PENDING', 'approving bank questions through Loop always asks, even at level 3');
  const before = await prisma.question.findUnique({ where: { id: freshPass.id } });
  r = await api(sa, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'approve' });
  row = await prisma.question.findUnique({ where: { id: freshPass.id } });
  log(before.bankStatus === 'VALIDATED_PASS' && row.bankStatus === 'APPROVED' && row.bankPool !== null, 'the approval card approves the passed questions and splits the pools');

  // ---------- staff: permission and scope ----------
  const SW = await world('Bank staff course', 'Bank staff module', staffUser);
  const sq = await SW.mk(SW.o1, 'Staff passed question about triggers?', 'VALIDATED_PASS');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${SW.mod.id}/bank`, { action: 'approve', allPassed: true });
  log(r.status === 403, 'staff need the question-bank permission to approve, even on their own module');
  r = await chat(staff, { message: 'BANK:Bank staff module', level: 1, studio: { moduleId: SW.mod.id, gameId: null } });
  const tools = fakeLog().filter((c) => c.stream === true).pop().tools;
  log(tools.includes('get_bank_questions') && !tools.some((t) => ['generate_bank_questions', 'review_bank_questions', 'approve_bank_questions'].includes(t)), 'without the permission Loop can show their bank but not write, review or approve');
  r = await api(sa, 'PUT', '/api/admin/studio/people', { userId: staffUser.id, permissions: ['LOOP', 'GAMES', 'ITEMS', 'ASSIGN', 'QUESTIONS', 'BANK_AI'] });
  r = await chat(staff, { message: 'BANKAPPROVE:Bank staff module', level: 3, studio: { moduleId: SW.mod.id, gameId: null } });
  const tools2 = fakeLog().filter((c) => c.stream === true).slice(-2)[0].tools;
  log(['generate_bank_questions', 'review_bank_questions', 'approve_bank_questions'].every((t) => tools2.includes(t)), 'with it Loop offers all three');
  log(r.cards.length === 1 && r.cards[0].status === 'PENDING', 'and the approval still asks, at level 3');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${SW.mod.id}/bank`, { action: 'approve', allPassed: true });
  row = await prisma.question.findUnique({ where: { id: sq.id } });
  log(r.status === 200 && row.bankStatus === 'APPROVED', 'with the permission staff approve their own module’s questions');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve', allPassed: true });
  log(r.status === 404, 'but never another person’s');

  // ---------- the studio panel ----------
  for (let i = 1; i <= 3; i++) await W.mk(W.o1, `UI passed question ${i} about triggers?`, 'VALIDATED_PASS');
  const uiFlag = await W.mk(W.o1, 'FLAGME-WRONG ui flagged question?', 'VALIDATED_FLAGGED');
  await prisma.questionBankEvent.create({ data: { questionId: uiFlag.id, fromStatus: 'PENDING_REVIEW', toStatus: 'VALIDATED_FLAGGED', kind: 'INDEPENDENT_VALIDATION_REJECTED', detail: DETAIL(), actedById: null } });
  const browser = await launch(); const dv = device('desktop');
  const errors = [];
  const ctx = await browser.newContext(dv.context); await ctx.addCookies(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const pg = await ctx.newPage(); pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto(B + '/admin/studio'); await pg.getByTestId('new-game').waitFor();
  await pg.getByRole('button', { name: 'Bank studio course' }).click();
  await pg.getByTestId('module-row').filter({ hasText: 'Bank studio module' }).click();
  await pg.getByTestId('bank-card').waitFor();
  await pg.getByTestId('bank-passed').waitFor();
  const models = await pg.getByTestId('bank-models').innerText();
  log(/claude-sonnet-5-5/.test(models) && /claude-opus-5-5/.test(models) && /different model/.test(models), 'the panel says which model writes and which reviews');
  log((await pg.getByTestId('bank-flagged').getByTestId('bank-reasons').first().innerText()).match(/option B/) !== null, 'a flagged question shows why next to it');
  log((await pg.getByTestId('bank-prepare').count()) === 1, 'there is one button to get the practice questions ready');
  await pg.getByTestId('bank-card').screenshot({ path: '/tmp/dev/bank-panel.png' });
  await pg.getByTestId('bank-prepare').click();
  await pg.getByTestId('bank-error').waitFor({ timeout: 15000 });
  log(/No usable materials/.test(await pg.getByTestId('bank-error').innerText()), 'if the module has nothing to read, the panel says so instead of failing quietly');
  await pg.getByTestId('bank-approve-passed').click();
  await pg.getByText(/approved and split/).first().waitFor({ timeout: 10000 });
  log((await prisma.question.count({ where: { examId: W.exam.id, bankStatus: 'VALIDATED_PASS' } })) === 0, 'Approve all that passed approves them');
  await pg.getByTestId('bank-edit').first().click();
  log((await pg.getByTestId('bank-save-edit').count()) === 1, 'a flagged question can be edited in place');
  log(errors.length === 0, 'no page errors');

  const sctx = await browser.newContext(dv.context); await sctx.addCookies(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null } });
  const sp = await sctx.newPage(); sp.on('pageerror', (e) => errors.push(e.message));
  await prisma.question.update({ where: { id: sq.id }, data: { bankStatus: 'VALIDATED_PASS', needsReview: true } });
  await sp.goto(B + '/admin/studio'); await sp.getByTestId('new-game').waitFor();
  await sp.getByRole('button', { name: 'Bank staff course' }).click();
  await sp.getByTestId('module-row').filter({ hasText: 'Bank staff module' }).click();
  await sp.getByTestId('bank-card').waitFor();
  await sp.getByTestId('bank-passed').waitFor();
  log((await sp.getByTestId('bank-prepare').count()) === 0 && (await sp.getByTestId('bank-approve-passed').count()) === 0, 'without the permission the panel shows the bank but no way to write or approve');
  log(/question-bank permission/.test(await sp.getByTestId('bank-card').innerText()), 'and tells them to ask a Super Admin');

  await browser.close();
  // clean up
  for (const w of [W, SW]) { await prisma.exam.deleteMany({ where: { moduleId: w.mod.id } }); await prisma.course.delete({ where: { id: w.course.id } }).catch(() => {}); }
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null, loopMaxLevel: 1, loopLevel: 1 } });
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
