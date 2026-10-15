// Game Studio end to end against the private test database and a stand-in for the Claude API
// (fake-claude-stream.cjs on port 4599): the library, assigning games, items and approval, the preview,
// Loop working inside the studio, what trainees see and earn, and the screens on desktop and phone.
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
async function chat(cookie, { message, conversationId, level, studio }) {
  const form = new FormData();
  form.set('message', message); if (conversationId) form.set('conversationId', conversationId); if (level) form.set('level', String(level));
  if (studio) form.set('studio', JSON.stringify(studio));
  const res = await fetch(B + '/api/admin/loop/chat', { method: 'POST', headers: { Cookie: cookie }, body: form });
  if (!res.ok) return { status: res.status, events: [], cards: [] };
  const events = []; const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let text = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2); if (!line) continue; const ev = JSON.parse(line.slice(6)); events.push(ev); if (ev.type === 'text') text += ev.delta; } }
  return { status: 200, events, text, cards: events.filter((e) => e.type === 'action').map((e) => e.card), meta: events.find((e) => e.type === 'meta') };
}
const MAP = { Trigger: 'Starts a workflow', Action: 'A step it performs', Filter: 'Stops unwanted runs', Webhook: 'A message sent to a URL', Connector: 'Links two apps', Run: 'One execution of a workflow', Task: 'One unit of work' };

async function seed() {
  const staff = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  await prisma.game.deleteMany({ where: { title: { startsWith: 'SC ' } } });
  for (const c of await prisma.course.findMany({ where: { title: 'Studio check course' } })) {
    const ids = (await prisma.module.findMany({ where: { courseId: c.id }, select: { id: true } })).map((m) => m.id);
    await prisma.exam.deleteMany({ where: { moduleId: { in: ids } } });
    await prisma.course.delete({ where: { id: c.id } });
  }
  const t0 = await prisma.trainee.findUnique({ where: { email: 't0@dev.test' } });
  const course = await prisma.course.create({ data: { title: 'Studio check course', status: 'PUBLISHED', published: true, isFree: true, createdById: staff.id } });
  await prisma.courseEnrollment.upsert({ where: { traineeId_courseId: { traineeId: t0.id, courseId: course.id } }, update: { unlockedAt: new Date() }, create: { traineeId: t0.id, courseId: course.id, source: 'ADMIN_GRANTED', unlockedAt: new Date() } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Studio Module One', order: 0 } });
  const exam = await prisma.exam.create({ data: { code: 'STUDIO-' + Math.random().toString(36).slice(2, 8).toUpperCase(), title: 'Studio assessment', moduleId: mod.id, createdById: staff.id, published: true, passMarkPercent: 80, durationMinutes: 30 } });
  const objectives = [];
  for (const [i, text] of ['Explain what a trigger is', 'Choose a suitable automation tool'].entries()) objectives.push(await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text, order: i, confirmedById: staff.id } }));
  let n = 0;
  for (const o of objectives) for (let k = 0; k < 16; k++) { n++; await prisma.question.create({ data: { examId: exam.id, text: `Q${n}: ${o.text}, item ${k + 1}?`, order: n, bankStatus: 'APPROVED', bankObjectiveId: o.id, needsReview: false, options: { create: [{ key: 'A', text: 'Right', isCorrect: true, order: 0 }, { key: 'B', text: 'Wrong', order: 1 }] } } }); }
  await prisma.xpEntry.deleteMany({ where: { traineeId: t0.id } });
  return { staff, t0, course, mod, objectives };
}

