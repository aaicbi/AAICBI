// Tool permissions for staff and the change-request inbox, against the private test database and the stand-in Claude API.
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
async function chat(cookie, { message, level, studio }) {
  const form = new FormData();
  form.set('message', message); if (level) form.set('level', String(level)); if (studio) form.set('studio', JSON.stringify(studio));
  const res = await fetch(B + '/api/admin/loop/chat', { method: 'POST', headers: { Cookie: cookie }, body: form });
  if (!res.ok) return { status: res.status, json: await res.json().catch(() => ({})), events: [], cards: [] };
  const events = []; const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) { const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2); if (!line) continue; events.push(JSON.parse(line.slice(6))); } }
  return { status: 200, events, cards: events.filter((e) => e.type === 'action').map((e) => e.card), text: events.filter((e) => e.type === 'text').map((e) => e.delta).join('') };
}
const lastRequest = () => fs.readFileSync('/tmp/fakeclaude-stream.log', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).pop();

(async () => {
  fs.writeFileSync('/tmp/fakeclaude-stream.log', ''); clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const superUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@dev.test' } });
  await prisma.changeRequest.deleteMany({});
  await prisma.game.deleteMany({ where: { title: { startsWith: 'PR ' } } });
  for (const c of await prisma.course.findMany({ where: { title: 'Permissions org course' } })) await prisma.course.delete({ where: { id: c.id } });
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null, loopMaxLevel: 3, loopLevel: 3 } });
  const course = await prisma.course.create({ data: { title: 'Permissions org course', status: 'PUBLISHED', published: true, isFree: true, createdById: staffUser.id } });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: 'Permissions Module', order: 0 } });
  const obj = await prisma.moduleLearningObjective.create({ data: { moduleId: mod.id, text: 'Explain a trigger', order: 0, confirmedById: superUser.id } });
  const M = mod.id;
  const setPerms = (permissions) => api(sa, 'PUT', '/api/admin/studio/people', { userId: staffUser.id, permissions });

  // ---------- permissions ----------
  let r = await api(staff, 'GET', '/api/admin/studio');
  log(r.status === 200 && ['LOOP', 'GAMES', 'ITEMS', 'ASSIGN', 'QUESTIONS'].every((k) => r.json.permissions.includes(k)) && !r.json.permissions.includes('MESSAGING'), 'a person nobody configured gets the studio set and no platform-wide tools');
  r = await api(sa, 'GET', '/api/admin/studio/people');
  const row = r.json.people.find((p) => p.id === staffUser.id);
  log(r.json.permissionOptions.some((o) => o.key === 'MESSAGING' && o.wide) && row.permissions.length === 5, 'the Super Admin sees every tool and which ones reach all organisations');
  r = await api(staff, 'PUT', '/api/admin/studio/people', { userId: staffUser.id, permissions: ['MESSAGING'] });
  log([401, 403].includes(r.status), 'staff cannot grant themselves tools');

  r = await setPerms(['LOOP', 'GAMES']);
  log(r.status === 200, 'the Super Admin narrows this person to Loop and making games');
  r = await api(staff, 'POST', '/api/admin/studio/games', { title: 'PR game', format: 'MATCHING' });
  const g = r.json.id; log(r.status === 201, 'they can still make a game');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/items`, { objectiveId: obj.id, format: 'MATCHING', content: { prompt: 'x', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }, { left: 'e', right: 'f' }] } });
  log(r.status === 403 && /permission/i.test(r.json.error), 'writing items is refused with a plain reason');
  r = await api(staff, 'PUT', `/api/admin/studio/games/${g}/assign`, { moduleId: M, assigned: true });
  log(r.status === 403, 'assigning a game is refused');
  r = await api(staff, 'POST', `/api/modules/${M}/quest`, { action: 'autoSplit' });
  log(r.status === 403, 'changing question pools is refused');
  r = await api(staff, 'POST', `/api/admin/studio/modules/${M}/items/approve`, { format: 'MATCHING' });
  log(r.status === 403, 'approving items is refused');

  r = await chat(staff, { message: 'GAME:PR Loop game', level: 3, studio: { moduleId: M, gameId: null } });
  let req = lastRequest();
  log(req.tools.includes('create_game') && !req.tools.includes('add_game_items') && !req.tools.includes('assign_game') && !req.tools.includes('split_question_pools') && !req.tools.includes('search_people') && !req.tools.includes('send_message'), 'Loop offers exactly the tools they were allowed');
  log(/NOT allowed to/.test(req.system) && /write and approve items/.test(req.system), 'Loop is told what they may not do');
  r = await chat(staff, { message: 'PEOPLE:Ada', level: 3, studio: { moduleId: M, gameId: null } });
  log(r.status === 200 && /not allowed to look people up/.test(r.text) && !/Here are the people/.test(r.text), 'calling a tool they were not given is refused by the server, not just hidden');

  r = await setPerms(['GAMES', 'ITEMS']);
  r = await chat(staff, { message: 'GAME:PR No loop', level: 1 });
  log(r.status === 403, 'without the Loop permission Loop is closed to them');

  r = await setPerms(['LOOP', 'GAMES', 'ITEMS', 'ASSIGN', 'QUESTIONS', 'MESSAGING', 'PEOPLE_DATA', 'ANALYTICS']);
  r = await chat(staff, { message: 'GAME:PR Wide', level: 1, studio: { moduleId: M, gameId: null } });
  req = lastRequest();
  log(['search_people', 'send_message', 'resolve_recipients', 'get_platform_overview', 'get_trainee_report'].every((t) => req.tools.includes(t)) && !req.tools.includes('log_change_request') && !req.tools.includes('get_cohort_report'), 'allowed platform tools appear, the others do not, and change requests stay with the Super Admin');
  r = await setPerms([]);
  r = await api(staff, 'GET', '/api/admin/studio');
  log(r.json.permissions.length === 0, 'an empty list really is empty (not the default)');
  r = await setPerms(['LOOP', 'GAMES', 'ITEMS', 'ASSIGN', 'QUESTIONS']);

  // ---------- change requests ----------
  r = await api(staff, 'POST', '/api/admin/requests', { title: 'x', details: 'short' });
  log(r.status === 400, 'a request needs a real title and details');
  r = await api(staff, 'POST', '/api/admin/requests', { title: 'Show module numbers', details: 'Show the module number next to each module in the studio list.', page: '/admin/studio' });
  const rid = r.json.id; log(r.status === 201 && r.json.status === 'PROPOSED', 'staff can propose a change');
  r = await api(staff, 'PATCH', `/api/admin/requests/${rid}`, { status: 'APPROVED' });
  log([401, 403].includes(r.status), 'staff cannot approve, not even their own');
  r = await api(sa, 'GET', '/api/admin/requests/brief');
  log(r.json.count === 0 && /no approved requests/.test(r.json.markdown), 'nothing is handed to Claude Code before approval');
  r = await api(staff, 'GET', '/api/admin/requests/brief');
  log([401, 403].includes(r.status), 'staff cannot read the hand-off');
  r = await api(staff, 'GET', '/api/admin/requests');
  log(r.json.requests.length === 1 && r.json.isSuper === false, 'staff see their own requests');
  r = await api(sa, 'PATCH', `/api/admin/requests/${rid}`, { status: 'DONE' });
  log(r.status === 409, 'a request cannot skip approval');
  r = await api(sa, 'PATCH', `/api/admin/requests/${rid}`, { status: 'APPROVED', note: 'Desktop list only' });
  log(r.status === 200 && r.json.issueUrl === null, 'the Super Admin approves it (no GitHub issue is opened because none is configured)');
  r = await api(sa, 'GET', '/api/admin/requests/brief');
  log(r.json.count === 1 && /Show module numbers/.test(r.json.markdown) && /Agreed: Desktop list only/.test(r.json.markdown) && /Asked by:/.test(r.json.markdown), 'the approved request appears in the hand-off with what was agreed');
  const dl = await fetch(B + '/api/admin/requests/brief?download=1', { headers: { Cookie: sa } });
  log(dl.status === 200 && /attachment/.test(dl.headers.get('content-disposition') || ''), 'the hand-off downloads as a file');

  r = await chat(sa, { message: 'REQ:Number the modules', level: 3 });
  const created = await prisma.changeRequest.findFirst({ where: { title: 'Number the modules' } });
  log(created && created.status === 'PROPOSED', 'Loop saves a request as waiting, even at level 3: it cannot approve one');

  r = await api(sa, 'PATCH', `/api/admin/requests/${rid}`, { status: 'DONE', prUrl: 'javascript:alert(1)' });
  const done = await prisma.changeRequest.findUnique({ where: { id: rid } });
  log(r.status === 200 && done.status === 'DONE' && done.prUrl === null, 'marking it done drops a link that is not a web link');

  // ---------- UI ----------
  const browser = await launch(); const dv = device('desktop');
  const ctx = await browser.newContext(dv.context); await ctx.addCookies(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const pg = await ctx.newPage(); const errors = []; pg.on('pageerror', (e) => errors.push(e.message));
  await prisma.changeRequest.create({ data: { title: 'UI request', details: 'A request created for the page check.', authorId: staffUser.id } });
  await pg.goto(B + '/admin/requests'); await pg.waitForSelector('[data-testid="requests-inbox"]');
  await pg.waitForSelector('[data-testid="request-card"]');
  log((await pg.locator('[data-testid="approve-request"]').count()) >= 1 && (await pg.locator('[data-testid="brief-card"]').count()) === 1, 'the Super Admin sees approve buttons and the hand-off card');
  await pg.locator('[data-testid="request-card"]', { hasText: 'UI request' }).locator('[data-testid="approve-request"]').click();
  await pg.waitForFunction(() => /1 approved/i.test(document.querySelector('[data-testid="brief-card"]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  log((await pg.locator('[data-testid="brief-card"]').innerText()).match(/1 approved/i) !== null, 'approving on the page moves it into the hand-off count');
  await pg.goto(B + '/admin/studio'); await pg.waitForSelector('[data-testid="people-panel"]');
  await pg.getByRole('button', { name: /Your team/i }).click();
  await pg.locator(`[data-testid="permissions-toggle-${staffUser.id}"]`).click();
  const boxes = pg.locator(`ul[aria-label*="may use"] input[type="checkbox"]`);
  log((await boxes.count()) === 11, 'the People panel lists all eleven tools with checkboxes');
  await pg.screenshot({ path: '/tmp/dev/permissions-panel.png' });
  const sctx = await browser.newContext(dv.context); await sctx.addCookies(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const sp = await sctx.newPage(); sp.on('pageerror', (e) => errors.push(e.message));
  await sp.goto(B + '/admin/requests'); await sp.waitForSelector('[data-testid="requests-inbox"]');
  log((await sp.locator('[data-testid="approve-request"]').count()) === 0 && (await sp.locator('[data-testid="brief-card"]').count()) === 0, 'staff see no approve buttons and no hand-off card');
  log((await sp.locator('nav a[href="/admin/requests"], aside a[href="/admin/requests"]').count()) === 0, 'Change requests is not in the sidebar for staff');
  log(errors.length === 0, 'no page errors');
  await browser.close();
  await prisma.user.update({ where: { id: staffUser.id }, data: { studioPermissions: null, loopMaxLevel: 1, loopLevel: 1 } });
  await prisma.game.deleteMany({ where: { title: { startsWith: 'PR ' } } });
  await prisma.course.delete({ where: { id: course.id } });
  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
