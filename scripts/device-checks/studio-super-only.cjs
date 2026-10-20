// The Game Studio (its pages, its data, Loop inside it and the game results) belongs to the Super Admin alone.
// Training organizations, admins and instructors get no menu entry, no page and no data.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
const denied = (s) => [401, 403].includes(s);
(async () => {
  clearThrottle();
  const S = await jar('super@dev.test'), ST = await jar('staff@dev.test'), ORG = await jar('org@dev.test', '/api/auth/training-org-login');
  const paths = [['GET', '/api/admin/studio'], ['POST', '/api/admin/studio/games', { title: 'X', format: 'QUIZ' }], ['GET', '/api/admin/game-results'], ['POST', '/api/admin/loop/chat', { message: 'hi' }], ['GET', '/api/admin/loop/conversations']];
  for (const [who, c] of [['an admin', ST], ['a training organization', ORG], ['a visitor', null]]) {
    const bad = [];
    for (const [m, p, b] of paths) { const r = await call(c, m, p, b); if (!denied(r.s)) bad.push(`${m} ${p} -> ${r.s}`); }
    log(bad.length === 0, who + ' is refused by every studio, results and studio-Loop endpoint' + (bad.length ? ': ' + bad.join('; ') : ''));
  }
  const q = await call(ORG, 'GET', '/api/modules/any/quest');
  log(denied(q.s), 'an organization cannot read a module\'s game question pools (' + q.s + ')');
  const r = await call(S, 'GET', '/api/admin/studio');
  log(r.s === 200 && Array.isArray(r.j.courses), 'the Super Admin still has the studio');

  const br = await launch();
  const mk = async (login, email) => signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), login, email);
  for (const [who, login, email] of [['an organization', '/api/auth/training-org-login', 'org@dev.test'], ['an admin', '/api/auth/login', 'staff@dev.test']]) {
    const ctx = await mk(login, email); const pg = await ctx.newPage(); pg.setDefaultTimeout(20000);
    await pg.goto(`${B}/admin/studio`, { waitUntil: 'load' });
    await pg.getByText('only for the Super Admin').waitFor();
    log(true, who + ' opening the studio page is told it is only for the Super Admin');
    await pg.goto(`${B}/admin/dashboard`, { waitUntil: 'load' });
    await pg.waitForTimeout(1500);
    const menu = await pg.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
    log(!menu.includes('/admin/studio') && !menu.includes('/admin/game-results'), who + ' has no Game Studio or Game results link in the menu');
    await ctx.close();
  }
  const sctx = await mk('/api/auth/login', 'super@dev.test'); const sp = await sctx.newPage(); sp.setDefaultTimeout(20000);
  await sp.goto(`${B}/admin/dashboard`, { waitUntil: 'load' }); await sp.waitForTimeout(1500);
  const links = await sp.evaluate(() => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')));
  log(links.includes('/admin/studio'), 'the Super Admin has the Game Studio in the menu');
  await sp.goto(`${B}/admin/studio`, { waitUntil: 'load' });
  await sp.getByText(/Game Studio/i).first().waitFor();
  log(!(await sp.getByText('only for the Super Admin').count()), 'and can open it');
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
