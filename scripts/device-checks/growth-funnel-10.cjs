// Growth funnel: the taster in the Ayakbi Arena look, with a clock and a tick-tock. Checks that running out of time is a miss that shows the answer,
// that the server still refuses a bare request, the ring timer counting down, the alternating tick and tock (a fake audio engine records the notes),
// the sound switch (off stops it, and is remembered), the clock pausing while the tab is hidden, a real timeout on screen, the arena colours, the
// results in light and dark themes, and no sideways scroll on a phone.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A stand-in for the browser's audio: records every note's pitch and how many were started.
const FAKE_AUDIO = `(() => {
  window.__notes = [];
  const param = (rec) => ({ value: 0, setValueAtTime: (v) => rec && window.__notes.push(Math.round(v)), exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: param(false), gain: param(false), Q: { value: 0 }, type: '', buffer: null });
  class FakeCtx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return node(); }
    createDynamicsCompressor() { return node(); }
    createOscillator() { const n = node(); n.frequency = param(true); return n; }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  window.AudioContext = FakeCtx; window.webkitAudioContext = FakeCtx;
})();`;

(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthScholarship', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);

  // ---- the server: running out of time is a miss
  const start = async () => (await call(null, 'POST', `/api/public/growth/${slug}/play`, {})).j;
  const ans = (token, body) => call(null, 'POST', `/api/public/growth/${slug}/answer`, { token, ...body });
  let a = await start();
  log((await ans(a.token, {})).s === 400, 'an answer with neither a choice nor "timed out" is refused');
  log((await ans(a.token, { timedOut: false })).s === 400, 'and so is "not timed out" with no choice');
  let r = await ans(a.token, { timedOut: true });
  log(r.s === 200 && r.j.correct === false && typeof r.j.correctKey === 'string' && r.j.state.status === 'question' && r.j.state.index === 1, 'timing out marks the question missed, shows the right answer, and moves on');
  log(psql(`select (answers->0->>'correct') || '|' || coalesce(answers->0->>'choice','null') from "GrowthGuestPlay" where token='${a.token}'`) === 'false|', 'it is stored as a wrong answer with no choice');
  for (let i = 0; i < 4; i++) r = await ans(a.token, { timedOut: true });
  log(r.j.state.status === 'done' && r.j.state.score === 0 && r.j.state.grid.every((g) => g === false), 'five timeouts finish the run with 0/5');
  log((await ans(a.token, { timedOut: true })).s === 409, 'nothing more can be answered after the end');
  const mixed = await start();
  const first = mixed.state.question; const resC = await ans(mixed.token, { choice: first.options[0].key });
  const resT = await ans(mixed.token, { timedOut: true });
  log(resC.s === 200 && resT.j.state.index === 2 && psql(`select score from "GrowthGuestPlay" where token='${mixed.token}'`) === (resC.j.correct ? '1' : '0'), 'a real answer then a timeout scores only the real one');
  log((await ans(mixed.token, { choice: 'nonsense-key' })).s === 400, 'a made-up choice is still refused');

  // ---- the screen
  const br = await launch();
  const ctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block', colorScheme: 'dark' });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  await ctx.addInitScript(FAKE_AUDIO);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/play/${slug}`);
  await pg.getByTestId('growth-arena').waitFor();
  log(/Ayakbi Arena/i.test(await pg.getByTestId('growth-arena').innerText()), 'the page wears the Ayakbi Arena name');
  const bg = await pg.getByTestId('growth-arena').evaluate((el) => getComputedStyle(el).backgroundImage + '|' + getComputedStyle(el).position);
  log(/gradient/.test(bg) && /fixed/.test(bg), 'on the arena\'s green stage, filling the screen');
  const startBg = await pg.getByTestId('growth-start').evaluate((el) => getComputedStyle(el).backgroundColor);
  log(startBg === 'rgb(242, 184, 75)', 'with the arena\'s gold button (' + startBg + ')');
  log(/18 seconds a question/.test(await pg.getByTestId('growth-arena').innerText()) && /Tick-tock sound on/.test(await pg.getByTestId('growth-arena').innerText()), 'the start screen tells them about the clock and the sound');
  await pg.screenshot({ path: '/tmp/dev/growth10-intro-phone.png' });
  await pg.getByTestId('growth-start').click();
  await pg.getByTestId('growth-timer').waitFor();
  const t0 = Number(await pg.getByTestId('growth-timer').innerText());
  log(t0 >= 17 && t0 <= 18, 'a ring timer starts at about 18 (' + t0 + ')');
  await sleep(2600);
  const t1 = Number(await pg.getByTestId('growth-timer').innerText());
  log(t1 <= t0 - 2 && t1 >= t0 - 4, 'and counts down in real time (' + t0 + ' to ' + t1 + ')');
  const ringT = await pg.getByTestId('growth-timer').evaluate((el) => el.style.getPropertyValue('--t'));
  log(parseFloat(ringT) < 100 && parseFloat(ringT) > 50, 'the ring drains with it (' + ringT + ')');
  await pg.screenshot({ path: '/tmp/dev/growth10-question-phone.png' });

  // tick and tock alternate
  const notes = await pg.evaluate(() => window.__notes.slice());
  const ticks = notes.filter((n) => n === 980 || n === 700);
  log(ticks.length >= 2 && ticks.includes(980) && ticks.includes(700), 'the clock ticks and tocks, two different pitches (' + ticks.join(',') + ')');
  const seq = ticks.slice(-4);
  log(seq.every((n, i) => i === 0 || n !== seq[i - 1]), 'and they alternate');

  // sound off stops it, and is remembered
  await pg.getByTestId('growth-sound').click();
  const before = await pg.evaluate(() => window.__notes.length);
  await sleep(2300);
  const after = await pg.evaluate(() => window.__notes.length);
  log(after === before && (await pg.getByTestId('growth-sound').getAttribute('aria-pressed')) === 'false', 'sound off: no more notes, and the button says so');
  await pg.reload();
  await pg.getByTestId('growth-timer').waitFor();
  log((await pg.getByTestId('growth-sound').getAttribute('aria-pressed')) === 'false', 'the choice is remembered after a reload');
  await pg.getByTestId('growth-sound').click();
  log((await pg.getByTestId('growth-sound').getAttribute('aria-pressed')) === 'true', 'and can be turned back on');

  // the clock does not run while the tab is hidden
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); });
  const h0 = Number(await pg.getByTestId('growth-timer').innerText());
  await sleep(2500);
  const h1 = Number(await pg.getByTestId('growth-timer').innerText());
  await pg.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  log(h1 === h0, 'with the tab hidden the clock holds still (' + h0 + ' and ' + h1 + ')');
  await sleep(1300);
  log(Number(await pg.getByTestId('growth-timer').innerText()) < h0, 'and runs again when they come back');

  // answering stops the clock and shows the result
  await pg.getByTestId('growth-option').first().click();
  await pg.getByTestId('growth-next').waitFor();
  const frozen = await pg.getByTestId('growth-timer').innerText();
  log(frozen === '✓', 'answering stops the clock (shows a tick)');
  const optClass = await pg.getByTestId('growth-option').evaluateAll((els) => els.map((e) => e.className));
  log(optClass.some((c) => /\bok\b/.test(c)), 'the right answer is highlighted');
  await pg.screenshot({ path: '/tmp/dev/growth10-feedback-phone.png' });
  await pg.getByTestId('growth-next').click();
  await pg.getByTestId('growth-question').waitFor();
  const t2 = Number(await pg.getByTestId('growth-timer').innerText());
  log(t2 >= 17, 'the next question starts a fresh clock (' + t2 + ')');

  // a real timeout on screen
  const tOut0 = Date.now();
  await pg.getByTestId('growth-next').waitFor({ timeout: 25000 });
  const waited = Date.now() - tOut0;
  log(waited > 14000 && waited < 21000, 'doing nothing runs the clock out in about 18 seconds (' + Math.round(waited / 1000) + 's)');
  const fbText = await pg.locator('.ga-fb').innerText();
  log(/Time's up/.test(fbText) && (await pg.getByTestId('growth-timer').innerText()) === '✓', 'and says "Time\'s up", with the answer shown');
  log((await pg.getByTestId('growth-option').evaluateAll((els) => els.every((e) => e.disabled))), 'answers are locked after the time is up');
  // finish the rest by tapping
  for (let i = 0; i < 3; i++) { await pg.getByTestId('growth-next').click(); await pg.getByTestId('growth-question').waitFor(); await pg.getByTestId('growth-option').first().click(); await pg.getByTestId('growth-next').waitFor(); }
  await pg.getByTestId('growth-next').click();
  await pg.getByTestId('growth-score').waitFor();
  const score = await pg.getByTestId('growth-score').innerText();
  log(/^\d\/5$/.test(score), 'the result shows (' + score + ')');
  // the call to join, instead of the missed-question box
  const arena = await pg.getByTestId('growth-arena').innerText();
  log(!/You missed a question/i.test(arena) && !/That is part of Module 1/i.test(arena), 'the result no longer shows which question was missed');
  const cta = pg.getByTestId('growth-cta');
  const ctaText = await cta.innerText();
  log(/Africa.s AI Capacity Building Initiative/i.test(ctaText) && /Learn it\./.test(ctaText) && /Build it\./.test(ctaText) && /Prove it\./.test(ctaText), 'it calls them to join Africa\'s AI Capacity Building Initiative: learn it, build it, prove it');
  log((await cta.locator('svg[aria-label="AAICBI"]').count()) === 1, 'with the AAICBI logo in the message');
  const logoFills = await cta.locator('svg[aria-label="AAICBI"] polygon, svg[aria-label="AAICBI"] path').evaluateAll((els) => els.map((e) => e.getAttribute('fill')));
  log(logoFills.every((f) => f && f !== 'none' && !/^#0/.test(f)), 'in light colours, so it shows on the green stage (' + [...new Set(logoFills)].join(' ') + ')');
  log((await pg.getByTestId('growth-about').getAttribute('href')) === '/about', 'and a link to the About page');
  const vivid = await cta.evaluate((el) => {
    const q = (sel) => el.querySelector(sel);
    const cs = (n) => getComputedStyle(n);
    let op = 1; for (let e = el; e; e = e.parentElement) op *= Number(cs(e).opacity);
    return { op, head: cs(q('h2')).color, headW: cs(q('h2')).fontWeight, body: cs(q('.ga-cta-body')).color, bodyW: cs(q('.ga-cta-body')).fontWeight, kick: cs(q('.ga-cta-kicker')).color, chipW: cs(q('.ga-cta-beat span')).fontWeight, logo: q('svg polygon').getAttribute('fill') };
  });
  log(vivid.op === 1 && vivid.head === 'rgb(255, 255, 255)' && vivid.body === 'rgb(255, 255, 255)' && Number(vivid.headW) >= 800 && Number(vivid.bodyW) >= 600 && Number(vivid.chipW) >= 800, 'the message is fully opaque, pure white and bold, from the first moment (' + JSON.stringify(vivid) + ')');
  log((await pg.getByTestId('growth-continue').count()) === 1, 'Start Module 1, free sits in the same message (once)');
  log(!(await pg.getByTestId('growth-arena').innerText()).includes('See Quest check'), 'the "See <course name>" button is gone from the result');
  const cardBg = await pg.getByTestId('growth-challenge-name').evaluate((el) => { for (let e = el.parentElement; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; const m = b.match(/[\d.]+/g); if (m && !(m.length === 4 && Number(m[3]) < 0.5)) return b; } return ''; });
  const dm = cardBg.match(/\d+/g).map(Number);
  log(dm[0] < 60 && dm[1] < 120, 'the cards below are in the games\' green, not white (' + cardBg + ')');
  const inputColor = await pg.getByTestId('growth-challenge-name').evaluate((el) => getComputedStyle(el).color);
  log(/rgb\(24\d, 25\d, 24\d\)/.test(inputColor), 'with light text (' + inputColor + ')');
  log(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  await pg.screenshot({ path: '/tmp/dev/growth10-result-dark.png', fullPage: false });
  await pg.evaluate(() => document.querySelector('[data-testid="growth-arena"]').scrollTo(0, 99999));
  await pg.screenshot({ path: '/tmp/dev/growth10-result-dark-bottom.png' });

  const aboutHref = await pg.getByTestId('growth-about').getAttribute('href');
  log((await fetch(B + aboutHref)).status === 200, 'the About page it links to opens');
  // text in the light cards stays readable in both themes
  const contrast = async (page) => page.evaluate(() => {
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { if (e.getAttribute('data-testid') === 'growth-arena') return 'rgb(10, 74, 65)'; const b = getComputedStyle(e).backgroundColor; const m = b.match(/[\d.]+/g); if (m && !(m.length === 4 && Number(m[3]) < 0.5)) return b; } return 'rgb(255,255,255)'; };
    let worst = 21; let where = '';
    const els = [...document.querySelectorAll('[data-testid="growth-arena"] p, [data-testid="growth-arena"] h1, [data-testid="growth-arena"] label, [data-testid="growth-arena"] button, [data-testid="growth-arena"] a, [data-testid="growth-arena"] li, [data-testid="growth-arena"] span')];
    for (const el of els) {
      if (!el.textContent.trim() || el.children.length > 2) continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      const fg = getComputedStyle(el).color; const bg = bgOf(el);
      const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (ratio < worst) { worst = ratio; where = el.textContent.trim().slice(0, 30) + ' ' + fg + ' on ' + bg; }
    }
    return { worst: Math.round(worst * 100) / 100, where };
  });
  const cDark = await contrast(pg);
  log(cDark.worst >= 4.5, 'results, dark theme (games colours): lowest text contrast ' + cDark.worst + ' (' + cDark.where + ')');
  const lctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block', colorScheme: 'light' });
  await lctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  await lctx.addInitScript(FAKE_AUDIO);
  const lp = await lctx.newPage();
  await lp.goto(`${B}/play/${slug}`);
  await lp.getByTestId('growth-start').click();
  for (let i = 0; i < 5; i++) { await lp.getByTestId('growth-question').waitFor(); if (i === 0) { await lp.screenshot({ path: '/tmp/dev/growth10-question-light.png' }); } await lp.getByTestId('growth-option').first().click(); await lp.getByTestId('growth-next').click(); }
  await lp.getByTestId('growth-score').waitFor();
  const cLight = await contrast(lp);
  log(cLight.worst >= 4.5, 'results, light theme: lowest text contrast ' + cLight.worst + ' (' + cLight.where + ')');
  await lp.screenshot({ path: '/tmp/dev/growth10-result-light.png' });
  // the course chat card on the course page takes the games' colours too
  const T5 = await jar('/api/auth/trainee-login', 't5@dev.test');
  const t5id = psql(`select id from "Trainee" where email='t5@dev.test'`);
  psql(`insert into "CourseEnrollment"(id,"traineeId","courseId",source,"unlockedAt","enrolledAt") values ('gfchat1','${t5id}','${own}','ADMIN_GRANTED',now(),now()) on conflict do nothing`);
  const chatState = await call(T5, 'GET', `/api/arena/courses/${own}/chat`);
  if (chatState.s === 200 && chatState.j.open) {
    const cctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block', colorScheme: 'dark' });
    await cctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/trainee-login', 't5@dev.test'))]);
    const cp = await cctx.newPage();
    await cp.goto(`${B}/trainee/courses/${own}`);
    await cp.getByTestId('course-chat-link').waitFor();
    const cc = await cp.getByTestId('course-chat-link').evaluate((el) => { const cs = getComputedStyle(el); return cs.backgroundImage + ' | ' + getComputedStyle(el.querySelector('span:nth-of-type(2) span')).color; });
    log(/rgb\(6, 50, 45\)/.test(cc) && /rgb\(14, 95, 83\)/.test(cc) && !/rgb\(255, 255, 255\)/.test(cc.split('|')[0]), 'course chat card: arena green gradient, no white end (' + cc.split('|')[0].slice(0, 70) + '...)');
    log(/rgb\(244, 251, 247\)/.test(cc), 'with light title text');
    await cp.getByTestId('course-chat-link').scrollIntoViewIfNeeded();
    await cp.getByTestId('course-chat-link').screenshot({ path: '/tmp/dev/growth10-chatcard-dark.png' });
    const lcc = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block', colorScheme: 'light' });
    await lcc.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/trainee-login', 't5@dev.test'))]);
    const lp2 = await lcc.newPage();
    await lp2.goto(`${B}/trainee/courses/${own}`);
    await lp2.getByTestId('course-chat-link').waitFor();
    await lp2.getByTestId('course-chat-link').screenshot({ path: '/tmp/dev/growth10-chatcard-light.png' });
  } else console.log('NOTE the course chat is not open for the test course here; card not checked (' + chatState.s + ')');
  psql(`delete from "CourseEnrollment" where id='gfchat1'`);
  // a desktop view
  const dctx = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await dctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const dp = await dctx.newPage();
  await dp.goto(`${B}/play/${slug}`);
  await dp.getByTestId('growth-start').click();
  await dp.getByTestId('growth-timer').waitFor();
  await dp.screenshot({ path: '/tmp/dev/growth10-question-desktop.png' });
  await br.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
