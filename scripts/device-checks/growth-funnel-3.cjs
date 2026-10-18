// Growth funnel: async duels and the shareable result card. A friend plays the same five questions in the same order,
// the result compares the two, standings list the challenger and friends, the card image is a real PNG at the right sizes,
// a challenge link previews as that card, and a closed campaign takes no new duels. Phone first.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const png = async (path) => { const r = await fetch(B + path); const b = Buffer.from(await r.arrayBuffer()); return { s: r.status, type: r.headers.get('content-type'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), size: b.length, buf: b }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  const start = async (body = {}) => (await call(null, 'POST', `/api/public/growth/${slug}/play`, body));
  // Plays all five, picking option index `pick(i)`; returns the question ids seen in order and the final state.
  const run = async (p, pick) => { const seen = []; let state = p.state; let i = 0; while (state.status === 'question') { seen.push(state.question.id); const rr = await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: p.token, choice: state.question.options[pick(i, state.question.options)].key }); state = rr.j.state; i++; } return { seen, state }; };
  // A picks the option that is correct for the first questions by asking the answer endpoint is impossible, so scores differ by position: A takes option 0 each time, B takes the last one.
  const first = (i, o) => 0; const last = (i, o) => o.length - 1;

  // ---- the challenger
  const a = (await start({ source: 'whatsapp-group' })).j;
  log((await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: a.token })).s === 409, 'a challenge cannot be made before the five questions are done');
  const ra = await run(a, first);
  log(ra.state.status === 'done' && /^[a-z2-9]{8}$/.test(ra.state.shareCode), 'finishing gives a public share code (' + ra.state.shareCode + ')');
  log(ra.state.standings.length === 0 && ra.state.duel === null, 'nobody has taken the challenge yet');
  let ch = await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: a.token, nickname: "Ada O'Neil!! <b>" });
  log(ch.s === 200 && ch.j.nickname === "Ada O'Neil b", 'the challenge name is cleaned (' + ch.j.nickname + ')');
  log(ch.j.duelUrl.includes(`/play/${slug}?duel=${ra.state.shareCode}`) && ch.j.cardPath === `/api/public/growth/${slug}/card/${ra.state.shareCode}`, 'it returns the challenge link and card path');
  log(/^Ada O'Neil b here\. I got \d\/5/.test(ch.j.text), 'and a ready message');
  ch = await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: a.token, nickname: '' });
  log(ch.j.nickname === null && ch.j.shareCode === ra.state.shareCode, 'clearing the name keeps the same code');
  await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: a.token, nickname: 'Ada' });
  const code = ra.state.shareCode;

  // ---- a friend takes the duel
  const bStart = await start({ duel: code, nickname: 'Bo' });
  const b = bStart.j;
  log(b.state.status === 'question' && b.state.duelAgainst === 'Ada', 'the friend is told who they are playing');
  log(!/isCorrect|correctKey|explanation|token/.test(JSON.stringify(b.state)), 'the friend sees no answers and no tokens');
  const rb = await run(b, last);
  log(JSON.stringify(rb.seen) === JSON.stringify(ra.seen), 'the friend got the same five questions in the same order');
  log(rb.state.status === 'done' && rb.state.duel && ['WIN', 'LOSE', 'TIE'].includes(rb.state.duel.outcome) && rb.state.duel.opponentName === 'Ada', 'the friend gets a head-to-head result (' + (rb.state.duel && rb.state.duel.outcome) + ')');
  log(rb.state.duel.headline.length > 5, 'with a headline: ' + rb.state.duel.headline);
  log(rb.state.standings.length === 2 && rb.state.standings.filter((x) => x.you).length === 1 && rb.state.standings.some((x) => x.name === 'Ada'), 'standings list the challenger and the friend, marking "you"');
  log(!/token|shareCode/.test(JSON.stringify(rb.state.standings)), 'standings carry no private fields');
  log(psql(`select source from "GrowthGuestPlay" where token='${b.token}'`) === 'duel' && psql(`select nickname from "GrowthGuestPlay" where token='${b.token}'`) === 'Bo', 'the duel is recorded as such, with the friend\'s name');
  log(Number(psql(`select "durationMs" from "GrowthGuestPlay" where token='${b.token}'`)) >= 0, 'how long it took is recorded');

  // ---- the challenger sees the friend
  const aAgain = (await start({ token: a.token })).j;
  log(aAgain.state.standings.length === 2 && aAgain.state.standings.some((x) => x.name === 'Bo') && aAgain.state.duel === null, 'the challenger sees the friend on their board');

  // ---- several friends, ranked
  const c = (await start({ duel: code, nickname: 'Cy' })).j; await run(c, first);
  const d = (await start({ duel: code })).j; await run(d, last);
  const board = (await start({ token: a.token })).j.state.standings;
  const sorted = [...board].every((x, i) => i === 0 || board[i - 1].score > x.score || (board[i - 1].score === x.score));
  log(board.length === 4 && sorted, 'four on the board, best first (' + board.map((x) => x.name + ':' + x.score).join(', ') + ')');
  log(board.some((x) => x.name === 'A friend'), 'a friend with no name shows as "A friend"');

  // ---- bad duel codes
  const bad = (await start({ duel: 'zzzzzzzz' })).j;
  log(bad.state.status === 'question' && bad.state.duelAgainst === null, 'an unknown challenge code just starts an ordinary play');
  const junk = (await start({ duel: '../etc/passwd' }));
  log(junk.s === 200 || junk.s === 400, 'a junk code is handled (' + junk.s + ')');

  // ---- a chain: the friend challenges someone else
  const chB = await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: b.token, nickname: 'Bo' });
  const e = (await start({ duel: chB.j.shareCode, nickname: 'Eli' })).j; const re = await run(e, first);
  log(re.state.duel && re.state.duel.opponentName === 'Bo' && re.state.standings.length === 2 && re.state.standings.every((x) => x.name === 'You' || x.name === 'Bo'), 'a challenge from a friend has its own board (Bo and Eli, not Ada\'s)');

  // ---- the card
  let c1 = await png(`/api/public/growth/${slug}/card/${code}`);
  log(c1.s === 200 && c1.type === 'image/png' && c1.w === 1200 && c1.h === 630, 'the card is a 1200x630 PNG (' + c1.w + 'x' + c1.h + ', ' + c1.size + ' bytes)');
  let c2 = await png(`/api/public/growth/${slug}/card/${code}?format=status`);
  log(c2.s === 200 && c2.w === 1080 && c2.h === 1920, 'the Status card is a 1080x1920 PNG');
  require('fs').writeFileSync('/tmp/dev/growth-card-og.png', c1.buf); require('fs').writeFileSync('/tmp/dev/growth-card-status.png', c2.buf);
  log((await fetch(`${B}/api/public/growth/${slug}/card/zzzzzzzz`)).status === 404, 'an unknown card is a 404');
  log((await fetch(`${B}/api/public/growth/${slug}/card/${code}?format=bogus`)).status === 200, 'an unknown format falls back to the link-preview size');
  const html = await (await fetch(`${B}/play/${slug}?duel=${code}`)).text();
  log(html.includes('og:image') && html.includes(`/api/public/growth/${slug}/card/${code}`) && /Can you beat Ada/.test(html), 'the challenge link previews as that card, titled "Can you beat Ada..."');
  const plain = await (await fetch(`${B}/play/${slug}`)).text();
  log(!plain.includes('/card/'), 'an ordinary link has no card preview');

  // ---- phone flow
  const br = await launch();
  const ctxA = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' });
  await ctxA.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const pa = await ctxA.newPage();
  await pa.goto(`${B}/play/${slug}`);
  await pa.getByTestId('growth-start').click();
  for (let i = 0; i < 5; i++) { await pa.getByTestId('growth-question').waitFor(); await pa.getByTestId('growth-option').first().click(); await pa.getByTestId('growth-next').click(); }
  await pa.getByTestId('growth-score').waitFor();
  await pa.getByTestId('growth-challenge-name').fill('Chidi');
  await pa.getByTestId('growth-challenge').click();
  await pa.getByTestId('growth-challenge-panel').waitFor();
  const wa = decodeURIComponent(await pa.getByTestId('growth-wa-send').getAttribute('href'));
  const duelUrl = wa.match(/https?:\/\/\S+\?duel=[a-z0-9]+/)[0];
  log(/Chidi here\./.test(wa), 'on a phone: naming the challenge puts the name in the WhatsApp message');
  await pa.screenshot({ path: '/tmp/dev/growth3-challenge-phone.png' });
  const popupP = pa.waitForEvent('popup');
  await pa.getByTestId('growth-share-card').click();
  const popup = await popupP;
  log(/format=status/.test(popup.url()), 'the share-card button opens the Status image when the phone cannot share files directly');
  await popup.close();
  log(await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll on the challenger screen');

  const ctxF = await br.newContext({ ...device('Pixel 7'), serviceWorkers: 'block' });
  await ctxF.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const pf = await ctxF.newPage();
  await pf.goto(`${B}${new URL(duelUrl).pathname}${new URL(duelUrl).search}`);
  await pf.getByTestId('growth-duel-intro').waitFor();
  log(/Chidi challenged you/.test(await pf.getByTestId('growth-duel-intro').innerText()), "on a friend's phone: the link opens on \"Chidi challenged you\"");
  await pf.screenshot({ path: '/tmp/dev/growth3-duel-intro-phone.png' });
  await pf.getByTestId('growth-duel-name').fill('Tola');
  await pf.getByTestId('growth-start').click();
  await pf.getByTestId('growth-duel-label').waitFor();
  log(/Duel vs Chidi/.test(await pf.getByTestId('growth-duel-label').innerText()), 'questions are labelled as a duel');
  for (let i = 0; i < 5; i++) { await pf.getByTestId('growth-question').waitFor(); await pf.getByTestId('growth-option').last().click(); await pf.getByTestId('growth-next').click(); }
  await pf.getByTestId('growth-duel-headline').waitFor();
  log(/Chidi/.test(await pf.getByTestId('growth-duel-headline').innerText()), 'the friend sees the head-to-head headline');
  log(/Standings in this challenge/.test(await pf.getByTestId('growth-standings').innerText()) && /You/.test(await pf.getByTestId('growth-standings').innerText()), 'and the standings');
  await pf.screenshot({ path: '/tmp/dev/growth3-duel-result-phone.png' });
  log(await pf.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll on the friend's screen");
  await pf.reload();
  await pf.getByTestId('growth-duel-headline').waitFor();
  log(true, 'a reload on the duel link resumes the finished duel');

  await pa.reload();
  await pa.getByTestId('growth-standings').waitFor();
  log(/Tola/.test(await pa.getByTestId('growth-standings').innerText()) && /Friends who took your challenge/.test(await pa.getByTestId('growth-standings').innerText()), 'the challenger sees Tola on their board');
  await pa.screenshot({ path: '/tmp/dev/growth3-board-phone.png' });

  // ---- closing the campaign
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: false });
  log((await start({ duel: code })).s === 410, 'a closed campaign takes no new duels');
  const mid = (await start({ token: b.token })).j;
  log(mid.state.status === 'done', 'but a finished result can still be opened');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await br.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
