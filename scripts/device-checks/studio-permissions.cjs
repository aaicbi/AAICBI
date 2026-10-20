// The Gaming Studio and Gaming Operations are separate permissions. Organizations never have the Studio; staff have exactly what they were granted,
// action by action; moderation never opens the Studio; revoking applies on the next request; the menu follows the permissions.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const no = (s) => [401, 403].includes(s);
(async () => {
  clearThrottle();
  psql(`update "User" set "staffRoleKey"=null, "permissionGrants"='{}', "permissionDenies"='{}', active=true where email='staff@dev.test'`);
  psql(`delete from "Game" where title like 'PERM %'`);
  psql(`delete from "AuditEvent"`);
  const S = await jar('super@dev.test'), ST = await jar('staff@dev.test'), ORG = await jar('org@dev.test', '/api/auth/training-org-login');
  const staffId = psql(`select id from "User" where email='staff@dev.test'`);
  const moduleId = psql(`select id from "Module" limit 1`);
  const setAccess = (key, grants, denies = []) => call(S, 'PUT', `/api/admin/staff/${staffId}/access`, { staffRoleKey: key, grants, denies });
  const studioPaths = [['GET', '/api/admin/studio'], ['POST', '/api/admin/studio/games', { title: 'PERM x', format: 'QUIZ' }], ['GET', `/api/admin/studio/modules/${moduleId}`], ['GET', `/api/modules/${moduleId}/quest`], ['POST', '/api/admin/loop/chat', { message: 'hi' }], ['GET', '/api/admin/loop/conversations'], ['GET', '/api/admin/arena'], ['PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: {} }]];

  // ---- training organizations: never
  let bad = [];
  for (const [m, p, b] of studioPaths) { const r = await call(ORG, m, p, b); if (!no(r.s)) bad.push(`${m} ${p} -> ${r.s}`); }
  log(bad.length === 0, 'a training organization is refused by every Studio, Studio-Loop and game-settings endpoint' + (bad.length ? ': ' + bad.join('; ') : ''));
  let r = await call(ORG, 'GET', '/api/admin/game-results');
  log(no(r.s), 'and by the platform game results (it has its own Games section for its own trainees)');
  r = await call(ORG, 'GET', '/api/admin/me/access');
  log(r.j.kind === 'organization' && r.j.permissions.every((k) => k.startsWith('org_games.')), 'an organization\'s permissions are only organization-games ones: ' + r.j.permissions.length);

  // ---- untouched staff: no studio
  bad = [];
  for (const [m, p, b] of studioPaths) { r = await call(ST, m, p, b); if (!no(r.s)) bad.push(`${m} ${p} -> ${r.s}`); }
  log(bad.length === 0, 'an untouched admin has no Studio' + (bad.length ? ': ' + bad.join('; ') : ''));

  // ---- moderation does not open the Studio
  await setAccess('gaming_ops_moderator', []);
  r = await call(ST, 'GET', '/api/admin/game-results');
  log(r.s === 200, 'a gaming moderator can open the game results');
  bad = [];
  for (const [m, p, b] of studioPaths) { r = await call(ST, m, p, b); if (!no(r.s)) bad.push(`${m} ${p} -> ${r.s}`); }
  log(bad.length === 0, 'but gaming moderation permissions never open the Studio, its Loop or the game settings' + (bad.length ? ': ' + bad.join('; ') : ''));
  r = await call(ST, 'GET', '/api/admin/game-results?format=csv');
  log(no(r.s), 'and viewing results does not allow downloading them');
  await setAccess('gaming_ops_moderator', ['gaming_ops.results:export']);
  r = await call(ST, 'GET', '/api/admin/game-results?format=csv');
  log(r.s === 200 && /Name,Email/.test(r.t), 'with the Export permission they can');
  log(Number(psql(`select count(*) from "AuditEvent" where action='GAME_RESULTS_EXPORTED'`)) === 1, 'and the export is recorded');

  // ---- Studio access, view only
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view']);
  r = await call(ST, 'GET', '/api/admin/studio');
  log(r.s === 200, 'a staff member given Studio access and "view configurations" can open the Studio');
  r = await call(ST, 'POST', '/api/admin/studio/games', { title: 'PERM one', format: 'MATCHING' });
  log(no(r.s), 'but cannot create a game');
  r = await call(ST, 'POST', `/api/admin/studio/modules/${moduleId}/preview`, { format: 'QUIZ', index: 0 });
  log(no(r.s), 'nor preview or test one');
  r = await call(ST, 'GET', '/api/admin/arena');
  log(no(r.s), 'nor see the global game settings');
  r = await call(ST, 'POST', '/api/admin/loop/chat', { message: 'hi' });
  log(no(r.s), 'nor use Loop in the Studio');

  // ---- add create: then publish and delete stay separate
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view', 'gaming_studio.games:create', 'gaming_studio.games:edit']);
  r = await call(ST, 'POST', '/api/admin/studio/games', { title: 'PERM one', format: 'MATCHING' });
  const gid = r.j.id;
  log(r.s === 201 && gid, 'with Create they can make a game');
  r = await call(ST, 'PATCH', `/api/admin/studio/games/${gid}`, { title: 'PERM renamed' });
  log(r.s === 200, 'and rename it with Edit');
  r = await call(ST, 'PATCH', `/api/admin/studio/games/${gid}`, { enabledRewards: ['XP'] });
  log(no(r.s), 'but changing rewards is an engine setting they do not have');
  r = await call(ST, 'PUT', `/api/admin/studio/games/${gid}/assign`, { moduleId, assigned: true, live: false });
  log(no(r.s), 'attaching it to a module needs Manage');
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view', 'gaming_studio.games:create', 'gaming_studio.games:edit', 'gaming_studio.games:manage']);
  r = await call(ST, 'PUT', `/api/admin/studio/games/${gid}/assign`, { moduleId, assigned: true, live: false });
  log(r.s === 200, 'with Manage they can attach it (still off)');
  r = await call(ST, 'PUT', `/api/admin/studio/games/${gid}/assign`, { moduleId, assigned: true, live: true });
  log(no(r.s), 'but switching it live needs Publish');
  r = await call(ST, 'PUT', `/api/admin/studio/games/${gid}/assign`, { moduleId, assigned: true, openToVisitors: true });
  log(no(r.s), 'and so does showing it on the feed');
  r = await call(ST, 'DELETE', `/api/admin/studio/games/${gid}`);
  log(no(r.s), 'and deleting needs Delete');
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view', 'gaming_studio.games:delete']);
  r = await call(ST, 'DELETE', `/api/admin/studio/games/${gid}`);
  log(r.s === 200, 'with Delete they can remove it');
  log(Number(psql(`select count(*) from "AuditEvent" where action='GAME_DELETED'`)) === 1, 'and it is recorded');

  // ---- revoking applies at once
  await setAccess('custom', []);
  r = await call(ST, 'GET', '/api/admin/studio');
  log(no(r.s), 'taking the access away closes the Studio on the next request');

  // ---- settings permission
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.settings:configure']);
  r = await call(ST, 'GET', '/api/admin/arena');
  log(r.s === 200, 'global game settings need their own permission');
  r = await call(ST, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { chatEnabled: true } });
  log(r.s === 200 || r.s === 400, 'and can be changed with it (' + r.s + ')');

  // ---- the menu follows the permissions
  const br = await launch();
  const menuOf = async (login, email) => { const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), login, email); const pg = await ctx.newPage(); await pg.goto(`${B}/admin/dashboard`, { waitUntil: 'load' }); await pg.waitForTimeout(1800); const hrefs = await pg.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'))); await ctx.close(); return hrefs; };
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view']);
  let m = await menuOf('/api/auth/login', 'staff@dev.test');
  log(m.includes('/admin/studio') && !m.includes('/admin/game-results') && !m.includes('/admin/arena') && !m.includes('/admin/staff'), 'the menu shows the Studio to staff who have it, and nothing else gated');
  await setAccess('gaming_ops_moderator', []);
  m = await menuOf('/api/auth/login', 'staff@dev.test');
  log(!m.includes('/admin/studio') && m.includes('/admin/game-results'), 'a moderator sees Game results and not the Studio');
  m = await menuOf('/api/auth/training-org-login', 'org@dev.test');
  log(!m.includes('/admin/studio') && !m.includes('/admin/game-results') && !m.includes('/admin/arena'), 'a training organization sees none of them');
  m = await menuOf('/api/auth/login', 'super@dev.test');
  log(m.includes('/admin/studio') && m.includes('/admin/game-results') && m.includes('/admin/arena') && m.includes('/admin/staff'), 'the Super Admin sees all of them');

  // ---- the pages
  await setAccess('custom', ['gaming_studio.access:view', 'gaming_studio.configs:view']);
  let ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'staff@dev.test');
  let pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
  await pg.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await pg.getByTestId('new-game').waitFor();
  log(await pg.getByTestId('new-game').isDisabled(), 'in the Studio, "New game" is switched off without the Create permission');
  await ctx.close();
  await setAccess('custom', []);
  ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'staff@dev.test');
  pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
  for (const path of ['/admin/studio', '/admin/studio/demo', '/admin/game-results']) {
    await pg.goto(`${B}${path}`, { waitUntil: 'load' });
    await pg.getByTestId(path === '/admin/game-results' ? 'results-blocked' : 'access-denied').waitFor();
    log(/don.t have access|Access/i.test(await pg.locator('body').innerText()), path + ': a clear access-denied message with a way back');
  }
  const back = await pg.getByRole('link', { name: /Back to your dashboard/ }).first().getAttribute('href');
  log(back === '/admin/dashboard', 'which leads safely back to their dashboard');
  await ctx.close();
  const orgCtx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const op = await orgCtx.newPage(); op.setDefaultTimeout(20000);
  await op.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await op.getByTestId('access-denied').waitFor();
  log(true, 'a training organization opening the Studio by its address is refused');
  await br.close();

  const denied = Number(psql(`select count(*) from "AuditEvent" where action='ACCESS_DENIED'`));
  log(denied >= 10, 'denied attempts are recorded (' + denied + ')');
  psql(`update "User" set "staffRoleKey"=null, "permissionGrants"='{}', "permissionDenies"='{}', active=true where email='staff@dev.test'`);
  psql(`delete from "Game" where title like 'PERM %'`);
  const failed = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED'); process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
