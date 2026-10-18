// Growth funnel: the campaign report and the commission ledger. Builds a small campaign for an organization's course (plays, saved scores,
// Module 1 starts and passes, confirmed payments), then checks the funnel, the sources, the ledger (made once per payment, at the rate of the
// day, kept when the rate changes), payments with no rate, settling, reopening, reversing, who can see what, the CSV, and the screens.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers }; };
(async () => {
  clearThrottle();
  const orgCourse = psql(`select id from "Course" where id like 'cmv9kyf0b%'`);
  const ownCourse = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  const northwindStaff = 'cmuznki2r0002p61xabzm5kd5', northwindOrg = 'cmuznki2x0004p61x1xbxqwex';
  const origCreator = psql(`select "createdById" from "Course" where id='${orgCourse}'`);
  const origPrice = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${orgCourse}'`);
  for (const t of ['GrowthCommission', 'GrowthMessage', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`delete from "Payment" where reference like 'rpt_%'`);
  psql(`update "Course" set "createdById"='${northwindStaff}', published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=4500000 where id='${orgCourse}'`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${ownCourse}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const ORG = await jar('/api/auth/training-org-login', 'org@dev.test');
  const T = {}; for (const n of [5, 6, 7, 8, 9]) T[n] = psql(`select id from "Trainee" where email='t${n}@dev.test'`);
  for (const id of Object.values(T)) { psql(`delete from "CourseEnrollment" where "traineeId"='${id}' and "courseId" in ('${orgCourse}','${ownCourse}')`); psql(`delete from "ModuleCompletion" where "traineeId"='${id}'`); }
  const mod1 = psql(`select id from "Module" where "courseId"='${orgCourse}' order by "order", "createdAt" limit 1`);

  // ---- two live campaigns: the organization's (15%) and AAICBI's own
  const live = async (courseId) => {
    await call(S, 'POST', `/api/admin/courses/${courseId}/growth`, { action: 'propose' });
    for (const q of (await call(S, 'GET', `/api/admin/courses/${courseId}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${courseId}/growth`, { action: 'approve', questionId: q.questionId });
    await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId, enabled: true });
    return psql(`select slug from "GrowthCampaign" where "courseId"='${courseId}'`);
  };
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'ORGS', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: true, agree: true, commissionPercent: 15 });
  const slugOrg = await live(orgCourse), slugOwn = await live(ownCourse);

  const play = async (slug, source, { finish = true, save = false } = {}) => {
    const st = (await call(null, 'POST', `/api/public/growth/${slug}/play`, { source })).j;
    let s = st.state;
    if (finish) while (s.status === 'question') s = (await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: st.token, choice: s.question.options[0].key })).j.state;
    if (save) await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: st.token, phone: '0803 123 4567', consent: true });
    return st.token;
  };
  const claim = async (n, slug, token) => { const c = await jar('/api/auth/trainee-login', `t${n}@dev.test`); return call(c, 'POST', '/api/growth/claim', { slug, token }); };
  let payN = 0;
  const pay = (n, courseId, amount = 4500000) => { payN++; psql(`insert into "Payment"(id,"traineeId","courseId",reference,"amountKobo",status,"confirmedAt","initiatedAt") values ('rptid${payN}','${T[n]}','${courseId}','rpt_${payN}',${amount},'SUCCESS', now(), now())`); return `rpt_${payN}`; };

  // organization campaign: five plays
  const p1 = await play(slugOrg, 'whatsapp-group', { save: true });   // finishes, saves, starts module 1, passes it, pays
  const p2 = await play(slugOrg, 'share');                             // finishes, starts module 1
  const p3 = await play(slugOrg, 'whatsapp-group', { finish: false }); // started only
  const p4 = await play(slugOrg, 'whatsapp-group', { save: true });    // finishes, saves
  const p5 = await play(slugOrg, null);                                // finishes, direct
  await claim(5, slugOrg, p1); await claim(6, slugOrg, p2);
  psql(`insert into "ModuleCompletion"(id,"moduleId","traineeId","completedAt") values ('rptmc1','${mod1}','${T[5]}',now())`);
  const ref1 = pay(5, orgCourse);
  // a squad and a friend challenge for the extras
  const tok = p1; await call(null, 'POST', `/api/public/growth/${slugOrg}/squad`, { token: tok, name: 'Report Squad' });
  const code = (await call(null, 'POST', `/api/public/growth/${slugOrg}/challenge`, { token: p4 })).j.shareCode;
  await call(null, 'POST', `/api/public/growth/${slugOrg}/play`, { duel: code });
  // AAICBI's own campaign: one play, one payment (no commission applies)
  const o1 = await play(slugOwn, 'tiktok', { save: true }); await claim(9, slugOwn, o1); pay(9, ownCourse);

  const report = (cookie, qs = '') => call(cookie, 'GET', `/api/admin/growth/report?${qs}`);
  const funnel = (j) => Object.fromEntries(j.funnel.map((f) => [f.key, f.count]));

  // ---- who can look
  log((await call(null, 'GET', '/api/admin/growth/report')).s === 401, 'a visitor cannot open the report');
  const trainee = await jar('/api/auth/trainee-login', 't5@dev.test');
  log([401, 403].includes((await call(trainee, 'GET', '/api/admin/growth/report')).s), 'a trainee cannot open the report');

  // ---- the funnel for the organization's campaign
  let r = await report(S, `org=${northwindOrg}&period=all`);
  const f = funnel(r.j);
  const plays = Number(psql(`select count(*) from "GrowthGuestPlay" p join "GrowthCampaign" c on c.id=p."campaignId" where c."courseId"='${orgCourse}'`));
  log(r.s === 200 && r.j.scope.kind === 'ORG' && f.started === plays && plays === 6, 'the funnel counts everyone who started the organization\'s taster (' + f.started + ')');
  log(f.finished === 4 && f.saved === 2, 'finished 4 (the unfinished play and the friend\'s unfinished run are not), saved 2 (' + f.finished + ', ' + f.saved + ')');
  log(f.startedModule1 === 2 && f.passedModule1 === 1 && f.paid === 1, 'two started Module 1, one passed it, one paid (' + f.startedModule1 + ', ' + f.passedModule1 + ', ' + f.paid + ')');
  const step = r.j.funnel.find((x) => x.key === 'finished');
  log(step.ofStarted === Math.round((f.finished / f.started) * 100), 'each step shows its share of those who started');
  log(r.j.extras.squads === 1 && r.j.extras.challenges === 1, 'squads and friend challenges are counted (' + r.j.extras.squads + ', ' + r.j.extras.challenges + ')');
  const wg = r.j.sources.find((x) => x.label === 'whatsapp group');
  log(wg && wg.funnel.started === 3 && wg.funnel.finished === 2 && wg.funnel.saved === 2 && wg.funnel.startedModule1 === 1 && wg.funnel.passedModule1 === 1 && wg.funnel.paid === 1, 'the WhatsApp group source has 3 started, 2 finished, 2 saved, and the one who paid');
  const sh = r.j.sources.find((x) => x.label === 'Shared result');
  log(sh && sh.funnel.started === 1 && sh.funnel.startedModule1 === 1 && sh.funnel.paid === 0, 'the shared-result source shows its Module 1 start and no payment');
  log(r.j.sources.some((x) => x.label === 'Direct link') && r.j.sources.some((x) => x.label === "Friend's challenge"), 'direct links and friend challenges are separate sources');

  // ---- the ledger
  let c = r.j.commission;
  log(c.ledger.length === 1 && c.ledger[0].status === 'OWED' && c.ledger[0].amountKobo === 4500000 && c.ledger[0].rateBps === 1500 && c.ledger[0].commissionKobo === 675000, 'the payment is in the ledger: N45,000 at 15% is N6,750 owed');
  log(/^[A-Z][a-z]+ [A-Z]\.$|^[A-Z]\S*$/.test(c.ledger[0].trainee) && c.ledger[0].reference === ref1 && c.ledger[0].source === 'whatsapp group', 'with the trainee\'s name shortened, the source, and (for a Super Admin) the payment reference');
  r = await report(S, `org=${northwindOrg}&period=all`);
  log(r.j.commission.ledger.length === 1 && psql(`select count(*) from "GrowthCommission"`) === '1', 'opening the report again does not make a second row');
  log(c.summary.owedKobo === 675000 && c.summary.earnedKobo === 675000 && c.summary.settledKobo === 0, 'the totals show N6,750 owed');

  // the rate is frozen on the row
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, commissionPercent: 20 });
  await claim(7, slugOrg, await play(slugOrg, 'whatsapp-group')); psql(`insert into "ModuleCompletion"(id,"moduleId","traineeId","completedAt") values ('rptmc2','${mod1}','${T[7]}',now())`);
  pay(7, orgCourse);
  r = await report(S, `org=${northwindOrg}&period=all`);
  const rates = r.j.commission.ledger.map((x) => x.rateBps).sort();
  log(rates.join() === '1500,2000', 'changing the rate to 20% does not rewrite the earlier row: one at 15%, the new one at 20%');
  log(r.j.commission.summary.earnedKobo === 675000 + 900000, 'and the earned total is N6,750 + N9,000');

  // a payment where the organization has no rate
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, commissionPercent: null });
  await claim(8, slugOrg, await play(slugOrg, 'share')); pay(8, orgCourse);
  r = await report(S, `org=${northwindOrg}&period=all`);
  log(r.j.commission.ledger.length === 2 && r.j.commission.unrated.count === 1 && r.j.commission.unrated.amountKobo === 4500000, 'a payment where the organization has no rate is left out of the ledger and flagged (' + r.j.commission.unrated.count + ' unrated)');
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, commissionPercent: 10 });
  r = await report(S, `org=${northwindOrg}&period=all`);
  log(r.j.commission.ledger.length === 3 && r.j.commission.unrated.count === 0 && r.j.commission.ledger.some((x) => x.rateBps === 1000), 'setting a rate afterwards adds that payment to the ledger at the new rate');
  log(psql(`select count(*) from "GrowthCommission" where "courseId"='${ownCourse}'`) === '0', 'AAICBI\'s own course has a payment but no commission row');
  r = await report(S, 'org=aaicbi&period=all');
  log(funnel(r.j).started === 1 && funnel(r.j).paid === 1 && r.j.commission.ledger.length === 0 && r.j.scope.kind === 'AAICBI', 'AAICBI\'s own campaign shows its funnel and payment with an empty ledger');

  // ---- settling
  r = await report(S, `org=${northwindOrg}&period=all`);
  const ids = r.j.commission.ledger.map((x) => x.id);
  log((await call(ORG, 'POST', '/api/admin/growth/commissions', { action: 'settle', ids: [ids[0]] })).s === 403, 'an organization cannot settle its own commissions');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'settle' })).s === 400, 'settling with nothing chosen is refused');
  let sres = await call(S, 'POST', '/api/admin/growth/commissions', { action: 'settle', ids: [ids[0]], note: '  GTB   ref 123 ' });
  log(sres.s === 200 && sres.j.settled === 1, 'one commission is marked settled');
  r = await report(S, `org=${northwindOrg}&period=all`);
  const row0 = r.j.commission.ledger.find((x) => x.id === ids[0]);
  log(row0.status === 'SETTLED' && row0.note === 'GTB ref 123' && r.j.commission.summary.settledCount === 1, 'with the reference kept and the totals moved');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'settle', ids: [ids[0]] })).s === 409, 'settling it again finds nothing owed');
  sres = await call(S, 'POST', '/api/admin/growth/commissions', { action: 'settle', organizationId: northwindOrg, note: 'bulk' });
  log(sres.s === 200 && sres.j.settled === 2, 'settling everything one organization owes settles the other two');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'reopen', id: ids[0] })).s === 200, 'a settled commission can be reopened');
  r = await report(S, `org=${northwindOrg}&period=all`);
  log(r.j.commission.ledger.find((x) => x.id === ids[0]).status === 'OWED', 'and is owed again');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'reverse', id: ids[0] })).s === 400, 'reversing needs a reason');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'reverse', id: ids[0], note: 'Refunded in Paystack' })).s === 200, 'reversing with a reason works');
  r = await report(S, `org=${northwindOrg}&period=all`);
  log(r.j.commission.ledger.find((x) => x.id === ids[0]).status === 'REVERSED' && r.j.commission.summary.reversedCount === 1 && r.j.commission.summary.payments === 2, 'a reversed commission is not counted in the payments or the totals');
  log((await call(S, 'POST', '/api/admin/growth/commissions', { action: 'reopen', id: ids[0] })).s === 409 && (await call(S, 'POST', '/api/admin/growth/commissions', { action: 'settle', ids: [ids[0]] })).s === 409, 'a reversed commission cannot be reopened or settled');
  log(Number(psql(`select count(*) from "GrowthAudit" where "scopeType"='COMMISSION'`)) >= 4, 'every settlement and reversal is in the audit log');

  // ---- what an organization sees
  r = await report(ORG, 'org=all&period=all');
  log(r.s === 200 && r.j.scope.kind === 'OWN' && r.j.organizations.length === 0 && r.j.canSettle === false, 'an organization sees its own report, without the organization list or settle buttons');
  log(funnel(r.j).started === funnel((await report(S, `org=${northwindOrg}&period=all`)).j).started && r.j.commission.ledger.length === 3, 'and the same numbers as the Super Admin sees for it');
  log(r.j.commission.ledger.every((x) => x.reference === null), 'but no payment references');
  log(!JSON.stringify(r.j).includes(slugOwn) && r.j.courses.every((x) => x.courseId === orgCourse), 'and nothing about any other course, even when it asks for everything');
  const other = await report(ORG, `org=aaicbi&period=all`);
  log(other.j.courses.every((x) => x.courseId === orgCourse), 'asking for someone else\'s campaigns still returns only its own');

  // ---- periods
  psql(`update "GrowthGuestPlay" set "startedAt" = now() - interval '40 days' where token='${p5}'`);
  const r30 = await report(S, `org=${northwindOrg}&period=30d`), rAll = await report(S, `org=${northwindOrg}&period=all`);
  log(funnel(rAll.j).started - funnel(r30.j).started === 1 && r30.j.period === '30d', 'a play from 40 days ago is in "all time" but not in the last 30 days');
  psql(`update "GrowthCommission" set "paidAt" = now() - interval '100 days' where id='${ids[1]}'`);
  const r90 = await report(S, `org=${northwindOrg}&period=90d`);
  log(r90.j.commission.ledger.length === 2 && rAll.j.commission.ledger.length === 3, 'a payment from 100 days ago is only in "all time"');
  log((await report(S, `org=${northwindOrg}&period=banana`)).j.period === '30d', 'an unknown period falls back to 30 days');
  log((await report(S, 'org=cmnotanorg')).s === 404, 'an unknown organization is a 404');

  // ---- the CSV
  psql(`update "GrowthCommission" set note='=HYPERLINK("x")' where id='${ids[2]}'`);
  const csv = await call(S, 'GET', `/api/admin/growth/report?org=${northwindOrg}&period=all&format=csv`);
  const lines = String(csv.j).trim().split('\r\n');
  log(csv.s === 200 && /text\/csv/.test(csv.h.get('content-type')) && /attachment/.test(csv.h.get('content-disposition')) && lines.length === 4, 'the ledger downloads as a CSV with a header and three rows');
  log(lines[0].startsWith('Paid on,Organization,Course,Trainee,Source,Payment (NGN),Rate (%),Commission (NGN),Status') && lines.slice(1).every((l) => l.includes('Northwind Academy')), 'with clear columns');
  log(String(csv.j).includes("'=HYPERLINK") && !String(csv.j).includes(',=HYPERLINK'), 'a note that starts with = is defused so a spreadsheet will not run it');
  const orgCsv = await call(ORG, 'GET', '/api/admin/growth/report?format=csv&period=all');
  log(orgCsv.s === 200 && !String(orgCsv.j).includes('rpt_'), 'an organization\'s own download has no payment references');

  // ---- the screen
  const br = await launch();
  const ctx = await br.newContext({ ...device('Desktop Chrome') });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  // two commissions back to owed, so there is something to settle on the screen
  psql(`update "GrowthCommission" set status='OWED', "settledAt"=null where id in ('${ids[1]}','${ids[2]}')`);
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 1100, height: 1500 });
  await pg.goto(`${B}/admin/growth/report`);
  await pg.getByTestId('growth-report').waitFor();
  await pg.getByTestId('period-all').click();
  await pg.getByTestId('org-select').selectOption(northwindOrg);
  await pg.getByTestId('funnel-started').waitFor();
  await pg.waitForTimeout(500);
  log((await pg.getByTestId('funnel-paid').innerText()).includes('Paid'), 'the report page shows the funnel');
  log((await pg.getByTestId('ledger-row').count()) === 3, 'and the three ledger rows');
  log(/Rates: Northwind Academy 10%/.test(await pg.getByTestId('rates').innerText()), 'and the organization\'s rate');
  await pg.getByTestId('growth-report').screenshot({ path: '/tmp/dev/growth6-report-desktop.png' });
  await pg.getByTestId('settle-note').waitFor();
  await pg.getByTestId('settle-note').fill('UI test ref');
  await pg.getByTestId('settle-org').click();
  await pg.waitForTimeout(900);
  log(psql(`select count(*) from "GrowthCommission" where status='OWED'`) === '0', 'on the screen, "settle everything this organization owes" settles the owed rows');
  const pm = await (await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' })).newPage();
  await pm.context().addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/training-org-login', 'org@dev.test'))]);
  await pm.goto(`${B}/admin/growth/report`);
  await pm.getByTestId('growth-report').waitFor();
  await pm.getByTestId('period-all').click();
  await pm.getByTestId('ledger').waitFor();
  log(await pm.getByTestId('settle-bar').count() === 0 && (await pm.getByTestId('org-select').count()) === 0, "on an organization's phone: no settle controls and no organization picker");
  log(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  await pm.screenshot({ path: '/tmp/dev/growth6-report-phone.png' });
  await br.close();

  // restore
  psql(`update "Course" set "createdById"='${origCreator}' where id='${orgCourse}'`);
  const [f0, k0] = origPrice.split('|');
  psql(`update "Course" set "isFree"=${f0}, "priceKobo"=${k0 === '' ? 'null' : k0} where id='${orgCourse}'`);
  psql(`delete from "Payment" where reference like 'rpt_%'`); psql(`delete from "ModuleCompletion" where id like 'rptmc%'`);
  for (const id of Object.values(T)) psql(`delete from "CourseEnrollment" where "traineeId"='${id}' and "courseId" in ('${orgCourse}','${ownCourse}')`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
