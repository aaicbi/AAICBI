// Importing a reviewed content file (the real Module 1 file) into a module, against the private test database:
// preview saves nothing, import saves quiz questions as "passed review" and items as drafts, nothing goes live by itself,
// a second import adds nothing, a person's approval is what makes it playable, and staff without the permissions can't import.
const { B, log, launch, device, cookiesFor, signedIn, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const FILE = '/home/user/AAICBI/content/ai-automation/module-1.json';

(async () => {
  clearThrottle();
  const file = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@dev.test' } });
  for (const c of await prisma.course.findMany({ where: { title: 'Import check course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Import check module' } } });
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null } });

  const course = await prisma.course.create({ data: { title: 'Import check course', status: 'PUBLISHED', published: true, isFree: true, createdById: superUser.id } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Import check module', order: 0 } });
  // the module already has objective 1 under (almost) the same words, and objective 2 under a looser wording
  await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: file.objectives[0].text, order: 0, confirmedById: superUser.id } });
  await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Tell manual workflows from automated workflows and judge strong or weak automation candidates', order: 1, confirmedById: superUser.id } });
  const M = mod.id;
  const url = `/api/admin/studio/modules/${M}/import`;

  // ---- preview saves nothing
  let r = await api(sa, 'POST', url, { file });
  const t = r.json?.plan?.totals;
  log(r.status === 200 && t.quiz.create === 160 && t.scenario.create === 160 && t.matching.create === 155 && t.ordering.create === 123 && t.quiz.invalid + t.matching.invalid + t.ordering.invalid + t.scenario.invalid === 0, 'the preview counts every item in the file and finds none unusable');
  log(r.json.plan.objectives[0].match.how === 'same text' && r.json.plan.objectives[1].match.how === 'similar text' && r.json.plan.objectives[2].match.how === 'new', 'objectives line up by same words, similar words, or are new');
  log((await prisma.gameItem.count({ where: { moduleId: M } })) === 0 && (await prisma.exam.count({ where: { moduleId: M } })) === 0, 'a preview saves nothing');

  // ---- permissions
  r = await api(staff, 'POST', url, { file });
  log(r.status === 403, 'staff without the question-bank permission cannot import');

  // ---- import
  r = await api(sa, 'POST', url, { file, apply: true, createGames: true });
  log(r.status === 200 && r.json.questions === 160 && r.json.items.MATCHING === 155 && r.json.items.ORDERING === 123 && r.json.items.SCENARIO === 160, 'the import saves every item (' + JSON.stringify(r.json?.items) + ', ' + r.json?.questions + ' questions)');
  log(r.json.objectivesMatched === 2 && r.json.objectivesCreated === 6, 'two objectives were matched and six were added');
  const objs = await prisma.moduleLearningObjective.findMany({ where: { moduleId: M } });
  log(objs.length === 8, 'the module now has all eight objectives');
  const qs = await prisma.question.findMany({ where: { exam: { moduleId: M } }, select: { bankStatus: true, bankPool: true, needsReview: true, bankObjectiveId: true } });
  log(qs.length === 160 && qs.every((q) => q.bankStatus === 'VALIDATED_PASS' && q.bankPool === 'PRACTICE' && q.needsReview === true), 'quiz questions arrive as passed review, for games and practice, waiting for approval');
  const perObj = new Set(qs.map((q) => q.bankObjectiveId));
  log(perObj.size === 8, 'questions are spread across all eight objectives');
  const opts = await prisma.option.findMany({ where: { question: { exam: { moduleId: M } } }, select: { questionId: true, isCorrect: true } });
  const byQ = {}; for (const o of opts) byQ[o.questionId] = (byQ[o.questionId] || 0) + (o.isCorrect ? 1 : 0);
  log(Object.values(byQ).every((n) => n === 1), 'every question has exactly one right answer');
  const items = await prisma.gameItem.findMany({ where: { moduleId: M }, select: { status: true, format: true, source: true } });
  log(items.length === 438 && items.every((i) => i.status === 'DRAFT' && i.source === 'IMPORT'), 'game items arrive as drafts marked as imported');
  const assigns = await prisma.gameAssignment.findMany({ where: { moduleId: M }, include: { game: true } });
  log(assigns.length === 4 && assigns.every((a) => a.live === false) && ['QUIZ', 'MATCHING', 'ORDERING', 'SCENARIO'].every((f) => assigns.some((a) => a.game.format === f)), 'four games were created and attached, all switched off');
  const events = await prisma.questionBankEvent.count({ where: { kind: 'IMPORTED_REVIEWED', question: { exam: { moduleId: M } } } });
  log(events === 160, 'each imported question has a record of where it came from');

  // ---- nothing twice
  r = await api(sa, 'POST', url, { file });
  const t2 = r.json.plan.totals;
  log(t2.quiz.create + t2.matching.create + t2.ordering.create + t2.scenario.create === 0 && t2.quiz.duplicate === 160, 'a second preview finds everything already there');
  r = await api(sa, 'POST', url, { file, apply: true, createGames: true });
  log(r.json.questions === 0 && r.json.items.MATCHING + r.json.items.ORDERING + r.json.items.SCENARIO === 0 && r.json.gamesCreated.length === 0, 'importing again adds nothing and makes no second set of games');
  log((await prisma.question.count({ where: { exam: { moduleId: M } } })) === 160 && (await prisma.gameItem.count({ where: { moduleId: M } })) === 438, 'the counts did not change');

  // ---- a person approves, then it can be played
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/bank`, { action: 'approve', allPassed: true, pool: 'PRACTICE' });
  log(r.status === 200 && r.json.approved === 160, 'the question bank approves all 160 imported questions in one click');
  for (const f of ['MATCHING', 'ORDERING', 'SCENARIO']) {
    r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items/approve`, { format: f });
    log(r.status === 200 && r.json.approved > 0, `the studio approves the ${f.toLowerCase()} drafts`);
  }

  // ---- one objective at a time (how the panel sends large files), with a chosen objective and questions set aside for the assessment
  const mod3 = await prisma.module.create({ data: { courseId: course.id, title: 'Import check module three', order: 2 } });
  const mine = await prisma.moduleLearningObjective.create({ data: { moduleId: mod3.id, text: 'Know what robots in offices do', order: 0, confirmedById: superUser.id } });
  const url3 = `/api/admin/studio/modules/${mod3.id}/import`;
  const choices = { 0: mine.id };
  for (let i = 1; i < 8; i++) choices[i] = 'new';
  let t0 = Date.now();
  r = await api(sa, 'POST', url3, { file, choices, reserve: 6 });
  log(r.status === 200 && r.json.existing.length === 1 && r.json.plan.objectives[0].match.how === 'chosen' && r.json.plan.objectives[0].reserved === 6, 'the preview honours the objective a person chose and the questions set aside');
  r = await api(sa, 'POST', url3, { file, choices, reserve: 6, apply: true, only: [2] });
  const q3 = await prisma.question.count({ where: { exam: { moduleId: mod3.id } } });
  const o3 = await prisma.moduleLearningObjective.count({ where: { moduleId: mod3.id } });
  log(r.status === 200 && o3 === 2 && q3 === 20 && r.json.questions === 20, 'importing just one objective saves only that objective and its 20 questions');
  for (let i = 0; i < 8; i++) if (i !== 2) await api(sa, 'POST', url3, { file, choices, reserve: 6, apply: true, only: [i] });
  r = await api(sa, 'POST', url3, { file, choices, reserve: 6, apply: true, only: [], createGames: true });
  log((await prisma.question.count({ where: { exam: { moduleId: mod3.id } } })) === 160 && (await prisma.gameItem.count({ where: { moduleId: mod3.id } })) === 438 && r.json.gamesCreated.length === 4, 'eight objective-by-objective imports plus the games step give the same result as one import');
  log((await prisma.moduleLearningObjective.count({ where: { moduleId: mod3.id } })) === 8, 'the chosen objective was used instead of adding a duplicate, so the module has exactly eight');
  const mineQs = await prisma.question.count({ where: { bankObjectiveId: mine.id } });
  log(mineQs === 20, 'the module\'s own objective received the first file objective\'s 20 questions');
  const pools = await prisma.question.groupBy({ by: ['bankObjectiveId', 'bankPool'], where: { exam: { moduleId: mod3.id } }, _count: { _all: true } });
  const okPools = new Set(pools.map((p) => p.bankObjectiveId)).size === 8 && pools.filter((p) => p.bankPool === 'FORMAL').every((p) => p._count._all === 6) && pools.filter((p) => p.bankPool === 'PRACTICE').every((p) => p._count._all === 14);
  log(okPools && pools.length === 16, 'every objective ends with 14 questions for games and practice and 6 for the assessment, enough to meet the quiz minimums');
  log(Date.now() - t0 < 20000, 'a whole module imports in a few seconds (' + (Date.now() - t0) + ' ms)');

  // ---- the panel
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1480, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000);
  const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  // a fresh module so the panel shows a real first import
  const mod2 = await prisma.module.create({ data: { courseId: course.id, title: 'Import check module two', order: 1 } });
  await pg.goto(B + '/admin/studio'); await pg.getByTestId('new-game').waitFor();
  await pg.getByRole('button', { name: 'Import check course' }).click();
  await pg.getByTestId('module-row').filter({ hasText: 'Import check module two' }).click();
  await pg.getByTestId('import-card').waitFor();
  await pg.getByTestId('import-file').setInputFiles(FILE);
  await pg.getByTestId('import-preview').waitFor();
  const txt = await pg.getByTestId('import-preview').innerText();
  log(/598 new items would be saved/.test(txt) && /Quiz questions: 160 new/.test(txt), 'the panel shows what would be saved before anything is');
  log((await pg.getByTestId('import-objective').count()) === 8, 'and lists the eight objectives');
  await pg.getByTestId('import-card').screenshot({ path: '/tmp/dev/import-panel.png' });
  await pg.getByTestId('import-run').click();
  await pg.getByTestId('import-done').waitFor();
  log((await prisma.question.count({ where: { exam: { moduleId: mod2.id } } })) === 160, 'clicking Import saves the module through the panel');
  log(/160 quiz questions are waiting/.test(await pg.getByTestId('import-done').innerText()), 'the panel says what to approve next');
  // tidy tools
  const post = (action, extra) => pg.evaluate(async ([u, b]) => { const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; }, [`/api/admin/studio/modules/${mod2.id}/tidy`, { action, ...extra }]);
  const tObjs = await prisma.moduleLearningObjective.findMany({ where: { moduleId: mod2.id }, orderBy: { order: 'asc' } });
  const tEmpty = await prisma.moduleLearningObjective.create({ data: { moduleId: mod2.id, text: 'Spare empty objective', order: 20, confirmedById: tObjs[0].confirmedById } });
  let tr = await post('delete', { id: tEmpty.id });
  log(tr.status === 200 && !(await prisma.moduleLearningObjective.findUnique({ where: { id: tEmpty.id } })), 'tidy removes an empty objective');
  tr = await post('delete', { id: tObjs[0].id });
  log(tr.status >= 400 && !!(await prisma.moduleLearningObjective.findUnique({ where: { id: tObjs[0].id } })), 'tidy refuses to remove an objective that has content');
  const tDup = await prisma.moduleLearningObjective.create({ data: { moduleId: mod2.id, text: 'Duplicate of the first', order: 21, confirmedById: tObjs[0].confirmedById } });
  const tQs = await prisma.question.findMany({ where: { exam: { moduleId: mod2.id }, bankObjectiveId: tObjs[1].id }, take: 3 });
  await prisma.question.updateMany({ where: { id: { in: tQs.map((q) => q.id) } }, data: { bankObjectiveId: tDup.id } });
  const tBefore = await prisma.question.count({ where: { exam: { moduleId: mod2.id }, bankObjectiveId: tObjs[1].id } });
  tr = await post('merge', { fromId: tDup.id, toId: tObjs[1].id });
  log(tr.status === 200 && (await prisma.question.count({ where: { exam: { moduleId: mod2.id }, bankObjectiveId: tObjs[1].id } })) === tBefore + 3 && !(await prisma.moduleLearningObjective.findUnique({ where: { id: tDup.id } })), 'tidy merges a duplicate objective and moves its questions');
  tr = await post('rename', { id: tObjs[1].id, text: 'Describe the three building blocks of automation.' });
  log(tr.status === 200 && (await prisma.moduleLearningObjective.findUnique({ where: { id: tObjs[1].id } })).text === 'Describe the three building blocks of automation.', 'tidy renames an objective and keeps its questions');
  tr = await post('rename', { id: tObjs[1].id, text: tObjs[2].text });
  log(tr.status === 409, 'tidy refuses a rename that would duplicate another objective');
  await prisma.question.updateMany({ where: { exam: { moduleId: mod2.id }, bankObjectiveId: tObjs[2].id }, data: { bankPool: 'PRACTICE' } });
  tr = await post('fillAssessment', {});
  log(tr.status === 200 && (await prisma.question.count({ where: { exam: { moduleId: mod2.id }, bankObjectiveId: tObjs[2].id, bankPool: 'FORMAL' } })) === 6, 'tidy fills the assessment side to six per objective');
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await br.close();

  for (const c of await prisma.course.findMany({ where: { title: 'Import check course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Import check module' } } });
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
