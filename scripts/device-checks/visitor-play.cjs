// Games on the feed: a game staff switch "Show on the feed" appears under "Try a game" for everyone, but playing needs a signed-in account.
// The answer key never reaches the browser, nothing is recorded, assessment questions are never served, two misses make Loop pop up
// with the course and a Register now button, and switching the game off closes it at once. Phone first.
const { B, log, launch, device, signedIn, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const fs = require('fs');
fs.mkdirSync('/tmp/dev', { recursive: true });
const prisma = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scenario = (i) => ({ situation: `Situation number ${i}: what do you do?`, options: [{ text: `Right choice ${i}`, outcome: 'Good call.', correct: true }, { text: `Wrong choice A ${i}`, outcome: 'Not quite.', correct: false }, { text: `Wrong choice B ${i}`, outcome: 'Not quite.', correct: false }] });

(async () => {
  clearThrottle();
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  for (const c of await prisma.course.findMany({ where: { title: 'Feed game course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Feed game' } } });

  const course = await prisma.course.create({ data: { title: 'Feed game course', status: 'PUBLISHED', published: true, isFree: true, createdById: superUser.id } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Feed game module', order: 0 } });
  const obj = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Decide well in a case', order: 0, confirmedById: superUser.id } });
  await prisma.gameItem.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ moduleId: mod.id, objectiveId: obj.id, format: 'SCENARIO', content: scenario(i), status: 'APPROVED', source: 'IMPORT' })) });
  const game = await prisma.game.create({ data: { title: 'Feed game scenarios', format: 'SCENARIO', createdById: superUser.id } });
  const asg = await prisma.gameAssignment.create({ data: { gameId: game.id, moduleId: mod.id, live: true, openToVisitors: false } });

  // a quiz game on a second module: 12 practice questions and 3 assessment ones that must never be served
  const mod2 = await prisma.module.create({ data: { courseId: course.id, title: 'Feed game quiz module', order: 1 } });
  const obj2 = await prisma.moduleLearningObjective.create({ data: { moduleId: mod2.id, text: 'Know the basics', order: 0, confirmedById: superUser.id } });
  const exam = await prisma.exam.create({ data: { title: 'Feed game exam', code: 'FEEDGAME' + Date.now(), moduleId: mod2.id, createdById: superUser.id, published: false } });
  let quizOk = false;
  if (exam) {
    for (let i = 0; i < 15; i++) {
      const formal = i >= 12;
      await prisma.question.create({ data: { examId: exam.id, text: `${formal ? 'FORMAL' : 'Practice'} question ${i}?`, explanation: 'Because.', bankStatus: 'APPROVED', bankPool: formal ? 'FORMAL' : 'PRACTICE', bankObjectiveId: obj2.id, needsReview: false, options: { create: [{ key: 'A', text: 'Yes', isCorrect: true, order: 0 }, { key: 'B', text: 'No', isCorrect: false, order: 1 }, { key: 'C', text: 'Maybe', isCorrect: false, order: 2 }] } } });
    }
    quizOk = true;
  }
  const quizGame = quizOk ? await prisma.game.create({ data: { title: 'Feed game quiz', format: 'QUIZ', createdById: superUser.id } }) : null;
  const quizAsg = quizOk ? await prisma.gameAssignment.create({ data: { gameId: quizGame.id, moduleId: mod2.id, live: true, openToVisitors: true } }) : null;

  const post = async (cookie, path, body) => {
    const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body ?? {}) });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, json: j };
  };

  const br = await launch();
  const errors = [];

  // ---- closed by default: not on the feed, not playable
  const anon = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' });
  await anon.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const ap = await anon.newPage(); ap.setDefaultTimeout(20000);
  await ap.goto(B + '/', { waitUntil: 'load' });
  log((await ap.locator(`[data-testid=try-game-link][href="/play/${asg.id}"]`).count()) === 0, 'a game that is not switched on for the feed is not listed');
  let r = await post(null, `/api/public/play/${asg.id}/next`);
  log(r.status === 401, 'playing needs a signed-in account');

  // ---- staff switch it on: needs the game live
  const sa = (await require('./lib.cjs').cookiesFor('/api/auth/login', 'super@dev.test')).map((x) => `${x.name}=${x.value}`).join('; ');
  const put = (body) => fetch(`${B}/api/admin/studio/games/${game.id}/assign`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: sa }, body: JSON.stringify({ moduleId: mod.id, assigned: true, ...body }) }).then(async (x) => ({ status: x.status, json: await x.json().catch(() => ({})) }));
  r = await put({ live: false, openToVisitors: true });
  log(r.status === 409, 'a game must be live before it can be shown on the feed');
  r = await put({ live: true, openToVisitors: true });
  log(r.status === 200 && (await prisma.gameAssignment.findUnique({ where: { id: asg.id } })).openToVisitors === true, 'staff can show a live game on the feed');

  // ---- anyone sees it on the feed; the play page asks them to sign in
  await ap.goto(B + '/', { waitUntil: 'load' });
  await ap.getByTestId('try-games').waitFor();
  log((await ap.locator(`[data-testid=try-game-link][href="/play/${asg.id}"]`).count()) === 1, 'the game is listed under Try a game on the feed');
  await ap.screenshot({ path: '/tmp/dev/try-games-phone.png' });
  await ap.locator(`[data-testid=try-game-link][href="/play/${asg.id}"]`).click();
  await ap.getByTestId('play-gate').waitFor();
  log((await ap.getByTestId('play-gate-login').getAttribute('href')).includes('next=%2Fplay%2F'), 'someone not signed in is asked to sign in and brought back to the game');
  log((await ap.getByTestId('play-gate-join').count()) === 1 && (await ap.getByTestId('game-player').count()) === 0, 'and can create a free account; no questions are shown');

  // ---- signed in: the API never sends the key and records nothing
  const trainee = (await require('./lib.cjs').cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((x) => `${x.name}=${x.value}`).join('; ');
  r = await post(trainee, `/api/public/play/${asg.id}/next`, { seen: [] });
  log(r.status === 200 && r.json.served && !JSON.stringify(r.json).includes('Good call') && !/"correct"/.test(JSON.stringify(r.json)), 'the served question has no answer key or feedback in it');
  const first = r.json;
  const before = [await prisma.gamePlay.count(), await prisma.practiceAnswer.count(), await prisma.xpEvent?.count?.().catch(() => 0)];
  r = await post(trainee, `/api/public/play/${asg.id}/answer`, { playId: first.playId, response: { choice: first.served.options[0] } });
  log(r.status === 200 && typeof r.json.correct === 'boolean' && r.json.feedback, 'an answer is graded on the server and the feedback comes back');
  r = await post(trainee, `/api/public/play/${asg.id}/answer`, { playId: 'not-a-real-item', response: { choice: 'x' } });
  log(r.status === 404, 'an item that is not part of the game cannot be graded');
  log((await prisma.gamePlay.count()) === before[0] && (await prisma.practiceAnswer.count()) === before[1], 'nothing is recorded: no plays, no answers');
  r = await post(trainee, `/api/public/play/${asg.id}/next`, { seen: Array.from({ length: 10 }, (_, i) => 'x' + i) });
  log(r.json?.done === true, 'a round is ten questions, then the server says done');

  // ---- the quiz game never serves assessment questions
  if (quizOk) {
    let formalSeen = 0; let served = 0; const seen = [];
    for (let i = 0; i < 10; i++) {
      const q = await post(trainee, `/api/public/play/${quizAsg.id}/next`, { seen });
      if (!q.json?.served) break;
      served++; seen.push(q.json.playId);
      if (/FORMAL/.test(q.json.served.question)) formalSeen++;
    }
    log(served === 10 && formalSeen === 0, 'a quiz game serves ten practice questions and never an assessment one');
  } else log(true, 'quiz check skipped (exam model needs more fields)');

  // ---- on a phone: two misses bring Loop and the course
  const tctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const p = await tctx.newPage(); p.setDefaultTimeout(20000);
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`${B}/play/${asg.id}`, { waitUntil: 'load' });
  await p.getByTestId('round-start').click();
  await p.getByRole('button', { name: 'Skip' }).click();
  log((await p.evaluate(() => window.localStorage.getItem('aaicbi.game.sound'))) === 'on', 'sounds start switched on for this game (the speaker button turns them off)');
  const pick = async (wrong) => {
    const gp = p.getByTestId('game-player'); await gp.waitFor();
    await gp.locator('fieldset button', { hasText: wrong ? /Wrong choice A/ : /Right choice/ }).first().click();
    await p.getByRole('button', { name: 'Check answer' }).click();
    await p.getByRole('button', { name: /Next question|See my results/ }).waitFor();
  };
  await pick(true);
  log((await p.getByTestId('course-nudge').count()) === 0, 'one miss does not interrupt');
  await p.getByRole('button', { name: /Next question/ }).click();
  await pick(true);
  await p.getByTestId('course-nudge').waitFor();
  const nudgeText = await p.getByTestId('course-nudge').innerText();
  log(/Feed game course/.test(nudgeText) && /Register now/.test(nudgeText), 'after two misses Loop pops up naming the course with a Register now button');
  const href = await p.getByTestId('nudge-register').getAttribute('href');
  log(href === `/courses/${course.id}`, 'Register now leads to the course page');
  await sleep(800);
  const box = await p.getByTestId('course-nudge').locator('[role=dialog]').boundingBox();
  const vp = p.viewportSize();
  log(box && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1, 'the pop-up fits a phone screen as a bottom sheet');
  log((await p.getByTestId('nudge-register').boundingBox()).height >= 44 && (await p.getByTestId('nudge-close').boundingBox()).height >= 44, 'its buttons are big enough to tap');
  await p.screenshot({ path: '/tmp/dev/nudge-phone.png' });
  await p.keyboard.press('Escape');
  await p.getByTestId('course-nudge').waitFor({ state: 'detached' });
  log(true, 'Escape closes it and the game carries on');
  await p.getByRole('button', { name: /Next question/ }).click();
  await pick(true);
  await sleep(500);
  log((await p.getByTestId('course-nudge').count()) === 0, 'it shows once per round, not on every miss');
  for (let q = 4; q <= 10; q++) { await p.getByRole('button', { name: /Next question/ }).click(); await pick(false); }
  await p.getByRole('button', { name: /See my results/ }).click();
  await p.getByTestId('round-summary').waitFor();
  log((await p.getByTestId('play-cta').count()) === 1 && /Register now/.test(await p.getByTestId('play-cta').innerText()), 'the results screen also invites them to register');
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(over <= 1, 'no sideways scrolling on a phone');
  log((await prisma.gamePlay.count()) === before[0], 'a whole round later, still nothing is recorded');
  await p.screenshot({ path: '/tmp/dev/play-summary-phone.png' });

  // ---- switching it off closes it
  r = await put({ live: true, openToVisitors: false });
  r = await post(trainee, `/api/public/play/${asg.id}/next`, { seen: [] });
  log(r.status === 404, 'switched off, the game stops serving at once');
  await ap.goto(B + '/', { waitUntil: 'load' });
  log((await ap.locator(`[data-testid=try-game-link][href="/play/${asg.id}"]`).count()) === 0, 'and leaves the feed');
  r = await put({ live: false });
  log((await prisma.gameAssignment.findUnique({ where: { id: asg.id } })).openToVisitors === false, 'making a game not live also takes it off the feed');
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));

  await br.close();
  for (const c of await prisma.course.findMany({ where: { title: 'Feed game course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.gameAssignment.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  await prisma.game.deleteMany({ where: { title: { startsWith: 'Feed game' } } });
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