(async () => {
  fs.writeFileSync('/tmp/fakeclaude-stream.log', ''); clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staffCk = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const t0Ck = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const t1Ck = jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test'));
  const { staff, t0, course, mod, objectives } = await seed();
  await prisma.loopConversation.deleteMany({ where: { userId: staff.id } });
  const M = mod.id;

  // ---------- access ----------
  let r = await api(staffCk, 'GET', '/api/admin/studio');
  log(r.status === 200 && r.json.courses.every((c) => c.title !== 'Studio check course'), 'an admin who is not a Super Admin opens the studio but sees only their own courses');
  r = await api(t0Ck, 'GET', '/api/admin/studio');
  log([401, 403].includes(r.status), 'nor can a trainee');
  r = await api(sa, 'GET', '/api/admin/studio');
  log(r.status === 200 && r.json.courses.some((c) => c.id === course.id) && r.json.formats.length === 4, 'the Super Admin sees the library, every course and the four formats');

  // ---------- library ----------
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'SC Matching', format: 'MATCHING' });
  const gMatch = r.json.id; log(r.status === 201 && !!gMatch, 'a game can be created');
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'SC Order', format: 'ORDERING' }); const gOrder = r.json.id;
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'SC Scenario', format: 'SCENARIO' }); const gScen = r.json.id;
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'SC Quiz', format: 'QUIZ' }); const gQuiz = r.json.id;
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: 'SC Quiz Two', format: 'QUIZ' }); const gQuiz2 = r.json.id;
  r = await api(sa, 'POST', '/api/admin/studio/games', { title: '', format: 'MATCHING' });
  log(r.status === 400, 'a game needs a name');
  r = await api(sa, 'PATCH', `/api/admin/studio/games/${gMatch}`, { title: 'SC Matching cards', enabledRewards: ['ANSWER', 'BOGUS'] });
  let ov = await api(sa, 'GET', '/api/admin/studio');
  const gm = ov.json.games.find((g) => g.id === gMatch);
  log(gm.title === 'SC Matching cards' && JSON.stringify(gm.enabledRewards) === '["ANSWER"]', 'a game can be renamed and its rewards chosen (unknown rewards are dropped)');

  // ---------- items ----------
  let ws = await api(sa, 'GET', `/api/admin/studio/modules/${M}`);
  log(ws.status === 200 && ws.json.quest.objectives.length === 2 && ws.json.items.length === 0, 'a module workspace lists its objectives and no items yet');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: objectives[0].id, format: 'MATCHING', content: { pairs: [{ left: 'a', right: 'b' }] } });
  log(r.status === 400 && /3 to 6 pairs/.test(r.json.error), 'an item that is not valid is refused with a plain reason');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: 'nope', format: 'MATCHING', content: {} });
  log(r.status === 400, 'an objective from another module is refused');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: objectives[0].id, format: 'MATCHING', content: { prompt: 'Match', pairs: [{ left: 'Trigger', right: 'Starts a workflow' }, { left: 'Action', right: 'A step it performs' }, { left: 'Filter', right: 'Stops unwanted runs' }] } });
  const item1 = r.json.id; log(r.status === 201 && r.json.status === 'APPROVED', 'an item a person writes is approved straight away');

  // ---------- assignment rules ----------
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gOrder}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 409 && /Approve at least one/.test(r.json.error), 'a game with nothing approved cannot go live');
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gMatch}/assign`, { moduleId: M, assigned: true, live: false });
  log(r.status === 200, 'a game can be assigned to a module without being live');
  r = await api(t0Ck, 'GET', `/api/modules/${M}/games`);
  log(r.status === 200 && r.json.games.length === 0, 'an assigned game that is not live is invisible to trainees');
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gMatch}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 200, 'a game with an approved item can go live');

  // quiz game: needs pools ready, one live quiz per module, switches practice on and off
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gQuiz}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 409 && /approved practice/.test(r.json.error), 'a quiz game cannot go live until every objective has enough approved questions');
  await api(sa, 'POST', `/api/modules/${M}/quest`, { action: 'autoSplit' });
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gQuiz}/assign`, { moduleId: M, assigned: true, live: true });
  const settings = await prisma.moduleQuestSettings.findUnique({ where: { moduleId: M } });
  log(r.status === 200 && settings.practiceEnabled === true, 'once the pools are ready, a quiz game goes live and switches the module’s practice on');
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gQuiz2}/assign`, { moduleId: M, assigned: true, live: true });
  log(r.status === 409 && /already has a live quiz game/.test(r.json.error), 'only one quiz game can be live in a module');
  r = await api(sa, 'PUT', `/api/admin/studio/games/${gQuiz}/assign`, { moduleId: M, assigned: false });
  log((await prisma.moduleQuestSettings.findUnique({ where: { moduleId: M } })).practiceEnabled === false, 'removing a live quiz game switches the module’s practice off');
  await api(sa, 'PUT', `/api/admin/studio/games/${gQuiz}/assign`, { moduleId: M, assigned: true, live: true });

  // ---------- preview ----------
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/preview`, { format: 'MATCHING', index: 0 });
  log(r.status === 200 && r.json.served.format === 'MATCHING' && !/pairs|correct/i.test(JSON.stringify(r.json.served)), 'the preview serves an item without its answer key');
  const xpBefore = await prisma.xpEntry.count(); const playsBefore = await prisma.gamePlay.count();
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/preview/grade`, { format: 'MATCHING', itemId: item1, response: { matches: { 0: 'Starts a workflow', 1: 'A step it performs', 2: 'Stops unwanted runs' } } });
  log(r.status === 200 && r.json.correct === true, 'a preview answer is graded');
  log((await prisma.xpEntry.count()) === xpBefore && (await prisma.gamePlay.count()) === playsBefore, 'a preview records nothing and pays no XP');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/preview`, { format: 'QUIZ', index: 3 });
  log(r.status === 200 && r.json.served.format === 'QUIZ' && !/isCorrect|explanation/.test(JSON.stringify(r.json.served)), 'a quiz preview works from the approved question bank, also without a key');
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/preview`, { format: 'ORDERING', index: 0 });
  log(r.status === 200 && r.json.empty === true, 'a format with nothing written previews as empty');

  // ---------- trainee play ----------
  r = await api(t0Ck, 'GET', `/api/modules/${M}/games`);
  log(r.status === 200 && r.json.games.some((g) => g.id === gMatch) && r.json.games.some((g) => g.format === 'QUIZ'), 'an enrolled trainee sees the live games of the module');
  r = await api(t1Ck, 'GET', `/api/modules/${M}/games`);
  log(r.status === 404, 'a trainee who is not enrolled sees nothing');
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gOrder}/next`);
  log(r.status === 404, 'a game that is not live cannot be played');
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/next`);
  const play = r.json;
  log(r.status === 200 && play.format === 'MATCHING' && play.served.lefts.length === 3 && !/Starts a workflow.*pairs|"pairs"/.test(JSON.stringify(play)), 'a trainee is served an item with no answer key');
  const answerOf = (served) => Object.fromEntries(served.lefts.map((l, i) => [String(i), MAP[l]]));
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/answer`, { playId: play.playId, response: { matches: { 0: 'x' } } });
  log(r.status === 400, 'an incomplete answer is refused');
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/answer`, { playId: play.playId, response: { matches: answerOf(play.served) } });
  log(r.status === 200 && r.json.correct === true && r.json.tooFast === true && r.json.xp.earned === 0, 'a correct answer given too quickly earns no XP');
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/answer`, { playId: play.playId, response: { matches: answerOf(play.served) } });
  log(r.json.repeated === true, 'answering the same play twice changes nothing');
  await prisma.gamePlay.deleteMany({ where: { traineeId: t0.id } }); await prisma.xpEntry.deleteMany({ where: { traineeId: t0.id } });
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/next`); const play2 = r.json;
  await sleep((play2.minSeconds + 0.4) * 1000);
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/answer`, { playId: play2.playId, response: { matches: answerOf(play2.served) } });
  log(r.status === 200 && r.json.correct === true && r.json.xp.earned === 10, 'a correct answer at a normal pace earns 10 XP');
  const ledger = await prisma.xpEntry.findMany({ where: { traineeId: t0.id } });
  log(ledger.length === 1 && /^GANSWER:/.test(ledger[0].dedupeKey), 'the XP goes through the same ledger, once');

  // ---------- Loop in the studio ----------
  clearThrottle();
  r = await chat(sa, { message: 'GAME:SC Loop game', level: 1, studio: { moduleId: M, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].kind === 'create_game' && r.cards[0].status === 'PENDING', 'studio, level 1: creating a game waits for approval');
  log((await prisma.game.count({ where: { title: 'SC Loop game' } })) === 0, 'nothing was created before approval');
  let log1 = fs.readFileSync('/tmp/fakeclaude-stream.log', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  log(log1.some((x) => /Game Studio/.test(x.system) && /Studio Module One/.test(x.system)), 'Loop is told it is in the Game Studio and which module is selected');
  log(log1.some((x) => !x.tools.includes('add_game_items') && x.tools.includes('approve_game_items') && x.tools.includes('assign_game')), 'Loop is offered the studio actions, and no longer one that writes game items');
  r = await api(sa, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'approve' });
  log(r.json.status === 'EXECUTED' && (await prisma.game.count({ where: { title: 'SC Loop game' } })) === 1, 'approving creates the game');

  r = await chat(sa, { message: 'ITEMS:Studio Module One.', level: 2, studio: { moduleId: M, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].kind === 'save_learning_objectives' && r.cards[0].status === 'EXECUTED' && r.cards[0].autoExecuted, 'level 2: a low-risk change happens at once');
  // game items now arrive by import as drafts; two drafts stand in for that here
  const draftA = { prompt: 'Match the automation terms', pairs: [{ left: 'Trigger', right: 'Starts a workflow' }, { left: 'Action', right: 'A step it performs' }, { left: 'Filter', right: 'Stops unwanted runs' }] };
  const draftB = { prompt: 'Match the app terms', pairs: [{ left: 'Webhook', right: 'A message sent to a URL' }, { left: 'Connector', right: 'Links two apps' }, { left: 'Run', right: 'One execution of a workflow' }, { left: 'Task', right: 'One unit of work' }] };
  await prisma.gameItem.createMany({ data: [draftA, draftB].map((content) => ({ moduleId: M, objectiveId: objectives[0].id, format: 'MATCHING', content, status: 'DRAFT', source: 'LOOP' })) });
  const drafts = await prisma.gameItem.findMany({ where: { moduleId: M, source: 'LOOP' } });
  log(drafts.length === 2 && drafts.every((d) => d.status === 'DRAFT'), 'imported items wait as drafts');
  r = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/next`);
  const served = [];
  for (let i = 0; i < 6; i++) { const x = await api(t0Ck, 'POST', `/api/modules/${M}/games/${gMatch}/next`); served.push(JSON.stringify(x.json.served ?? {})); }
  log(!served.some((s) => /Webhook/.test(s)), 'trainees never get a draft item');

  r = await chat(sa, { message: 'APPROVE:Studio Module One.', level: 3, studio: { moduleId: M, gameId: gMatch } });
  log(r.cards.length === 1 && r.cards[0].kind === 'approve_game_items' && r.cards[0].status === 'PENDING', 'level 3: approving drafts still waits for a person');
  log((await prisma.gameItem.count({ where: { moduleId: M, status: 'DRAFT' } })) === 2, 'the drafts are still drafts');
  r = await api(sa, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'approve' });
  log(r.json.status === 'EXECUTED' && r.json.result.approved === 2 && (await prisma.gameItem.count({ where: { moduleId: M, status: 'APPROVED' } })) === 3, 'approving makes them playable');
  r = await chat(sa, { message: 'ASSIGN:SC Loop game|Studio Module One.', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.cards.length === 1 && r.cards[0].status === 'EXECUTED', 'level 3: Loop assigns the game and makes it live');
  const asg = await prisma.gameAssignment.findFirst({ where: { moduleId: M, game: { title: 'SC Loop game' } } });
  log(asg && asg.live === true, 'the game is live in the module');
  r = await chat(sa, { message: 'ASSIGN:SC Scenario|Studio Module One.', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.cards[0].status === 'FAILED' && /Approve at least one/.test(r.cards[0].error), 'Loop cannot make a game live with nothing approved, and says why');

  // ---------- items: review ----------
  ws = await api(sa, 'GET', `/api/admin/studio/modules/${M}`);
  const loopItem = ws.json.items.find((i) => i.source === 'LOOP');
  r = await api(sa, 'PATCH', `/api/admin/studio/modules/${M}/items/${loopItem.id}`, { content: { prompt: 'Edited', pairs: [{ left: 'A1', right: 'B1' }, { left: 'A2', right: 'B2' }, { left: 'A3', right: 'B3' }] } });
  ws = await api(sa, 'GET', `/api/admin/studio/modules/${M}`);
  log(ws.json.items.find((i) => i.id === loopItem.id).status === 'DRAFT', 'editing an item sends it back to draft to be looked at again');
  r = await api(sa, 'PATCH', `/api/admin/studio/modules/${M}/items/${loopItem.id}`, { status: 'REJECTED' });
  r = await api(sa, 'POST', `/api/admin/studio/modules/${M}/preview`, { format: 'MATCHING', index: 0 });
  log(r.json.total === 2, 'a rejected item no longer appears in the preview');
  for (const i of ws.json.items.filter((x) => x.format === 'MATCHING')) await api(sa, 'DELETE', `/api/admin/studio/modules/${M}/items/${i.id}`);
  const live = await prisma.gameAssignment.findMany({ where: { moduleId: M, game: { format: 'MATCHING' } } });
  log(live.length >= 1 && live.every((a) => a.live === false), 'when the last item is deleted, a live game goes back to waiting');

  // ---------- screens ----------
  clearThrottle();
  await prisma.userNotification.deleteMany({ where: { recipientId: staff.id } }).catch(() => {});
  await prisma.loopConversation.deleteMany({ where: { userId: staff.id } });
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1480, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await p.getByTestId('new-game').waitFor();
  log(await p.locator('a[href="/admin/studio"]').first().isVisible(), 'Game Studio is in the sidebar');
  log((await p.getByTestId('loop-panel').getByRole('heading', { name: 'What shall we build?' }).count()) === 1, 'the Loop chat is on the same page, ready to build');
  await p.screenshot({ path: '/tmp/dev/studio-empty.png' });

  await p.getByTestId('new-game').click();
  await p.getByLabel('Name', { exact: true }).fill('SC Ui game');
  await p.getByRole('button', { name: 'Create', exact: true }).click();
  await p.getByTestId('game-detail').waitFor();
  log(/SC Ui game/.test(await p.getByTestId('game-detail').innerText()), 'a new game is created from the studio and opens for editing');
  const url0 = p.url();
  // two imported drafts for the workspace to show (game items now arrive by import)
  await prisma.gameItem.createMany({ data: [{ prompt: 'Match the shown terms', pairs: [{ left: 'Trigger', right: MAP.Trigger }, { left: 'Action', right: MAP.Action }, { left: 'Filter', right: MAP.Filter }] }, { prompt: 'Match more terms', pairs: [{ left: 'Webhook', right: MAP.Webhook }, { left: 'Connector', right: MAP.Connector }, { left: 'Run', right: MAP.Run }] }].map((content) => ({ moduleId: M, objectiveId: objectives[0].id, format: 'MATCHING', content, status: 'DRAFT', source: 'IMPORT' })) });
  await p.getByRole('button', { name: 'Studio check course' }).click();
  await p.getByTestId('module-row').filter({ hasText: 'Studio Module One' }).click();
  await p.getByTestId('items-card').waitFor();
  log(true, 'choosing a module shows its items without leaving the page');

  await p.getByTestId('game-detail').getByLabel('This game is part of Studio Module One').click();
  await p.waitForFunction(() => document.querySelector('[data-testid=game-detail] input[type=checkbox]:not([disabled])'));
  log((await prisma.gameAssignment.count({ where: { moduleId: M, game: { title: 'SC Ui game' } } })) === 1, 'the game is assigned to the module from the studio');

  await p.locator('[data-testid=item-row][data-status=DRAFT]').first().waitFor();
  log((await p.locator('[data-testid=item-row][data-status=DRAFT]').count()) === 2, 'the imported drafts appear in the workspace');
  // preview shows the draft badge
  for (let i = 0; i < 4 && !(await p.getByText("Draft: trainees can't see this yet").count()); i++) {
    const next = p.getByTestId('preview-card').getByRole('button', { name: /Next item/ }).first();
    if (await next.count()) await next.click();
    await sleep(600);
  }
  log((await p.getByText("Draft: trainees can't see this yet").count()) >= 1, 'the preview plays drafts and marks them as drafts');
  // play it in the preview: pair terms by clicking
  const card = p.getByTestId('preview-card');
  for (const left of await card.locator('ul[aria-label=Terms] button').allInnerTexts()) {
    await card.locator('ul[aria-label=Terms] button', { hasText: new RegExp(`^\\s*${left.trim()}\\s*$`) }).first().click();
    await card.locator('ul[aria-label=Meanings] button', { hasText: MAP[left.trim()] }).first().click();
  }
  await card.getByRole('button', { name: 'Check answer' }).click();
  await card.getByText('Correct', { exact: true }).waitFor();
  log(/Preview only/.test(await card.innerText()), 'trying the game in the preview says nothing is recorded');
  await p.screenshot({ path: '/tmp/dev/studio-desktop.png' });

  await p.getByTestId('approve-all').click();
  await p.locator('[data-testid=item-row][data-status=DRAFT]').first().waitFor({ state: 'detached' });
  log((await prisma.gameItem.count({ where: { moduleId: M, status: 'APPROVED' } })) >= 2, 'approve all makes the drafts playable');
  await p.getByTestId('game-detail').getByLabel(/Live: trainees can play it/).click();
  await p.waitForFunction(async () => true);
  await sleep(700);
  log((await prisma.gameAssignment.findFirst({ where: { moduleId: M, game: { title: 'SC Ui game' } } })).live === true, 'the game is made live from the studio');
  log(errors.length === 0, 'no page errors on desktop' + (errors.length ? ': ' + errors[0] : ''));

  // phone: panels become tabs
  const pctx = await signedIn(br, device('iPhone 13'), '/api/auth/login', 'super@dev.test');
  const pp = await pctx.newPage(); pp.setDefaultTimeout(20000);
  await pp.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await pp.getByTestId('tab-library').waitFor();
  await pp.getByTestId('tab-preview').click();
  await pp.getByTestId('preview-card').waitFor({ state: 'visible' });
  await pp.getByTestId('tab-loop').click();
  await pp.getByTestId('loop-panel').waitFor({ state: 'visible' });
  log(true, 'on a phone the library, build, preview and Loop panels are tabs');
  const over = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(over <= 1, 'no sideways scrolling on a phone');
  await pp.screenshot({ path: '/tmp/dev/studio-phone.png' });

  // trainee screens
  const tctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const tp = await tctx.newPage(); tp.setDefaultTimeout(20000);
  await tp.goto(`${B}/trainee/courses/${course.id}`, { waitUntil: 'load' });
  await tp.waitForTimeout(2500);
  if (!(await tp.getByTestId('games-strip').count())) await tp.getByText('Studio Module One').first().click().catch(() => {});
  await tp.getByTestId('games-strip').first().waitFor();
  log(/SC Ui game|SC Loop game/.test(await tp.getByTestId('games-strip').innerText()), 'the trainee’s course page shows the live games');
  log((await tp.getByTestId('game-tile').count()) >= 1, 'each live game is a colourful tile on the course page');
  log((await tp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'the course page has no sideways scrolling on a phone with the game tiles');
  await tp.getByTestId('games-strip').screenshot({ path: '/tmp/dev/course-games-phone.png' });
  await tp.getByTestId('games-strip').getByRole('link').first().click();
  await tp.getByTestId('round-start').click();   // the round's welcome and countdown come first
  await tp.getByRole('button', { name: 'Skip' }).click();
  await tp.getByTestId('game-player').waitFor();
  log(/never counts toward your certificate/.test((await tp.locator('main').innerText()).replace(/\n/g, ' ')), 'the game page says the XP never counts toward the certificate');
  await sleep(4000);
  for (const left of await tp.locator('ul[aria-label=Terms] button').allInnerTexts()) {
    await tp.locator('ul[aria-label=Terms] button', { hasText: new RegExp(`^\\s*${left.trim()}\\s*$`) }).first().click();
    await tp.locator('ul[aria-label=Meanings] button', { hasText: MAP[left.trim()] }).first().click();
  }
  await tp.getByRole('button', { name: 'Check answer' }).click();
  await tp.getByText('Correct', { exact: true }).waitFor();
  log(true, 'a trainee can play and is told the result');
  await tp.screenshot({ path: '/tmp/dev/studio-trainee.png' });
  const tover = await tp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(tover <= 1, 'no sideways scrolling on the trainee game page');
  await br.close();

  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
