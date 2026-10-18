const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const SHOTS = process.env.SHOTS || '/tmp/dev/arena-shots';
const STEPS = ['Open WhatsApp', 'Read the message', 'Copy the details', 'Write them in the notebook', 'Reply to the customer'];
const PAIRS_UNUSED = [['Phishing', 'Fake messages that steal logins'], ['Firewall', 'Blocks unwanted network traffic'], ['Encryption', 'Scrambles data so only keys read it'], ['Backup', 'A spare copy to restore from']];
(async () => {
  clearThrottle();
  const sa = await jar('/api/auth/login', 'super@dev.test');
  const a = await jar('/api/auth/trainee-login', 't0@dev.test'); const b = await jar('/api/auth/trainee-login', 't1@dev.test');
  const ids = { a: psql(`select id from "Trainee" where email='t0@dev.test'`), b: psql(`select id from "Trainee" where email='t1@dev.test'`) };
  const superId = psql(`select id from "User" where email='super@dev.test'`);
  psql(`delete from "Course" where id='arena_or'`);
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt") values ('arena_or','Ordering Course','x','${superId}',now())`);
  psql(`insert into "Module"(id,"courseId",title,"order") values ('arena_or_m','arena_or','Steps',0)`);
  psql(`insert into "ModuleLearningObjective"(id,"moduleId",text,"order","confirmedById","isCritical") values ('arena_or_o','arena_or_m','Know security terms',0,'${superId}',false)`);
  for (let i = 0; i < 5; i++) psql(`insert into "GameItem"(id,"moduleId","objectiveId",format,content,status,source) values ('arena_or_i${i}','arena_or_m','arena_or_o','ORDERING','${JSON.stringify({ prompt: 'Put the steps in order', steps: STEPS }).replace(/'/g, "''")}','APPROVED','test')`);
  for (const t of [ids.a, ids.b]) psql(`insert into "CourseEnrollment"(id,"traineeId","courseId",source,"unlockedAt") values ('arena_or_en_${t}','${t}','arena_or','ADMIN_GRANTED',now()) on conflict do nothing`);
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: true, gameEnabled: true, questionsPerMatch: 4 } });
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE') and "courseId" in ('arena_or','arena_play')`);
  async function newMatch() {
    psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE') and "courseId" in ('arena_or','arena_mt','arena_play')`);
    await call(b, 'GET', '/api/arena/courses/arena_or');
    let r = await call(a, 'POST', '/api/arena/courses/arena_or/challenge', { opponentId: ids.b });
    const mid = r.j.id;
    await call(b, 'POST', `/api/arena/matches/${mid}/accept`);
    await call(a, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true }); r = await call(b, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
    const picker = r.j.turn === 'me' ? 'b' : 'a';
    await call(picker === 'a' ? a : b, 'POST', `/api/arena/matches/${mid}/pick`, { number: 2 });
    return { mid, picker };
  }
  const br = await launch();
  for (const [name, dev] of [['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 720 } })], ['phone', device('iPhone 13 landscape')], ['portrait', device('iPhone 13')], ['small', device('iPhone 7', { viewport: { width: 375, height: 553 } })]]) {
    clearThrottle(); const { mid, picker } = await newMatch();
    const e1 = picker === 'a' ? 't0@dev.test' : 't1@dev.test'; const e2 = picker === 'a' ? 't1@dev.test' : 't0@dev.test';
    const cp = await signedIn(br, dev, '/api/auth/trainee-login', e1); const co = await signedIn(br, dev, '/api/auth/trainee-login', e2);
    const pp = await cp.newPage(); const po = await co.newPage(); pp.setDefaultTimeout(15000); po.setDefaultTimeout(15000);
    await pp.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' }); await po.goto(`${B}/trainee/arena/match/${mid}`, { waitUntil: 'load' });
    await pp.locator('.ar-ord').waitFor();
    // drag and drop: pick up the last step by its handle and drop it one place higher
    const before = await pp.locator('.ar-ord li .ar-t').allInnerTexts();
    const grips = pp.locator('.ar-grip'); await pp.locator('.ar-qcard').evaluate((e) => e.scrollTo(0, e.scrollHeight)); await pp.waitForTimeout(150);
    const gb = await grips.nth(4).boundingBox(); const tb = await grips.nth(3).boundingBox();
    await pp.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await pp.mouse.down();
    await pp.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 - 6, { steps: 12 }); await pp.mouse.up();
    const moved = await pp.locator('.ar-ord li .ar-t').allInnerTexts();
    log(moved[3] === before[4] && moved[4] === before[3] && moved.length === 5, name + ': dragging a step by its handle moves it up one place');
    log((await pp.locator('.ar-ord li .ar-n').allInnerTexts()).join('') === '12345', name + ': the numbers stay 1 to 5 after a move');
    // keyboard: arrow down on the first handle swaps the first two
    await grips.nth(0).focus(); await pp.keyboard.press('ArrowDown');
    const keyed = await pp.locator('.ar-ord li .ar-t').allInnerTexts();
    log(keyed[0] === moved[1] && keyed[1] === moved[0], name + ': arrow keys also move a step');
    await pp.getByRole('button', { name: 'Lock in' }).click();
    await po.getByRole('button', { name: 'Lock in' }).waitFor({ timeout: 10000 });
    await po.getByRole('button', { name: 'Lock in' }).click();
    await pp.locator('.ar-rv').waitFor({ timeout: 10000 }); await po.locator('.ar-rv').waitFor({ timeout: 10000 });
    for (const [who, pg] of [['picker', pp], ['other player', po]]) {
      log((await pg.locator('.ar-ord li.ar-ok').count()) === 5, name + ': ' + who + ' sees all five steps highlighted in the correct order');
      const texts = await pg.locator('.ar-ord li .ar-t').allInnerTexts();
      log(JSON.stringify(texts) === JSON.stringify(STEPS), name + ': ' + who + ' sees the steps in the right order');
      log(await pg.locator('.ar-hintok').isVisible(), name + ': ' + who + ' sees the "correct order" label');
      log((await pg.locator('.ar-ord li .ar-chip-no').count()) >= 1, name + ': ' + who + ' sees where their own steps were wrong');
    }
    await pp.screenshot({ path: `${SHOTS}/${name}-ordering-reveal.png` });
    const fits = await pp.evaluate(() => { const c = document.querySelector('.ar-qcard'); return !!c && (innerHeight > innerWidth || c.scrollHeight <= c.clientHeight + 2); });
    log(fits, name + ': the ordering reveal fits the card');
    await cp.close(); await co.close();
    psql(`update "ArenaMatch" set status='CANCELLED' where id='${mid}'`);
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
