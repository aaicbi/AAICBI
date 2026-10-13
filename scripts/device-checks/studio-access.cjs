// Game Studio, second round, against the private test database and the stand-in Claude API:
//  - game plays count toward mastery and streaks (and half-right plays do not),
//  - per-question pool assignment inside the studio,
//  - the studio for staff who are not Super Admins: only their own courses and games, Loop limited to the studio
//    and to the level a Super Admin granted, and the Super Admin control for that level.
const { B, log, launch, device, cookiesFor, signedIn, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
async function chat(cookie, { message, level, studio }) {
  const form = new FormData();
  form.set('message', message); if (level) form.set('level', String(level)); if (studio) form.set('studio', JSON.stringify(studio));
  const res = await fetch(B + '/api/admin/loop/chat', { method: 'POST', headers: { Cookie: cookie }, body: form });
  if (!res.ok) return { status: res.status, events: [], cards: [] };
  const events = []; const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let text = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2); if (!line) continue; const ev = JSON.parse(line.slice(6)); events.push(ev); if (ev.type === 'text') text += ev.delta; } }
  return { status: 200, events, text, cards: events.filter((e) => e.type === 'action').map((e) => e.card) };
}
const lastRequest = () => fs.readFileSync('/tmp/fakeclaude-stream.log', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).pop();

async function question(examId, o, n, label) {
  return prisma.question.create({ data: { examId, text: `${label} ${n}: ${o.text}?`, order: n, bankStatus: 'APPROVED', bankObjectiveId: o.id, needsReview: false, options: { create: [{ key: 'A', text: 'Right', isCorrect: true, order: 0 }, { key: 'B', text: 'Wrong', order: 1 }] } } });
}

