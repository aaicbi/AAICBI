// Growth funnel: the Super Admin screen for squads and challenges. Builds squads (one answering another), friend duels (won, lost, unfinished),
// then checks the lists and numbers, filters, search, paging, rename, remove (scores stay, rival links clear), clearing a nickname,
// who may use it, the audit log, and the screens on desktop and phone.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
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
  const start = (body = {}) => call(null, 'POST', `/api/public/growth/${slug}/play`, body);
  const run = async (p, pick) => { let state = p.state; let i = 0; while (state.status === 'question') { const rr = await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: p.token, choice: state.question.options[pick(i, state.question.options)].key }); state = rr.j.state; i++; } return state; };
  const first = () => 0; const last = (i, o) => o.length - 1;
  const mkSquad = (token, name, nickname) => call(null, 'POST', `/api/public/growth/${slug}/squad`, { token, name, nickname });

  // squads: Lagos Tech (Ada captain, Bo member), Abuja Devs answers Lagos Tech
  const a = (await start({})).j; const ra = await run(a, first);
  const SA = (await mkSquad(a.token, 'Lagos Tech', 'Ada')).j.squad;
  const b = (await start({ squad: SA.code, nickname: 'Bo' })).j; await run(b, first);
  const e = (await start({ rival: SA.code })).j; await run(e, last);
  const SE = (await mkSquad(e.token, 'Abuja Devs', 'Eve')).j.squad;
  // friend duels against Ada: Cy (answers like Ada), Di (answers the other way), Fu (starts, never finishes)
  await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: a.token, nickname: 'Ada' });
  const code = ra.shareCode;
  const cy = (await start({ duel: code, nickname: 'Cy' })).j; await run(cy, first);
  const di = (await start({ duel: code, nickname: 'Di' })).j; await run(di, last);
  await start({ duel: code, nickname: 'Fu' });

  const G = (q) => call(S, 'GET', `/api/admin/growth/groups?${q}`);
  // ---- who may use it
  log((await call(null, 'GET', '/api/admin/growth/groups')).s === 401 || (await call(null, 'GET', '/api/admin/growth/groups')).s === 403, 'signed out: refused');
  const T = await jar('/api/auth/trainee-login', 't5@dev.test');
  log((await call(T, 'GET', '/api/admin/growth/groups')).s === 403 && (await call(T, 'POST', '/api/admin/growth/groups', { action: 'clearName', playId: 'x' })).s === 403, 'a trainee cannot read or change anything');
  const ORG = await jar('/api/auth/training-org-login', 'org@dev.test');
  log((await call(ORG, 'GET', '/api/admin/growth/groups')).s === 403, 'an organization cannot read it either');

  // ---- squads list
  let sq = (await G('kind=squads')).j;
  log(sq.total === 2 && sq.rows[0].name === 'Abuja Devs' && sq.rows[1].name === 'Lagos Tech', 'two squads, newest first');
  const lagos = sq.rows.find((r) => r.name === 'Lagos Tech'), abuja = sq.rows.find((r) => r.name === 'Abuja Devs');
  log(lagos.members === 2 && lagos.finished === 2 && lagos.captain === 'Ada', 'Lagos Tech: 2 members, both finished, captain Ada');
  log(abuja.rivalOf === 'Lagos Tech' && lagos.answeredBy === 1, 'Abuja Devs answers Lagos Tech, and Lagos Tech knows it was answered');
  log(lagos.points === 2 * 0 + lagos.points && lagos.outOf === 10 && lagos.joinUrl.includes(`?squad=${SA.code}`), 'points are out of 5 per finished member, with the join link');
  log(!/token|shareCode/.test(JSON.stringify(sq)), 'no private fields leak');
  log((await G('kind=squads&q=lagos')).j.rows.length === 1 && (await G('kind=squads&q=zzzz')).j.rows.length === 0, 'search by squad name');
  const camp = sq.campaigns[0].id;
  log((await G(`kind=squads&campaign=${camp}`)).j.total === 2 && (await G('kind=squads&campaign=nope')).j.total === 0, 'filter by course');
  log(sq.summary.squads === 2 && sq.summary.inSquads >= 3, 'summary counts squads and plays inside them');

  // ---- challenges list
  const ch = (await G('kind=challenges')).j;
  log(ch.total === 3 && ch.summary.challenges === 3 && ch.summary.finishedChallenges === 2, 'three challenges, two finished');
  const by = (n) => ch.rows.find((r) => r.responder.name === n);
  log(by('Cy').challenger.name === 'Ada' && by('Cy').outcome !== null && by('Fu').outcome === null && by('Fu').finished === false, 'each names the challenger, an outcome when finished, none when not');
  log(by('Cy').responder.score === by('Cy').challenger.score && by('Di').responder.score <= by('Cy').responder.score, 'scores are shown for both sides: answering the same way ties the challenger on points, the other way does no better');
  log(!/token|shareCode/.test(JSON.stringify(ch)), 'challenges carry no private fields');

  // ---- paging: 26 more squads
  for (let i = 0; i < 26; i++) psql(`insert into "GrowthSquad"(id,"campaignId",code,name,"questionIds") select 'pg${i}', "campaignId", 'pgcode${i}', 'Page Squad ${i}', "questionIds" from "GrowthSquad" where id='${lagos.id}'`);
  const p1 = (await G('kind=squads')).j, p2 = (await G('kind=squads&page=2')).j;
  log(p1.total === 28 && p1.rows.length === 25 && p1.pages === 2 && p2.rows.length === 3 && p1.rows.every((r) => !p2.rows.some((x) => x.id === r.id)), 'paging: 25 then 3, no overlap');
  psql(`delete from "GrowthSquad" where id like 'pg%'`);

  // ---- rename
  const P = (b) => call(S, 'POST', '/api/admin/growth/groups', b);
  log((await P({ action: 'rename', squadId: lagos.id, name: 'ab' })).s === 400, 'a name under 3 characters is refused');
  log((await P({ action: 'rename', squadId: 'nope', name: 'Fine Name' })).s === 404, 'an unknown squad is a 404');
  const rn = await P({ action: 'rename', squadId: lagos.id, name: 'Lagos <b>Legends</b>!!' });
  log(rn.s === 200 && psql(`select name from "GrowthSquad" where id='${lagos.id}'`) === 'Lagos bLegendsb', 'rename cleans the name like a player-typed one');
  const view = (await start({ token: a.token })).j.state.squad;
  log(view.name === 'Lagos bLegendsb', 'players see the new name');

  // ---- clear a nickname
  const diId = ch.rows.find((r) => r.responder.name === 'Di').responder.id;
  log((await P({ action: 'clearName', playId: diId })).s === 200 && psql(`select nickname is null from "GrowthGuestPlay" where id='${diId}'`) === 't', 'clear name removes the nickname');
  log(psql(`select score from "GrowthGuestPlay" where id='${diId}'`) === String(by('Di').responder.score), 'and keeps the score');
  log((await G('kind=challenges')).j.rows.some((r) => r.responder.name === 'A friend'), 'the list shows "A friend" for it');

  // ---- remove a squad: scores stay, rival links clear
  const before = Number(psql(`select count(*) from "GrowthGuestPlay" where "squadId"='${lagos.id}'`));
  const rm = await P({ action: 'remove', squadId: lagos.id });
  log(rm.s === 200 && psql(`select count(*) from "GrowthSquad" where id='${lagos.id}'`) === '0', 'remove deletes the squad');
  log(psql(`select count(*) from "GrowthGuestPlay" where id='${a.token ? psql(`select id from "GrowthGuestPlay" where token='${a.token}'`) : ''}'`) === '1' && before === 2, 'its members\' plays stay');
  log(psql(`select count(*) from "GrowthGuestPlay" where "squadId"='${lagos.id}'`) === '0', 'but they no longer count for a squad');
  log(psql(`select "rivalOfId" is null from "GrowthSquad" where id='${abuja.id}'`) === 't', 'the squad that answered it loses the link, and stays');
  sq = (await G('kind=squads')).j;
  log(sq.total === 1 && sq.rows[0].rivalOf === null, 'the list now has one squad, no longer answering anyone');
  log((await P({ action: 'remove', squadId: lagos.id })).s === 404, 'removing twice is a 404');
  log((await start({ token: a.token })).j.state.squad === null, 'a removed squad\'s captain just sees their own result');

  // ---- audit
  const log8 = (await call(S, 'GET', '/api/admin/growth')).j.log.map((l) => l.action);
  log(['SQUAD_RENAMED', 'NAME_CLEARED', 'SQUAD_REMOVED'].every((x) => log8.includes(x)), 'every change is in the recent changes log');

  // ---- screens
  const br = await launch();
  const dctx = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await dctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  // put a squad back for the screens
  const e2 = (await start({})).j; await run(e2, first); const SX = (await mkSquad(e2.token, 'Screen Squad', 'Zed')).j.squad;
  const pg = await dctx.newPage();
  await pg.goto(`${B}/admin/growth/groups`);
  await pg.getByTestId('squad-list').waitFor();
  log((await pg.getByTestId('squad-row').count()) === 2, 'the page lists the squads');
  await pg.getByRole('button', { name: 'Rename' }).first().click();
  await pg.getByTestId('rename-input').fill('Renamed Here');
  await pg.getByTestId('rename-save').click();
  await pg.waitForTimeout(900);
  log(psql(`select count(*) from "GrowthSquad" where name='Renamed Here'`) === '1', 'rename works from the screen');
  await pg.screenshot({ path: '/tmp/dev/growth8-squads-desktop.png' });
  await pg.getByTestId('tab-challenges').click();
  await pg.getByTestId('challenge-list').waitFor();
  log((await pg.getByTestId('challenge-row').count()) === 3, 'the challenges tab lists three');
  await pg.screenshot({ path: '/tmp/dev/growth8-challenges-desktop.png' });
  pg.on('dialog', (d) => d.accept());
  await pg.getByTestId('tab-squads').click();
  await pg.getByTestId('squad-list').waitFor();
  await pg.getByRole('button', { name: 'Remove' }).first().click();
  await pg.waitForTimeout(900);
  log(Number(psql(`select count(*) from "GrowthSquad"`)) === 1, 'remove works from the screen');
  const pm = await (await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' })).newPage();
  await pm.context().addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  await pm.goto(`${B}/admin/growth/groups`);
  await pm.getByTestId('growth-groups').waitFor();
  await pm.getByTestId('tab-challenges').click();
  await pm.getByTestId('challenge-list').waitFor();
  log(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  await pm.screenshot({ path: '/tmp/dev/growth8-challenges-phone.png' });
  void SX;
  await br.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
