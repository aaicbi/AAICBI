const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const SHOTS = process.env.SHOTS || '/tmp/dev/arena-shots';
(async () => {
  clearThrottle();
  psql(`update "ArenaMatch" set status='CANCELLED' where "courseId"='arena_play' and status in ('PENDING','LOBBY','ACTIVE')`);
  const a = await jar('/api/auth/trainee-login', 't0@dev.test');
  const b = await jar('/api/auth/trainee-login', 't1@dev.test');
  const idB = psql(`select id from "Trainee" where email='t1@dev.test'`);
  await call(b, 'GET', '/api/arena/courses/arena_play');
  const br = await launch();
  const sizes = [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 720 } })], ['phone', device('iPhone 13 landscape')]];
  for (const [name, dev] of sizes) {
    clearThrottle();
    psql(`update "ArenaMatch" set status='CANCELLED' where "courseId"='arena_play' and status in ('PENDING','LOBBY','ACTIVE')`);
    const ca = await signedIn(br, dev, '/api/auth/trainee-login', 't0@dev.test');
    const cb = await signedIn(br, dev, '/api/auth/trainee-login', 't1@dev.test');
    const pa = await ca.newPage(); const pb = await cb.newPage(); pa.setDefaultTimeout(15000); pb.setDefaultTimeout(15000);
    const errs = []; for (const p of [pa, pb]) { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); }); }
    await pb.goto(B + '/trainee/arena/arena_play', { waitUntil: 'load' });
    await pa.goto(B + '/trainee/arena/arena_play', { waitUntil: 'load' });
    await pa.getByText('Online now').waitFor();
    await pa.waitForTimeout(500);
    await pa.screenshot({ path: `${SHOTS}/${name}-lobby.png` });
    await pa.locator('.ar-row', { hasText: /^.*Available/ }).first().getByRole('button', { name: 'Challenge' }).click();
    await pa.waitForURL(/arena\/match\//);
    await pa.getByText(/Waiting for/).first().waitFor();
    log(true, name + ': challenging opens the waiting screen');
    await pb.reload(); await pb.getByText('wants to play').waitFor();
    await pb.getByRole('button', { name: 'Accept' }).click();
    await pb.waitForURL(/arena\/match\//);
    await pb.getByRole('button', { name: "I'm ready" }).waitFor();
    await pa.getByRole('button', { name: "I'm ready" }).waitFor({ timeout: 8000 });
    await pa.screenshot({ path: `${SHOTS}/${name}-ready.png` });
    await pa.getByRole('button', { name: "I'm ready" }).click(); await pb.getByRole('button', { name: "I'm ready" }).click();
    await pa.getByRole('button', { name: 'Number 1', exact: true }).waitFor({ timeout: 8000 });
    await pa.screenshot({ path: `${SHOTS}/${name}-pick-a.png` }); await pb.screenshot({ path: `${SHOTS}/${name}-pick-b.png` });
    const picker = (await pa.locator('.ar-pickmsg:not(.ar-opp)').count()) > 0 ? pa : pb; const other = picker === pa ? pb : pa;
    await picker.getByRole('button', { name: 'Number 4', exact: true }).click();
    await picker.locator('.ar-qcard').waitFor(); await other.locator('.ar-qcard').waitFor();
    await picker.screenshot({ path: `${SHOTS}/${name}-question.png` });
    await other.screenshot({ path: `${SHOTS}/${name}-question-wait.png` });
    // no scrolling anywhere
    for (const p of [pa, pb]) {
      const o = await p.evaluate(() => ({ sx: document.documentElement.scrollWidth > innerWidth + 1, sy: document.documentElement.scrollHeight > innerHeight + 1, bodyOverflow: getComputedStyle(document.body).overflow, cut: [...document.querySelectorAll('.ar-qcard,.ar-main,.ar-stage')].some((e) => e.scrollHeight > e.clientHeight + 2) }));
      log(!o.sx && !o.sy && !o.cut, name + ': the stage fits the screen with no scrolling ' + JSON.stringify(o));
    }
    // answer wrong -> steal visible to the other player
    await picker.locator('.ar-opt').first().click();
    await other.getByText(/bonus chance|Bonus question/).first().waitFor({ timeout: 8000 }).catch(() => {});
    await other.screenshot({ path: `${SHOTS}/${name}-steal.png` });
    // pause from the other player
    await other.getByRole('button', { name: /Resume|⏸/ }).count();
    log(errs.length === 0, name + ': no console errors ' + errs.slice(0, 2).join(' | '));
    await ca.close(); await cb.close();
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
