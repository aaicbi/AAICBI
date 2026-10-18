const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const SHOTS = process.env.SHOTS || '/tmp/dev/arena-shots';
const PAIRS = [['Phishing', 'Fake messages that steal logins'], ['Firewall', 'Blocks unwanted network traffic'], ['Encryption', 'Scrambles data so only keys read it'], ['Backup', 'A spare copy to restore from']];
(async () => {
  clearThrottle();
  const sa = await jar('/api/auth/login', 'super@dev.test');
  const a = await jar('/api/auth/trainee-login', 't0@dev.test'); const b = await jar('/api/auth/trainee-login', 't1@dev.test');
  const ids = { a: psql(`select id from "Trainee" where email='t0@dev.test'`), b: psql(`select id from "Trainee" where email='t1@dev.test'`) };
  const superId = psql(`select id from "User" where email='super@dev.test'`);
  psql(`delete from "Course" where id='arena_mt'`);
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt") values ('arena_mt','Matching Course','x','${superId}',now())`);
  psql(`insert into "Module"(id,"courseId",title,"order") values ('arena_mt_m','arena_mt','Security Words',0)`);
  psql(`insert into "ModuleLearningObjective"(id,"moduleId",text,"order","confirmedById","isCritical") values ('arena_mt_o','arena_mt_m','Know security terms',0,'${superId}',false)`);
  for (let i = 0; i < 5; i++) psql(`insert into "GameItem"(id,"moduleId","objectiveId",format,content,status,source) values ('arena_mt_i${i}','arena_mt_m','arena_mt_o','MATCHING','${JSON.stringify({ prompt: 'Match each term to its meaning', pairs: PAIRS.map(([left, right]) => ({ left, right })) }).replace(/'/g, "''")}','APPROVED','test')`);
  for (const t of [ids.a, ids.b]) psql(`insert into "CourseEnrollment"(id,"traineeId","courseId",source,"unlockedAt") values ('arena_mt_en_${t}','${t}','arena_mt','ADMIN_GRANTED',now()) on conflict do nothing`);
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: true, gameEnabled: true, questionsPerMatch: 4 } });
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE') and "courseId" in ('arena_mt','arena_play')`);
  async function newMatch() {
    psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE') and "courseId" in ('arena_mt','arena_play')`);
    await call(b, 'GET', '/api/arena/courses/arena_mt');
    let r = await call(a, 'POST', '/api/arena/courses/arena_mt/challenge', { opponentId: ids.b });
    const mid = r.j.id;
    await call(b, 'POST', `/api/arena/matches/${mid}/accept`);
    await call(a, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true }); r = await call(b, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
    const picker = r.j.turn === 'me' ? 'b' : 'a';
    const pk = await call(picker === 'a' ? a : b, 'POST', `/api/arena/matches/${mid}/pick`, { number: 2 }); if (pk.s !== 200) console.log('pick failed', pk.s, JSON.stringify(pk.j).slice(0, 200));
    return { mid, picker };
  }

  const br = await launch();
  for (const [name, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 720 } })], ['phone', device('iPhone 13 landscape')], ['portrait', device('iPhone 13')], ['small', device('iPhone 7', { viewport: { width: 375, height: 553 } })]]) {
    clearThrottle(); const { mid, picker } = await newMatch();
    const email = picker === 'a' ? 't0@dev.test' : 't1@dev.test'; const email2 = picker === 'a' ? 't1@dev.test' : 't0@dev.test';
    const cp = await signedIn(br, dev, '/api/auth/trainee-login', email); const co = await signedIn(br, dev, '/api/auth/trainee-login', email2);
    const pp = await cp.newPage(); const po = await co.newPage(); pp.setDefaultTimeout(15000); po.setDefaultTimeout(15000);
    const errs = []; pp.on('pageerror', (e) => errs.push(e.message));
    await pp.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' }); await po.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' });
    await pp.locator('.ar-mt').waitFor();
    const lefts = pp.locator('.ar-mt > div:nth-child(1) button'); const rights = pp.locator('.ar-mt > div:nth-child(2) button');
    log((await lefts.count()) === 4 && (await rights.count()) === 4, name + ': four terms and four meanings');
    log((await lefts.nth(0).getAttribute('aria-pressed')) === 'true', name + ': the first term is already highlighted');
    const rightFor = async (meaning) => rights.filter({ hasText: meaning });
    // match term 1 and check both cards get badge 1
    await (await rightFor(PAIRS[0][1])).click();
    log((await lefts.nth(0).locator('.ar-badge').innerText()) === '1' && (await (await rightFor(PAIRS[0][1])).locator('.ar-badge').innerText()) === '1', name + ': a matched term and meaning both show the number 1');
    log((await lefts.nth(1).getAttribute('aria-pressed')) === 'true', name + ': the next term is picked for you');
    // deliberately mismatch terms 2 and 3 (swap), match 4 right
    await (await rightFor(PAIRS[2][1])).click(); await (await rightFor(PAIRS[1][1])).click(); await (await rightFor(PAIRS[3][1])).click();
    log((await (await rightFor(PAIRS[2][1])).locator('.ar-badge').innerText()) === '2' && (await (await rightFor(PAIRS[1][1])).locator('.ar-badge').innerText()) === '3', name + ': each meaning shows the number of the term it is matched to');
    // undo by tapping a matched card
    await (await rightFor(PAIRS[3][1])).click();
    log((await lefts.nth(3).locator('.ar-badge').count()) === 0, name + ': tapping a matched card undoes it');
    await (await rightFor(PAIRS[3][1])).click();
    await pp.screenshot({ path: `${SHOTS}/${name}-matching.png` });
    const tidy = await pp.evaluate(() => { const lock = [...document.querySelectorAll('.ar-qcard > button')].pop(); const btns = [...document.querySelectorAll('.ar-mt button')]; const top = lock ? lock.getBoundingClientRect().top : Infinity; return innerHeight > innerWidth || (btns.every((b) => b.getBoundingClientRect().bottom <= top + 1) && btns.every((b) => b.scrollHeight <= b.clientHeight + 2)); });
    log(tidy, name + ': every matching card sits above the Lock in button and its text fits');
    await pp.getByRole('button', { name: 'Lock in' }).click();
    await pp.getByText('Answer locked in').waitFor();
    log(true, name + ': the answer is locked in (wrong on purpose)');
    // the other player gets the bonus chance and matches everything correctly
    const olefts = po.locator('.ar-mt > div:nth-child(1) button'); const orights = po.locator('.ar-mt > div:nth-child(2) button');
    await olefts.first().waitFor({ timeout: 10000 });
    for (const [, meaning] of PAIRS) await orights.filter({ hasText: meaning }).click();
    await po.getByRole('button', { name: 'Lock in' }).click();
    await po.locator('.ar-rv').waitFor({ timeout: 10000 }); await pp.locator('.ar-rv').waitFor({ timeout: 10000 });
    // at the reveal the right pairs are numbered the same way
    const rr = pp.locator('.ar-mt > div:nth-child(2) button');
    let ok = true;
    for (let i = 0; i < PAIRS.length; i++) ok = ok && (await rr.filter({ hasText: PAIRS[i][1] }).locator('.ar-badge').innerText()) === String(i + 1);
    log(ok, name + ': the reveal numbers every meaning with its right term');
    log((await pp.locator('.ar-mt > div:nth-child(1) .ar-badge').count()) === 4, name + ': and every term shows its number');
    await pp.screenshot({ path: `${SHOTS}/${name}-matching-reveal.png` });
    const fits = await pp.evaluate(() => { const c = document.querySelector('.ar-qcard'); return !!c && (innerHeight > innerWidth || c.scrollHeight <= c.clientHeight + 2); });
    log(fits, name + ': the matching card fits without scrolling');
    log(errs.length === 0, name + ': no console errors ' + errs.slice(0, 2).join(' | '));
    await cp.close(); await co.close();
    psql(`update "ArenaMatch" set status='CANCELLED' where id='${mid}'`);
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
