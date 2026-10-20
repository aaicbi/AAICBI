// The Game results dashboard: every player across course games, quiz practice and the feed, with answers and accuracy; a Super Admin
// decides who else may open it (a share switch, then a switch per person); staff see only their own courses' players; trainees never.
const { B, log, launch, device, signedIn, results, clearThrottle, cookiesFor } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const call = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, json: j, text };
};
const scenario = (i) => ({ situation: `Results case ${i}`, options: [{ text: `Right ${i}`, outcome: 'Good.', correct: true }, { text: `Wrong A ${i}`, outcome: 'No.', correct: false }, { text: `Wrong B ${i}`, outcome: 'No.', correct: false }] });

(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const t0c = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@dev.test' } });
  const t0 = await prisma.trainee.findUnique({ where: { email: 't0@dev.test' } });
  const t1 = await prisma.trainee.findUnique({ where: { email: 't1@dev.test' } });
  for (const c of await prisma.course.findMany({ where: { title: 'Results check course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.feedGamePlay.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Results check' } } });
  await prisma.platformSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', gameResultsShared: false }, update: { gameResultsShared: false } });

  const course = await prisma.course.create({ data: { title: 'Results check course', status: 'PUBLISHED', published: true, isFree: true, createdById: superUser.id } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Results check module', order: 0 } });
  const obj = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Decide', order: 0, confirmedById: superUser.id } });
  const items = [];
  for (let i = 0; i < 12; i++) items.push(await prisma.gameItem.create({ data: { moduleId: mod.id, objectiveId: obj.id, format: 'SCENARIO', content: scenario(i), status: 'APPROVED', source: 'IMPORT' } }));
  const game = await prisma.game.create({ data: { title: 'Results check scenarios', format: 'SCENARIO', createdById: superUser.id } });
  const asg = await prisma.gameAssignment.create({ data: { gameId: game.id, moduleId: mod.id, live: true, openToVisitors: true } });

  // t0 plays on the feed: 3 right, 1 wrong; t1 has course-game history (2 plays, 1 right) written straight to the database
  const served = [];
  let seen = [];
  for (let i = 0; i < 4; i++) {
    const n = await call(t0c, 'POST', `/api/public/play/${asg.id}/next`, { seen });
    seen.push(n.json.playId); served.push(n.json);
  }
  const right = (s) => s.served.options.find((o) => /^Right/.test(o));
  const wrong = (s) => s.served.options.find((o) => /^Wrong/.test(o));
  for (let i = 0; i < 4; i++) await call(t0c, 'POST', `/api/public/play/${asg.id}/answer`, { playId: served[i].playId, response: { choice: i < 3 ? right(served[i]) : wrong(served[i]) } });
  log((await prisma.feedGamePlay.count({ where: { userId: t0.id, gameId: game.id } })) === 4, 'answers given on the feed are recorded with who gave them');
  await prisma.gamePlay.createMany({ data: [
    { traineeId: t1.id, moduleId: mod.id, gameId: game.id, itemId: items[0].id, objectiveId: obj.id, answeredAt: new Date(), score: 1, correct: true },
    { traineeId: t1.id, moduleId: mod.id, gameId: game.id, itemId: items[1].id, objectiveId: obj.id, answeredAt: new Date(), score: 0, correct: false },
  ] });

  // ---- who may see it
  let r = await call(null, 'GET', '/api/admin/game-results');
  log([401, 403, 307].includes(r.status), 'signed-out people cannot open the results');
  r = await call(t0c, 'GET', '/api/admin/game-results');
  log([401, 403, 307].includes(r.status), 'trainees cannot open the results');
  r = await call(staff, 'GET', '/api/admin/game-results');
  log(r.status === 403, 'staff cannot open them while they are not shared');
  r = await call(staff, 'PUT', '/api/admin/game-results/access', { shared: true });
  log(r.status === 403, 'only a Super Admin can change who sees them');

  r = await call(sa, 'GET', `/api/admin/game-results?days=30&gameId=${game.id}`);
  const mine = (r.json?.players ?? []).filter((p) => [t0.id, t1.id].includes(p.userId));
  const p0 = mine.find((p) => p.userId === t0.id); const p1 = mine.find((p) => p.userId === t1.id);
  log(r.status === 200 && !!p0 && !!p1, 'a Super Admin sees both players');
  log(p0 && p0.answers === 4 && p0.correct === 3 && p0.accuracy === 75 && p0.sources.join() === 'FEED', 'the feed player shows 4 answers, 3 right, 75%, from the feed');
  log(p1 && p1.answers === 2 && p1.correct === 1 && p1.accuracy === 50 && p1.sources.join() === 'COURSE', 'the course player shows 2 answers, 1 right, 50%, from a course game');
  r = await call(sa, 'GET', `/api/admin/game-results?gameId=${game.id}&q=${encodeURIComponent(t1.email.slice(0, 6))}`);
  log(r.json.players.length >= 1 && r.json.players.every((p) => p.email.toLowerCase().includes(t1.email.slice(0, 6).toLowerCase())), 'search and the game filter narrow the table');
  r = await call(sa, 'GET', `/api/admin/game-results/${t0.id}`);
  const here = r.json.plays.filter((p) => p.game === 'Results check scenarios');
  log(here.length === 4 && here.filter((p) => p.correct).length === 3, "a player's latest answers can be opened");
  r = await call(sa, 'GET', '/api/admin/game-results?format=csv');
  log(r.status === 200 && /Name,Email,Account/.test(r.text) && r.text.includes(t0.email), 'the table downloads as a CSV');

  // (Sharing the results with staff was removed: the Game Studio and its results are Super Admin only.)
  r = await call(sa, 'GET', '/api/admin/game-results');
  log(r.status === 200, 'and a Super Admin still sees it');

  // ---- the page
  const br = await launch();
  const errors = [];
  for (const [name, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 900 } })], ['phone', device('iPhone 13')]]) {
    const ctx = await signedIn(br, dev, '/api/auth/login', 'super@dev.test');
    const p = await ctx.newPage(); p.setDefaultTimeout(20000);
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(`${B}/admin/game-results`, { waitUntil: 'load' });
    await p.getByTestId('results-game').waitFor();
    log((await p.getByTestId('results-access').count()) === 0, `${name}: there are no sharing switches any more`);
    await p.getByTestId('results-game').selectOption({ label: 'Results check scenarios' });
    await p.getByTestId('results-list').waitFor();
    const row = p.locator(`[data-testid=results-row][data-user="${t0.id}"]`);
    await row.waitFor();
    await p.waitForFunction((id) => /75%/.test(document.querySelector(`[data-testid=results-row][data-user="${id}"]`)?.textContent ?? ''), t0.id, { timeout: 10000 }).catch(() => {});
    log(/75%/.test(await row.innerText()), `${name}: the table shows the feed player at 75%`);
    await row.locator('button').click();
    await p.getByTestId('results-detail').waitFor();
    await p.getByTestId('results-detail').locator('li', { hasText: 'Results check scenarios' }).first().waitFor();
    log((await p.getByTestId('results-detail').locator('li', { hasText: 'Results check scenarios' }).count()) === 4, `${name}: opening a player lists their latest answers`);
    log((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, `${name}: no sideways scrolling`);
    await p.screenshot({ path: `/tmp/dev/game-results-${name}.png`, fullPage: false });
    await ctx.close();
  }
  // a switched-off staff member sees the explanation instead of the table
  const sctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'staff@dev.test');
  const sp = await sctx.newPage(); sp.setDefaultTimeout(20000);
  await sp.goto(`${B}/admin/game-results`, { waitUntil: 'load' });
  await sp.getByTestId('results-blocked').waitFor();
  log(/Super Admin/.test(await sp.getByTestId('results-blocked').innerText()), 'staff are told the results are only for the Super Admin');
  log((await sp.getByTestId('results-access').count()) === 0, 'and never see the access switches');
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await br.close();

  for (const c of await prisma.course.findMany({ where: { title: 'Results check course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.feedGamePlay.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Results check' } } });
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
