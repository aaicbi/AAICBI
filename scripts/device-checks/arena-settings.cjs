const { B, log, launch, device, signedIn, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  psql(`delete from "ArenaConfig"`);
  const sa = await jar('/api/auth/login', 'super@dev.test');
  const t0 = await jar('/api/auth/trainee-login', 't0@dev.test');
  const staffRole = psql(`select role from "User" where email='staff@dev.test'`);
  const staff = await jar('/api/auth/login', 'staff@dev.test');
  const superId = psql(`select id from "User" where email='super@dev.test'`);
  const staffId = psql(`select id from "User" where email='staff@dev.test'`);
  psql(`delete from "Course" where id in ('arena_c_super','arena_c_staff')`);
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt") values ('arena_c_super','Arena Super Course','x','${superId}',now()),('arena_c_staff','Arena Staff Course','x','${staffId}',now())`);

  // 1. the arena starts off
  let r = await call(sa, 'GET', '/api/admin/arena');
  log(r.s === 200 && r.j.effective.enabled === false && r.j.available.arena === false, 'the arena starts switched off');
  log(r.j.effective.questionSeconds === 15 && r.j.effective.pickSeconds === 10 && r.j.effective.bonusPercent === 50 && r.j.effective.spectators === 'OFF', 'defaults: 15 s per question, 10 s to pick, 50% bonus, spectators off');

  // 2. switches and dependencies
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: true, gameEnabled: true } });
  log(r.s === 200 && r.j.available.game === true, 'a Super Admin can switch the arena and the game on');
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { spectators: 'ENROLLED', ladderEnabled: true } });
  log(r.j.available.spectators === 'ENROLLED' && r.j.available.ladder === true, 'spectators and the ladder can be set while the game is on');
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { gameEnabled: false } });
  log(r.j.available.game === false && r.j.available.spectators === 'OFF' && r.j.available.ladder === false, 'turning the game off turns off spectators and the ladder with it');
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { gameEnabled: true } });

  // 3. clamping and bad input
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { questionSeconds: 0, pickSeconds: 5000 } });
  log(r.j.effective.questionSeconds === 5 && r.j.effective.pickSeconds === 60, 'numbers are clamped (0 seconds becomes 5, 5000 becomes 60)');
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { nonsense: 1 } });
  log(r.s === 400, 'a change with nothing valid is refused');
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { questionSeconds: 15, pickSeconds: 10 } });

  // 4. a course overrides the platform; null goes back
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'COURSE', scopeId: 'arena_c_super', patch: { questionSeconds: 25, enabled: false } });
  log(r.s === 200 && r.j.effective.questionSeconds === 25 && r.j.available.arena === false, 'a course can override the platform (25 s, arena off there)');
  r = await call(sa, 'GET', '/api/admin/arena?scopeType=PLATFORM');
  log(r.j.available.arena === true, 'the platform is still on');
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'COURSE', scopeId: 'arena_c_super', patch: { questionSeconds: null, enabled: null } });
  log(r.j.effective.questionSeconds === 15 && r.j.available.arena === true, 'null goes back to the wider setting');
  r = await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'COURSE', scopeId: 'no_such_course', patch: { enabled: true } });
  log(r.s === 404, 'an unknown course is refused');

  // 5. who may change what
  r = await call(null, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: false } });
  log(r.s === 401 || r.s === 403, 'signed out: refused (' + r.s + ')');
  r = await call(t0, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: false } });
  log(r.s === 401 || r.s === 403, 'a trainee: refused (' + r.s + ')');
  r = await call(staff, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: false } });
  log(r.s === 403 || r.s === 401, staffRole + ': cannot change the switches (' + r.s + ')');
  r = await call(staff, 'PUT', '/api/admin/courses/arena_c_staff/arena', { enabled: false, spectators: 'LIVE', questionSeconds: 20, bonusPercent: 25 });
  log(r.s === 200 && r.j.rules.questionSeconds.value === 20 && r.j.rules.bonusPercent.value === 25, 'the owner sets the rules for their own course');
  r = await call(sa, 'GET', '/api/admin/arena?scopeType=COURSE&scopeId=arena_c_staff');
  log(r.j.own.enabled == null && r.j.own.spectators == null && r.j.own.questionSeconds === 20, 'the owner could not sneak in a switch change, only rules');
  r = await call(staff, 'PUT', '/api/admin/courses/arena_c_super/arena', { questionSeconds: 30 });
  log(r.s === 404 || r.s === 403, "someone else's course: refused (" + r.s + ')');
  r = await call(t0, 'GET', '/api/admin/courses/arena_c_staff/arena');
  log(r.s === 401 || r.s === 403, 'a trainee cannot read course rules (' + r.s + ')');

  // 6. real-time token
  r = await call(null, 'GET', '/api/arena/realtime/token');
  log(r.s === 401, 'no token without signing in');
  r = await call(t0, 'GET', '/api/arena/realtime/token');
  log(r.s === 200 && r.j.mode === 'poll', 'with no Ably key the arena runs in polling mode');
  r = await call(sa, 'POST', '/api/admin/arena/test');
  log(r.s === 200 && r.j.mode === 'poll' && r.j.ok === true, 'the connection test reports polling mode (' + (r.j && r.j.message || '').slice(0, 50) + '…)');

  // 7. the Super Admin page
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/admin/arena', { waitUntil: 'load' });
  await p.getByRole('heading', { name: 'Switches' }).waitFor();
  log(await p.getByText('Polling mode (no key)').isVisible(), 'the page shows polling mode');
  const master = p.getByRole('switch', { name: 'Gaming Arena' });
  log((await master.getAttribute('aria-checked')) === 'true', 'the master switch shows on (as set above)');
  await master.click(); await p.waitForTimeout(700);
  log((await master.getAttribute('aria-checked')) === 'false' && (await p.getByRole('switch', { name: 'Two-player Interview game' }).isDisabled()), 'turning the master off disables the game switch');
  await master.click(); await p.waitForTimeout(700);
  const secs = p.getByLabel('Seconds per question');
  await secs.fill('20'); await secs.blur(); await p.waitForTimeout(700);
  r = await call(sa, 'GET', '/api/admin/arena');
  log(r.j.effective.questionSeconds === 20, 'changing seconds per question on the page saves it');
  await p.getByRole('button', { name: 'One course' }).click(); await p.waitForTimeout(400);
  await p.getByLabel('Course').selectOption('arena_c_staff'); await p.waitForTimeout(600);
  log((await p.getByLabel('Seconds per question').inputValue()) === '20', 'a course shows its own value (20 s set by its owner)');
  await p.getByRole('button', { name: 'Test the connection' }).click(); await p.waitForTimeout(700);
  log(await p.getByRole('status').filter({ hasText: 'polling mode' }).isVisible(), 'the test button reports the result');
  // instructor card on the course page
  const sctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'staff@dev.test');
  const sp = await sctx.newPage(); sp.setDefaultTimeout(15000); sp.on('pageerror', (e) => errs.push(e.message));
  await sp.goto(B + '/admin/courses/arena_c_staff', { waitUntil: 'load' });
  await sp.getByRole('heading', { name: 'Gaming Arena rules' }).waitFor();
  log(true, 'the course page has a Gaming Arena rules card');
  const q = sp.getByLabel('Seconds per question'); await q.fill('18'); await q.blur(); await sp.waitForTimeout(700);
  r = await call(sa, 'GET', '/api/admin/arena?scopeType=COURSE&scopeId=arena_c_staff');
  log(r.j.own.questionSeconds === 18, 'the owner changes seconds per question on the course page');
  log(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await br.close();
  psql(`delete from "ArenaConfig"`); psql(`delete from "Course" where id in ('arena_c_super','arena_c_staff')`);
  process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