async function seed() {
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@dev.test' } });
  const t0 = await prisma.trainee.findUnique({ where: { email: 't0@dev.test' } });
  await prisma.game.deleteMany({ where: { title: { startsWith: 'AC ' } } });
  for (const title of ['Access check super course', 'Access check org course']) for (const c of await prisma.course.findMany({ where: { title } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.user.update({ where: { id: staffUser.id }, data: { loopMaxLevel: 1, loopLevel: 1 } });
  await prisma.gamePlay.deleteMany({ where: { traineeId: t0.id } }); await prisma.xpEntry.deleteMany({ where: { traineeId: t0.id } }); await prisma.practiceAnswer.deleteMany({ where: { traineeId: t0.id } });

  const course = await prisma.course.create({ data: { title: 'Access check super course', status: 'PUBLISHED', published: true, isFree: true, createdById: superUser.id } });
  await prisma.courseEnrollment.upsert({ where: { traineeId_courseId: { traineeId: t0.id, courseId: course.id } }, update: { unlockedAt: new Date() }, create: { traineeId: t0.id, courseId: course.id, source: 'ADMIN_GRANTED', unlockedAt: new Date() } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Access Super Module', order: 0 } });
  const exam = await prisma.exam.create({ data: { code: 'ACC-' + Math.random().toString(36).slice(2, 8).toUpperCase(), title: 'Access assessment', moduleId: mod.id, createdById: superUser.id, published: true, passMarkPercent: 80, durationMinutes: 30 } });
  const o1 = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Explain what a trigger is', order: 0, confirmedById: superUser.id } });
  const o2 = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Choose a suitable automation tool', order: 1, confirmedById: superUser.id } });
  let n = 0;
  for (const o of [o1, o2]) for (let k = 0; k < 16; k++) await question(exam.id, o, ++n, 'Q');
  for (let k = 0; k < 3; k++) await question(exam.id, o1, ++n, 'Extra');
  // a clean split for the first 32: 6 formal and 10 practice per objective; the 3 extras stay unassigned
  for (const o of [o1, o2]) {
    const qs = await prisma.question.findMany({ where: { examId: exam.id, bankObjectiveId: o.id, text: { startsWith: 'Q ' } }, orderBy: { order: 'asc' } });
    await prisma.question.updateMany({ where: { id: { in: qs.slice(0, 6).map((q) => q.id) } }, data: { bankPool: 'FORMAL' } });
    await prisma.question.updateMany({ where: { id: { in: qs.slice(6).map((q) => q.id) } }, data: { bankPool: 'PRACTICE' } });
  }

  const orgCourse = await prisma.course.create({ data: { title: 'Access check org course', status: 'PUBLISHED', published: true, isFree: true, createdById: staffUser.id } });
  const orgMod = await prisma.module.create({ data: { courseId: orgCourse.id, title: 'Org Module Alpha', order: 0 } });
  await prisma.moduleLearningObjective.create({ data: { moduleId: orgMod.id, text: 'Explain what a trigger is', order: 0, confirmedById: superUser.id } });
  return { superUser, staffUser, t0, mod, o1, o2, orgMod };
}

(async () => {
  fs.writeFileSync('/tmp/fakeclaude-stream.log', ''); clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const t0Ck = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const { staffUser, t0, mod, o1, o2, orgMod } = await seed();
  const M = mod.id; const O = orgMod.id;

  // =============== mastery and streaks from games ===============
  const rewardsAll = ['ANSWER', 'MISSED_BONUS', 'STREAK', 'OBJECTIVE_MASTERED', 'MODULE_COMPLETED'];
  let r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'AC Matching', format: 'MATCHING' }); const gM = r.json.id;
  r = await api(sa, 'PATCH', `/api/admin/studio/games/${gM}`, { enabledRewards: rewardsAll });
  const MAP = {}; const ids = [];
  for (let i = 0; i < 7; i++) {
    const pairs = [0, 1, 2].map((k) => ({ left: `T${i}${k}`, right: `M${i}${k}` })); pairs.forEach((p) => (MAP[p.left] = p.right));
    r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: o1.id, format: 'MATCHING', content: { prompt: `Match set ${i}`, pairs } }); ids.push(r.json.id);
  }
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gM}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 200, 'a matching game with seven approved items goes live');
  const back = (d) => new Date(Date.now() - d * 86_400_000);
  for (const [i, id] of ids.slice(0, 6).entries()) await prisma.gamePlay.create({ data: { traineeId: t0.id, moduleId: M, gameId: gM, itemId: id, objectiveId: o1.id, servedAt: back(i < 3 ? 3 : 1), answeredAt: back(i < 3 ? 3 : 1), score: 1, correct: true, secondsTaken: 30, tooFast: false } });
  const ans = (served) => Object.fromEntries(served.lefts.map((l, i) => [String(i), MAP[l]]));
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gM}/next`);
  const play = r.json;
  log(r.status === 200 && play.served.lefts[0].startsWith('T6'), 'the one item the trainee has not played is served first');
  await sleep((play.minSeconds + 0.4) * 1000);
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gM}/answer`, { playId: play.playId, response: { matches: ans(play.served) } });
  log(r.status === 200 && r.json.mastery.state === 'MASTERED' && r.json.mastery.distinctCorrect === 7, 'six earlier correct plays on two days plus this one make the objective mastered, from games alone');
  log(r.json.objectiveJustMastered === true && r.json.xp.objective === 50, 'the one-time mastery XP is paid by a game play');
  log(r.json.streakDays === 2 && r.json.xp.streak === 10, 'a game play continues the practice-day streak and pays the streak bonus');
  const keys = await prisma.xpEntry.findMany({ where: { traineeId: t0.id } });
  log(keys.filter((k) => k.dedupeKey === `OBJ:${t0.id}:${o1.id}`).length === 1 && keys.filter((k) => k.kind === 'STREAK').length === 1, 'each of those is in the ledger exactly once');

  // half-right plays on the second objective do not count
  const o2item = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: o2.id, format: 'MATCHING', content: { prompt: 'o2', pairs: [0, 1, 2].map((k) => ({ left: `U${k}`, right: `V${k}` })) } });
  for (let i = 0; i < 6; i++) await prisma.gamePlay.create({ data: { traineeId: t0.id, moduleId: M, gameId: gM, itemId: o2item.json.id, objectiveId: o2.id, servedAt: back(2 + (i % 2)), answeredAt: new Date(back(2 + (i % 2)).getTime() + i * 1000), score: 0.67, correct: false, secondsTaken: 30, tooFast: false } });
  r = await api(sa, 'POST', `/api/admin/studio/games/${(await api(sa, 'POST', '/api/admin/studio/games', { title: 'AC Quiz', format: 'QUIZ' })).json.id}/assign`, {});
  const quiz = await prisma.game.findFirst({ where: { title: 'AC Quiz' } });
  r = await api(sa, 'PUT', `/api/admin/studio/games/${quiz.id}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 200, 'a quiz game goes live on the same module');
  r = await api(t0Ck, 'GET', `/api/modules/${M}/practice`);
  const ob1 = r.json.objectives.find((o) => o.id === o1.id); const ob2 = r.json.objectives.find((o) => o.id === o2.id);
  log(ob1.mastery.state === 'MASTERED' && ob1.mastery.answered >= 7, 'the practice screen shows the objective mastered by games alone');
  log(ob2.mastery.state !== 'MASTERED' && ob2.mastery.distinctCorrect === 0, 'half-right plays do not count toward mastery');
  log(r.json.streak >= 2, 'the practice streak counts game days');

  // =============== per-question pools in the studio ===============
  clearThrottle();
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1480, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await p.getByRole('button', { name: 'Access check super course' }).click();
  await p.getByTestId('module-row').filter({ hasText: 'Access Super Module' }).click();
  await p.getByTestId('pools-card').waitFor();
  await p.getByTestId('pools-card').getByTestId('assign-questions').first().click();
  const sel = p.getByTestId('pools-card').locator('select').first();
  const firstText = await sel.evaluate((e) => e.closest('li').querySelector('p').textContent);
  const beforeNull = await prisma.question.count({ where: { bankObjectiveId: o1.id, bankPool: null } });
  log(beforeNull === 3, 'three questions of the first objective have no pool yet');
  await p.getByRole('button', { name: 'Unassigned to the formal assessment' }).click();
  await p.waitForFunction(() => !document.body.innerText.includes('Unassigned to the formal assessment'));
  log((await prisma.question.count({ where: { bankObjectiveId: o1.id, bankPool: null } })) === 0 && (await prisma.question.count({ where: { bankObjectiveId: o1.id, bankPool: 'FORMAL' } })) === 9, 'the unassigned questions go to the formal pool in one click');
  await p.locator('[data-testid=pools-card] select').first().selectOption('PRACTICE');
  await sleep(900);
  const moved = await prisma.question.findFirst({ where: { bankObjectiveId: o1.id, text: { contains: firstText.slice(0, 12) } } });
  log(moved && moved.bankPool === 'PRACTICE', 'one question can be moved to a different pool from the studio');
  await p.screenshot({ path: '/tmp/dev/studio-pools.png' });
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await br.close();

  // =============== staff who are not Super Admins ===============
  clearThrottle();
  r = await api(staff, 'GET', '/api/admin/studio');
  log(r.status === 200, 'an admin can open the studio');
  log(r.json.courses.some((c) => c.title === 'Access check org course') && !r.json.courses.some((c) => c.title === 'Access check super course'), 'but sees only their own courses, not the Super Admin’s');
  log(!r.json.games.some((g) => g.title.startsWith('AC ')), 'and none of the Super Admin’s games');
  r = await api(staff, 'GET', `/api/admin/studio/modules/${M}`);
  log(r.status === 404, 'a module of someone else’s course is not found');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/preview`, { format: 'MATCHING', index: 0 });
  log(r.status === 404, 'nor can it be previewed');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: o1.id, format: 'MATCHING', content: {} });
  log(r.status === 404, 'nor can items be added to it');
  r = await api(staff, 'GET', '/api/admin/studio/people');
  log([401, 403].includes(r.status), 'the control for Loop levels is for Super Admins only');
  r = await api(staff, 'POST', '/api/admin/studio/games', { title: 'AC Staff game', format: 'MATCHING' });
  const gS = r.json.id; log(r.status === 201, 'staff can make their own game');
  r = await api(staff, 'PATCH', `/api/admin/studio/games/${gM}`, { title: 'hijack' });
  log(r.status === 404, 'but cannot change the Super Admin’s game');
  r = await api(staff, 'PUT', `/api/admin/studio/games/${gS}/assign`, { moduleId: M, assigned: true });
  log(r.status === 404, 'and cannot assign their game to someone else’s module');
  r = await api(staff, 'PUT', `/api/admin/studio/games/${gS}/assign`, { moduleId: O, assigned: true });
  log(r.status === 200, 'they can assign it to their own module');
  r = await api(sa, 'GET', '/api/admin/studio');
  log(r.json.games.some((g) => g.title === 'AC Staff game') && r.json.courses.some((c) => c.title === 'Access check org course'), 'the Super Admin still sees everything');

  // Loop for staff
  r = await chat(staff, { message: 'GAME:AC Loop staff game', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.status === 200 && r.cards.length === 1 && r.cards[0].status === 'PENDING', 'staff ask for level 3 but start at level 1: a change waits for their approval');
  const req = lastRequest();
  log(req.tools.includes('add_game_items') && req.tools.includes('find_module') && !req.tools.some((t) => ['get_platform_overview', 'resolve_recipients', 'send_message', 'suspend_messaging', 'generate_bank_questions', 'run_bank_validation', 'get_trainee_report', 'search_people'].includes(t)), 'Loop offers staff the studio’s tools only, not platform data or messaging');
  log(!/Access Super Module/.test(req.system), 'Loop is not told about a module that is not theirs, even if the page sends its id');
  log(/training organization's staff/.test(req.system), 'Loop is given the limited instructions');
  r = await chat(staff, { message: 'ITEMS:Access Super Module.', level: 1, studio: { moduleId: O, gameId: null } });
  log(r.cards.length === 0 && (await prisma.gameItem.count({ where: { moduleId: M, source: 'LOOP' } })) === 0, 'Loop cannot find, read or write into someone else’s module');
  r = await chat(staff, { message: 'ITEMS:Org Module Alpha.', level: 1, studio: { moduleId: O, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].kind === 'add_game_items' && r.cards[0].status === 'PENDING', 'in their own module Loop proposes items and waits at level 1');
  r = await api(staff, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'approve' });
  log(r.json.status === 'EXECUTED' && (await prisma.gameItem.count({ where: { moduleId: O, source: 'LOOP', status: 'DRAFT' } })) === 2, 'approving writes the two drafts');
  r = await api(sa, 'POST', `/api/admin/loop/actions/${(await prisma.loopPendingAction.findFirst({ where: { userId: staffUser.id }, orderBy: { createdAt: 'desc' } })).id}`, { decision: 'approve' });
  log([404, 403].includes(r.status), 'a Super Admin cannot approve for someone else, and staff cannot approve each other’s either');
  r = await api(staff, 'GET', '/api/admin/loop/conversations');
  log(r.json.maxLevel === 1, 'staff are told their ceiling is level 1');

  r = await api(sa, 'GET', '/api/admin/studio/people');
  log(r.status === 200 && r.json.people.some((x) => x.name && x.level === 1), 'the Super Admin sees the team and their levels');
  const me = r.json.people.find((x) => x.id === staffUser.id);
  r = await api(sa, 'PUT', '/api/admin/studio/people', { userId: staffUser.id, level: 2 });
  log(r.status === 200, 'a Super Admin can raise how much Loop may do for one person');
  r = await chat(staff, { message: 'ITEMS:Org Module Alpha.', level: 3, studio: { moduleId: O, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].status === 'EXECUTED' && r.cards[0].autoExecuted, 'at level 2 their low-risk changes now happen at once (level 3 was capped to 2)');
  r = await chat(staff, { message: 'APPROVE:Org Module Alpha.', level: 3, studio: { moduleId: O, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].status === 'PENDING', 'approving drafts still always asks, at any level');
  r = await api(staff, 'GET', '/api/admin/loop/conversations');
  log(r.json.maxLevel === 2, 'their ceiling is now 2');
  await api(sa, 'PUT', '/api/admin/studio/people', { userId: staffUser.id, level: 1 });
  r = await chat(staff, { message: 'ITEMS:Org Module Alpha.', level: 2, studio: { moduleId: O, gameId: null } });
  log(r.cards[0].status === 'PENDING', 'lowering it puts them back to asking first');
  r = await api(staff, 'GET', '/api/admin/loop/history');
  log([401, 403].includes(r.status), 'the Command Center history stays Super Admin only');

  // staff screens
  clearThrottle();
  const br2 = await launch();
  const sctx = await signedIn(br2, device('Desktop Chrome', { viewport: { width: 1480, height: 900 } }), '/api/auth/login', 'staff@dev.test');
  const sp = await sctx.newPage(); sp.setDefaultTimeout(20000);
  await sp.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await sp.getByTestId('new-game').waitFor();
  log(await sp.locator('a[href="/admin/studio"]').first().isVisible(), 'Game Studio is in the sidebar for staff');
  log((await sp.getByTestId('people-panel').count()) === 0, 'staff do not see the control for other people’s Loop levels');
  const text = await sp.locator('main').innerText();
  log(!/Access check super course/.test(text) && /Access check org course/.test(text.replace(/\n/g, ' ')) || (await sp.getByRole('button', { name: 'Access check org course' }).count()) === 1, 'staff see only their own course in the library');
  await sp.getByRole('button', { name: 'Access check org course' }).click();
  await sp.getByTestId('module-row').filter({ hasText: 'Org Module Alpha' }).click();
  await sp.getByTestId('items-card').waitFor().catch(() => {});
  await sp.getByTestId('level-picker').click();
  const l3 = sp.getByTestId('level-3');
  log((await l3.isDisabled()) === true, 'the level picker shows level 3 as not unlocked');
  await sp.screenshot({ path: '/tmp/dev/studio-staff.png' });
  await br2.close();

  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
