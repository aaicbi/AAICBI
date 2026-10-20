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
  let r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'AC Matching', format: 'MATCHING' }); const gM = r.json.id; if (!gM) console.log('create game', r.status, JSON.stringify(r.json));
  r = await api(sa, 'PATCH', `/api/admin/studio/games/${gM}`, { enabledRewards: rewardsAll });
  const MAP = {}; const ids = [];
  for (let i = 0; i < 6; i++) {
    const pairs = [0, 1, 2].map((k) => ({ left: `T${i}${k}`, right: `M${i}${k}` })); pairs.forEach((p) => (MAP[p.left] = p.right));
    r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: o1.id, format: 'MATCHING', content: { prompt: `Match set ${i}`, pairs } }); if (!r.json.id) console.log('item', r.status, JSON.stringify(r.json)); ids.push(r.json.id);
  }
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gM}/assign`, { moduleId: M, assigned: true, live: true });
  if (r.status !== 200) console.log('assign', r.status, JSON.stringify(r.json));
  log(r.status === 200, 'a matching game with six approved items goes live');
  const back = (d) => new Date(Date.now() - d * 86_400_000);
  for (const [i, id] of ids.slice(0, 5).entries()) await prisma.gamePlay.create({ data: { traineeId: t0.id, moduleId: M, gameId: gM, itemId: id, objectiveId: o1.id, servedAt: back(i < 3 ? 3 : 1), answeredAt: back(i < 3 ? 3 : 1), score: 1, correct: true, secondsTaken: 30, tooFast: false } });
  const ans = (served) => Object.fromEntries(served.lefts.map((l, i) => [String(i), MAP[l]]));
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gM}/next`);
  const play = r.json;
  log(r.status === 200 && play.served.lefts[0].startsWith('T5'), 'the one item the trainee has not played is served first');
  await sleep((play.minSeconds + 0.4) * 1000);
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gM}/answer`, { playId: play.playId, response: { matches: ans(play.served) } });
  log(r.status === 200 && r.json.mastery.state === 'MASTERED' && r.json.mastery.distinctCorrect === 6, 'five earlier correct plays on two days plus this one make the objective mastered, from games alone');
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
  log(ob1.mastery.state === 'MASTERED' && ob1.mastery.answered >= 6, 'the practice screen shows the objective mastered by games alone');
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

  // Staff, organizations and instructors no longer have a studio at all: see studio-super-only.cjs.

  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
