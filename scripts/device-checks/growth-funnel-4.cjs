// Growth funnel: squad challenges. A squad is a group whose members play the same five questions; its score is the total.
// Checks starting a squad, joining it, the board, answering another squad's challenge (the rival link), the member cap,
// the per-device join limit, and the phone flow end to end.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  const start = async (body = {}) => call(null, 'POST', `/api/public/growth/${slug}/play`, body);
  const run = async (p, pick) => { const seen = []; let state = p.state; let i = 0; while (state.status === 'question') { seen.push(state.question.id); const rr = await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: p.token, choice: state.question.options[pick(i, state.question.options)].key }); state = rr.j.state; i++; } return { seen, state }; };
  const first = () => 0; const last = (i, o) => o.length - 1;
  const mkSquad = (token, name, nickname) => call(null, 'POST', `/api/public/growth/${slug}/squad`, { token, name, nickname });

  // ---- starting a squad
  const a = (await start()).j;
  log((await mkSquad(a.token, 'Lagos Tech')).s === 409, 'a squad cannot be started before the five questions are done');
  const ra = await run(a, first);
  log((await mkSquad(a.token, 'ab')).s === 400, 'a squad name under 3 characters is refused');
  let sq = await mkSquad(a.token, "  Lagos   Tech!!  ", 'Ada');
  log(sq.s === 200 && sq.j.squad.name === 'Lagos Tech', 'the squad name is cleaned (' + (sq.j.squad && sq.j.squad.name) + ')');
  const SA = sq.j.squad;
  log(/^[a-z2-9]{8}$/.test(SA.code) && SA.members === 1 && SA.total === ra.state.score && SA.max === 5 && SA.rank === 1 && SA.of === 1 && SA.isCaptain, 'it starts with the captain, whose score counts (' + SA.total + '/' + SA.max + ')');
  log(SA.joinUrl.includes(`/play/${slug}?squad=${SA.code}`) && SA.rivalUrl.includes(`/play/${slug}?rival=${SA.code}`), 'it has a join link and a challenge link');
  log(/^Join Lagos Tech!/.test(SA.joinText) && /^Lagos Tech challenges your squad/.test(SA.rivalText), 'and ready messages');
  log((await mkSquad(a.token, 'Another One')).s === 409, 'a player cannot start a second squad');

  // ---- members join
  const b = (await start({ squad: SA.code, nickname: 'Bo' })).j;
  log(b.state.status === 'question' && b.state.squadName === 'Lagos Tech', 'a member is told which squad they are playing for');
  log(!/isCorrect|correctKey|explanation|token/.test(JSON.stringify(b.state)), 'and sees no answers');
  const rb = await run(b, last);
  log(JSON.stringify(rb.seen) === JSON.stringify(ra.seen), 'a member plays the same five questions in the same order');
  log(rb.state.squad && rb.state.squad.members === 2 && rb.state.squad.total === ra.state.score + rb.state.score, 'the squad total is the sum of its members (' + rb.state.squad.total + ')');
  log(rb.state.squad.board.some((m) => m.you) && rb.state.squad.board.some((m) => m.name === 'Ada'), 'the board marks "you" and names the captain');
  log(!rb.state.squad.isCaptain && psql(`select source from "GrowthGuestPlay" where token='${b.token}'`) === 'squad', 'the member is not the captain, and the play is recorded as a squad play');
  const c = (await start({ squad: SA.code, nickname: 'Cy' })).j; await run(c, first);
  const d = (await start({ squad: SA.code })).j; await run(d, last);
  const aView = (await start({ token: a.token })).j.state.squad;
  log(aView.members === 4 && aView.board.length === 4 && aView.board.some((m) => m.name === 'A member'), 'the captain sees all four members, best first');
  const sortedOk = aView.board.every((m, i) => i === 0 || aView.board[i - 1].score >= m.score);
  log(sortedOk, 'ordered by score');
  log(!/token|shareCode|squadId/.test(JSON.stringify(aView)), 'the squad view carries no private fields');
  const none = (await start({ squad: 'zzzzzzzz' })).j;
  log(none.state.squadName === null, 'an unknown squad code just starts an ordinary play');
  clearThrottle();

  // ---- answering another squad's challenge
  const e = (await start({ rival: SA.code, nickname: 'Eli' })).j;
  log(e.state.status === 'question' && e.state.squadName === null, 'someone answering a challenge is not yet in a squad');
  const re = await run(e, first);
  log(JSON.stringify(re.seen) === JSON.stringify(ra.seen), 'they play the challenger squad\'s five questions');
  log(re.state.squad === null && re.state.rivalSquadName === 'Lagos Tech', 'and are asked to start a squad to answer Lagos Tech');
  const sqE = await mkSquad(e.token, 'Abuja Devs');
  const SE = sqE.j.squad;
  log(sqE.s === 200 && SE.rivalOf && SE.rivalOf.name === 'Lagos Tech', 'their squad is recorded as answering Lagos Tech');
  log(['AHEAD', 'BEHIND', 'LEVEL'].includes(SE.rivalOf.standing) && SE.rivalOf.total === aView.total, 'with the head-to-head (' + SE.rivalOf.standing + ')');
  const aAgain = (await start({ token: a.token })).j.state.squad;
  log(aAgain.rivals.length === 1 && aAgain.rivals[0].name === 'Abuja Devs' && aAgain.rivals[0].members === 1, 'the original squad now lists Abuja Devs as a rival');
  const flip = { AHEAD: 'BEHIND', BEHIND: 'AHEAD', LEVEL: 'LEVEL' };
  log(aAgain.rivals[0].standing === flip[SE.rivalOf.standing], 'and the two views agree on who is ahead');
  const f = (await start({ squad: SE.code, nickname: 'Fay' })).j; const rf = await run(f, last);
  log(rf.state.squad.members === 2 && rf.state.squad.of === 2 && [1, 2].includes(rf.state.squad.rank), 'a second squad has its own members and a place among the squads (#' + rf.state.squad.rank + ' of ' + rf.state.squad.of + ')');
  log(psql(`select count(*) from "GrowthSquad"`) === '2', 'two squads exist');
  clearThrottle();

  // ---- limits
  psql(`insert into "GrowthGuestPlay"(id,token,"campaignId","questionIds","squadId","startedAt") select 'fill'||g, 'filltoken'||g, c.id, '[]'::jsonb, q.id, now() from generate_series(1,46) g, "GrowthCampaign" c, "GrowthSquad" q where q.code='${SA.code}'`);
  const members = psql(`select count(*) from "GrowthGuestPlay" where "squadId"=(select id from "GrowthSquad" where code='${SA.code}')`);
  log(members === '50', 'the squad has 50 members (' + members + ')');
  const full = await start({ squad: SA.code });
  log(full.s === 409 && /full/i.test(full.j.error), 'a full squad refuses another member (' + full.s + ')');
  psql(`delete from "GrowthGuestPlay" where id like 'fill%'`);
  clearThrottle();
  let ok = 0, limited = 0;
  for (let i = 0; i < 8; i++) { const r = await start({ squad: SA.code }); if (r.s === 200) ok++; else if (r.s === 429) limited++; }
  log(ok === 6 && limited === 2, 'one device can join the same squad 6 times an hour (' + ok + ' allowed, ' + limited + ' refused)');
  clearThrottle();

  // ---- the phone flow
  const br = await launch();
  const mk = async (name) => { const ctx = await br.newContext({ ...device(name), serviceWorkers: 'block' }); await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]); return ctx.newPage(); };
  const play5 = async (pg, idx) => { for (let i = 0; i < 5; i++) { await pg.getByTestId('growth-question').waitFor(); await pg.getByTestId('growth-option').nth(idx).click(); await pg.getByTestId('growth-next').click(); } await pg.getByTestId('growth-score').waitFor(); };
  const pa = await mk('iPhone 13');
  await pa.goto(`${B}/play/${slug}`);
  await pa.getByTestId('growth-start').click();
  await play5(pa, 0);
  await pa.getByTestId('growth-squad-open').click();
  await pa.getByTestId('growth-squad-create').click();
  await pa.getByTestId('growth-squad-form').getByRole('alert').waitFor();
  log(/3 to 24/.test(await pa.getByTestId('growth-squad-form').innerText()), 'on a phone: an empty squad name says what is needed');
  await pa.getByTestId('growth-squad-name').fill('Ibadan Coders');
  await pa.getByTestId('growth-squad-create').click();
  await pa.getByTestId('growth-squad-card').waitFor();
  log(/Ibadan Coders/.test(await pa.getByTestId('growth-squad-card').innerText()) && /1\/50 members/.test(await pa.getByTestId('growth-squad-totals').innerText()), 'on a phone: the squad card shows the name and 1/50 members');
  const inv = decodeURIComponent(await pa.getByTestId('growth-squad-invite').getAttribute('href'));
  const joinUrl = inv.match(/https?:\/\/\S+\?squad=[a-z0-9]+/)[0];
  const chl = decodeURIComponent(await pa.getByTestId('growth-squad-challenge').getAttribute('href'));
  const rivalUrl = chl.match(/https?:\/\/\S+\?rival=[a-z0-9]+/)[0];
  log(/^https:\/\/wa\.me\/\?text=Join Ibadan Coders!/.test(inv) && /challenges your squad/.test(chl), 'the invite and the challenge are ready WhatsApp messages');
  await pa.screenshot({ path: '/tmp/dev/growth4-squad-card-phone.png' });
  log(await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll on the squad card');

  const pf = await mk('Pixel 7');
  await pf.goto(`${B}${new URL(joinUrl).pathname}${new URL(joinUrl).search}`);
  await pf.getByTestId('growth-squad-intro').waitFor();
  log(/Join Ibadan Coders/.test(await pf.getByTestId('growth-squad-intro').innerText()), "on a friend's phone: the link opens on \"Join Ibadan Coders\"");
  await pf.screenshot({ path: '/tmp/dev/growth4-join-intro-phone.png' });
  await pf.getByTestId('growth-squad-intro-name').fill('Tola');
  await pf.getByTestId('growth-start').click();
  await pf.getByTestId('growth-squad-label').waitFor();
  log(/Squad: Ibadan Coders/i.test(await pf.getByTestId('growth-squad-label').innerText()), 'questions are labelled with the squad');
  await play5(pf, 1);
  await pf.getByTestId('growth-squad-card').waitFor();
  log(/2\/50 members/.test(await pf.getByTestId('growth-squad-totals').innerText()) && /You/.test(await pf.getByTestId('growth-squad-board').innerText()), 'the friend lands on the squad card with 2/50 members and themselves marked');
  await pf.screenshot({ path: '/tmp/dev/growth4-member-phone.png' });
  log(await pf.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll on the friend's screen");

  const pr = await mk('iPhone 13');
  await pr.goto(`${B}${new URL(rivalUrl).pathname}${new URL(rivalUrl).search}`);
  await pr.getByTestId('growth-squad-intro').waitFor();
  log(/Ibadan Coders challenged your squad/.test(await pr.getByTestId('growth-squad-intro').innerText()), 'a rival link opens on "Ibadan Coders challenged your squad"');
  await pr.screenshot({ path: '/tmp/dev/growth4-rival-intro-phone.png' });
  await pr.getByTestId('growth-start').click();
  await play5(pr, 0);
  await pr.getByTestId('growth-squad-form').waitFor();
  log(/Ibadan Coders challenged your squad/.test(await pr.getByTestId('growth-squad-form').innerText()), 'after playing they are asked to start a squad to answer it');
  await pr.getByTestId('growth-squad-name').fill('Kano Builders');
  await pr.getByTestId('growth-squad-create').click();
  await pr.getByTestId('growth-squad-rival').waitFor();
  log(/Answering: Ibadan Coders/.test(await pr.getByTestId('growth-squad-rival').innerText()), 'their card shows the head-to-head with the squad they are answering');
  await pr.screenshot({ path: '/tmp/dev/growth4-rival-card-phone.png' });

  await pa.reload();
  await pa.getByTestId('growth-squad-rival').waitFor();
  log(/Rival: Kano Builders/.test(await pa.getByTestId('growth-squad-rival').innerText()) && /2\/50 members|members/.test(await pa.getByTestId('growth-squad-totals').innerText()), 'the first squad sees Kano Builders as a rival');
  await pa.screenshot({ path: '/tmp/dev/growth4-board-phone.png' });

  // ---- closing the campaign
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: false });
  log((await start({ squad: SA.code })).s === 410, 'a closed campaign takes no new members');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await br.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
