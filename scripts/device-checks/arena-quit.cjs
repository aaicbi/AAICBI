const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const a = await jar('/api/auth/trainee-login', 't0@dev.test'); const b = await jar('/api/auth/trainee-login', 't1@dev.test');
  const ids = { b: psql(`select id from "Trainee" where email='t1@dev.test'`) };
  async function newMatch() {
    psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE') and "courseId" in ('arena_or','arena_mt','arena_play')`);
    await call(b, 'GET', '/api/arena/courses/arena_play');
    let r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b });
    const mid = r.j.id;
    await call(b, 'POST', `/api/arena/matches/${mid}/accept`);
    await call(a, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true }); r = await call(b, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
    const picker = r.j.turn === 'me' ? 'b' : 'a';
    await call(picker === 'a' ? a : b, 'POST', `/api/arena/matches/${mid}/pick`, { number: 2 });
    return { mid, picker };
  }
  const br = await launch();
  for (const [name, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 720 } })], ['small', device('iPhone 7', { viewport: { width: 375, height: 553 } })]]) {
    clearThrottle(); const { mid, picker } = await newMatch();
    const e1 = picker === 'a' ? 't0@dev.test' : 't1@dev.test'; const e2 = picker === 'a' ? 't1@dev.test' : 't0@dev.test';
    const c1 = await signedIn(br, dev, '/api/auth/trainee-login', e1); const c2 = await signedIn(br, dev, '/api/auth/trainee-login', e2);
    const p1 = await c1.newPage(); const p2 = await c2.newPage(); p1.setDefaultTimeout(15000); p2.setDefaultTimeout(15000);
    await p1.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' }); await p2.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' });
    await p1.locator('.ar-qcard').waitFor();

    // 1. leave for the app: the game pauses itself and the player can come back to it
    await p1.getByRole('link', { name: /Leave the game screen/ }).click();
    await p1.waitForURL(/\/feed/, { timeout: 15000 });
    log(true, name + ': the player can leave the game for the normal app feed');
    const st = psql(`select "pausedById" is not null from "ArenaMatch" where id='${mid}'`);
    log(st === 't', name + ': leaving paused the game');
    await p1.waitForSelector('a:has-text("Your game with")', { timeout: 20000 });
    log(true, name + ': another page shows a way back to the game');
    await p1.locator('a:has-text("Your game with")').first().click();
    await p1.waitForURL(/arena\/match\//);
    await p1.getByRole('button', { name: 'Resume game' }).waitFor();
    log(true, name + ': coming back shows the paused game with a Resume button');
    await p1.getByRole('button', { name: 'Resume game' }).click();
    await p1.locator('.ar-qcard').waitFor();
    log((await p1.locator('.ar-dock').count()) >= 1, name + ': resuming carries on with the same question');

    // 2. quit from the pause screen: the other player wins at once
    await p1.getByRole('button', { name: /Pause/ }).first().click();
    await p1.getByRole('button', { name: 'Quit game' }).click();
    await p1.getByText('is told you left and wins automatically').waitFor();
    log(true, name + ': quitting asks first and says the other player wins');
    await p1.getByRole('button', { name: 'Keep playing' }).click();
    await p1.getByRole('button', { name: 'Quit game' }).click();
    await p1.getByRole('button', { name: 'Yes, quit' }).click();
    await p1.getByText('You quit the game').waitFor();
    await p2.getByText('quit the game, so you win automatically').waitFor({ timeout: 15000 });
    log(true, name + ': the quitter sees "You quit" and the opponent sees they win automatically');
    await p2.screenshot({ path: `/tmp/dev/arena-shots/${name}-quit-win.png` });
    await c1.close(); await c2.close();
    psql(`update "ArenaMatch" set status='CANCELLED' where id='${mid}' and status in ('PENDING','LOBBY','ACTIVE')`);
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
