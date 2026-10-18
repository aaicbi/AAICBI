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
  const sizes = [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 720 } })], ['phone', device('iPhone 13 landscape')], ['portrait', device('iPhone 13')]];
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
      const o = await p.evaluate(() => ({ sx: document.documentElement.scrollWidth > innerWidth + 1, sy: document.documentElement.scrollHeight > innerHeight + 1, bodyOverflow: getComputedStyle(document.body).overflow, cut: [...document.querySelectorAll(innerHeight > innerWidth ? '.ar-main,.ar-stage' : '.ar-qcard,.ar-main,.ar-stage')].some((e) => e.scrollHeight > e.clientHeight + 2) }));
      log(!o.sx && !o.sy && !o.cut, name + ': the stage fits the screen with no scrolling ' + JSON.stringify(o));
    }
    // answer correctly: the reveal shows the right answer clearly and the points
    const qtext = (await picker.locator('.ar-q').innerText()).trim();
    const right = psql(`select o.text from "Option" o join "Question" q on q.id=o."questionId" where q.text='${qtext.replace(/'/g, "''")}' and o."isCorrect"`);
    await picker.locator('.ar-opt', { hasText: right }).first().click();
    await picker.locator('.ar-rva').waitFor({ timeout: 8000 });
    await other.locator('.ar-rva').waitFor({ timeout: 8000 });
    log((await other.locator('.ar-rva').innerText()).includes(right), name + ': both players see the correct answer in words');
    log((await picker.locator('.ar-opt.ar-ok').count()) === 1, name + ': exactly the right option is marked');
    await picker.screenshot({ path: `${SHOTS}/${name}-reveal.png` });
    const fits = await picker.evaluate(() => { const c = document.querySelector('.ar-qcard'); return !!c && (innerHeight > innerWidth || c.scrollHeight <= c.clientHeight + 2); });
    log(fits, name + ': the reveal fits the card without scrolling');
    // finish the match and check the result screen and play again
    psql(`update "ArenaMatch" set status='COMPLETED', phase=null, "phaseEndsAt"=null, "winnerId"="turnId", "endedAt"=now() where "courseId"='arena_play' and status='ACTIVE'`);
    await pa.reload(); await pb.reload();
    await pa.getByRole('button', { name: /Play again/ }).waitFor({ timeout: 10000 });
    log(await pa.locator('.ar-stars').isVisible() && (await pa.locator('.ar-recap').count()) === 1, name + ': the result shows stars and a review of the answers');
    await pa.screenshot({ path: `${SHOTS}/${name}-result.png` });
    await pa.getByRole('button', { name: /Play again/ }).click();
    await pb.getByText(/wants a rematch/).waitFor({ timeout: 10000 });
    await pb.getByRole('button', { name: 'Accept rematch' }).click();
    await Promise.all([pa.waitForURL(/arena\/match\//, { timeout: 15000 }), pb.waitForURL(/arena\/match\//, { timeout: 15000 })]);
    await pa.getByRole('button', { name: "I'm ready" }).waitFor({ timeout: 10000 });
    log(true, name + ': accepting the rematch puts both players in a new lobby');
    log(errs.length === 0, name + ': no console errors ' + errs.slice(0, 2).join(' | '));
    await ca.close(); await cb.close();
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
