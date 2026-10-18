// Growth funnel: scholarship seats. On AAICBI's own course: seats stay shut until enough people have played, then go first come first
// served to people who pass module 1, run out, can be taken back (which frees the seat for the next person), and are shut by the switches.
// On an organization's course they also need the organization's agreement and its own scholarship switch.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const orgCourse = psql(`select id from "Course" where id like 'cmv9kyf0b%'`);
  const ownCourse = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  const northwindStaff = 'cmuznki2r0002p61xabzm5kd5', northwindOrg = 'cmuznki2x0004p61x1xbxqwex';
  const origCreator = psql(`select "createdById" from "Course" where id='${orgCourse}'`);
  const origPrice = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${orgCourse}'`);
  const ownPrice = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${ownCourse}'`);
  for (const t of ['GrowthScholarship', 'GrowthCommission', 'GrowthMessage', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set "createdById"='${northwindStaff}', published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=4500000 where id='${orgCourse}'`);
  psql(`update "Course" set published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=3000000 where id='${ownCourse}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const T = {}; for (const n of [5, 6, 7, 8]) T[n] = psql(`select id from "Trainee" where email='t${n}@dev.test'`);
  const reset = () => { for (const id of Object.values(T)) { psql(`delete from "CourseEnrollment" where "traineeId"='${id}' and "courseId" in ('${orgCourse}','${ownCourse}')`); psql(`delete from "ModuleCompletion" where "traineeId"='${id}' and "moduleId" in (select id from "Module" where "courseId" in ('${orgCourse}','${ownCourse}'))`); } };
  reset();
  // A preview needs a module behind it, so each course gets a temporary second module.
  for (const c of [ownCourse, orgCourse]) psql(`insert into "Module"(id,"courseId",title,"order") values ('schmod_${c.slice(0,6)}','${c}','Second module',99)`);
  const modOf = (c) => psql(`select id from "Module" where "courseId"='${c}' order by "order", "createdAt" limit 1`);
  const mOwn = modOf(ownCourse), mOrg = modOf(orgCourse);

  const live = async (courseId) => {
    await call(S, 'POST', `/api/admin/courses/${courseId}/growth`, { action: 'propose' });
    for (const q of (await call(S, 'GET', `/api/admin/courses/${courseId}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${courseId}/growth`, { action: 'approve', questionId: q.questionId });
    await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId, enabled: true });
    return psql(`select slug from "GrowthCampaign" where "courseId"='${courseId}'`);
  };
  for (const scope of ['PLATFORM', 'OWN', 'ORGS']) await call(S, 'POST', '/api/admin/growth', { action: 'global', scope, enabled: true });
  const slug = await live(ownCourse);
  const slugOrg = await live(orgCourse);
  // organization switched on, with its agreement, but scholarships left off
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: true, agree: true });

  const play = async (sl) => { const st = (await call(null, 'POST', `/api/public/growth/${sl}/play`, {})).j; let s = st.state; while (s.status === 'question') s = (await call(null, 'POST', `/api/public/growth/${sl}/answer`, { token: st.token, choice: s.question.options[0].key })).j.state; return st.token; };
  const cj = {}; const cookieOf = async (n) => (cj[n] ??= await jar('/api/auth/trainee-login', `t${n}@dev.test`));
  const claim = async (n, sl, token) => call(await cookieOf(n), 'POST', '/api/growth/claim', { slug: sl, token });
  const pass = (n, mod) => psql(`insert into "ModuleCompletion"(id,"moduleId","traineeId","completedAt") values ('schmc${n}${mod.slice(-4)}','${mod}','${T[n]}',now()) on conflict do nothing`);
  const course = async (n, id) => (await call(await cookieOf(n), 'GET', `/api/courses/${id}`)).j;
  const heldCount = () => Number(psql(`select count(*) from "GrowthScholarship" where status='AWARDED'`));

  // ---- the controls: Super Admin only, and sensible limits
  log((await call(await cookieOf(5), 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: 2, minPlays: 3 })).s === 403, 'a trainee cannot set seats');
  log((await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: -1, minPlays: 0 })).s === 400, 'seats below zero are refused');
  log((await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: '2.5', minPlays: 0 })).s === 400, 'part seats are refused');
  const set = await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: 2, minPlays: 3 });
  log(set.s === 200, 'Super Admin sets 2 seats that open after 3 players');
  const card = () => call(S, 'GET', '/api/admin/growth').then((r) => r.j.ownCourses.find((c) => c.id === ownCourse).scholarship);
  let sch = await card();
  log(!sch.open && /Scholarship seats are off/.test(sch.reason), 'seats do not open while the AAICBI scholarship switch is off');

  // ---- two people start module 1 and pass it while everything is closed: no seat
  const tok5 = await play(slug); await claim(5, slug, tok5);
  const tok6 = await play(slug); await claim(6, slug, tok6);
  pass(5, mOwn);
  let c5 = await course(5, ownCourse);
  log(!c5.scholarship && c5.isPreviewing && heldCount() === 0, 'passing module 1 with the switch off gives no seat; they are asked to pay');

  // ---- switch on, but too few players have finished
  await call(S, 'POST', '/api/admin/growth', { action: 'ownScholarships', enabled: true });
  sch = await card();
  log(!sch.open && /Opens after 3/.test(sch.reason) && sch.finishedPlays === 2, 'with the switch on it waits for 3 finished plays (2 so far)');
  c5 = await course(5, ownCourse);
  log(!c5.scholarship && heldCount() === 0, 'so the person who passed still gets no seat yet');

  // ---- the third player finishes: the next time the course loads, the earlier passer gets the seat
  await play(slug);
  sch = await card();
  log(sch.open && sch.left === 2, 'the pool opens at the third finished play');
  c5 = await course(5, ownCourse);
  log(!!c5.scholarship && !c5.isPreviewing && c5.enrollmentSource === 'ADMIN_GRANTED', 'loading the course gives the first passer a seat, with the whole course open');
  log(psql(`select "unlockedAt" is not null from "CourseEnrollment" where "traineeId"='${T[5]}' and "courseId"='${ownCourse}'`) === 't', 'and the enrollment is unlocked, so the Arena and everything else follow');
  log(c5.modules.every((m) => m.unlocked || m.lockedReason !== 'payment'), 'no module is behind payment for them');
  const again = await course(5, ownCourse);
  log(heldCount() === 1 && !!again.scholarship, 'loading again does not give a second seat');

  // ---- second seat, then it runs out
  pass(6, mOwn);
  const c6 = await course(6, ownCourse);
  log(!!c6.scholarship && heldCount() === 2, 'the second passer takes the last seat');
  const tok7 = await play(slug); await claim(7, slug, tok7); pass(7, mOwn);
  let c7 = await course(7, ownCourse);
  log(!c7.scholarship && c7.isPreviewing && heldCount() === 2, 'a third passer gets no seat and is asked to pay');
  sch = await card();
  log(!sch.open && /All seats are taken/.test(sch.reason) && sch.held === 2 && sch.recipients.length === 2, 'the screen says all seats are taken and lists the two holders');
  log((await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: 1, minPlays: 3 })).s === 409, 'seats cannot be set below the number already given');

  // ---- taking one back frees it for the next person; the one taken from keeps module 1 but must pay
  const id5 = sch.recipients.find((r) => r.email === 't5@dev.test').id;
  const rev = await call(S, 'POST', '/api/admin/growth', { action: 'revokeSeat', scholarshipId: id5 });
  log(rev.s === 200 && heldCount() === 1, 'Super Admin takes one seat back');
  c5 = await course(5, ownCourse);
  log(!c5.scholarship && c5.isPreviewing && c5.modules[0].unlocked && c5.modules[1].lockedReason === 'payment', 'that person goes back to the free preview: module 1 open, the rest behind payment');
  log(psql(`select count(*) from "GrowthScholarship" where "traineeId"='${T[5]}'`) === '1', 'and they are not given the seat again');
  c7 = await course(7, ownCourse);
  log(!!c7.scholarship && heldCount() === 2, 'the freed seat goes to the next person who passed');

  // ---- switching scholarships off: seats already given stay, nobody new gets one
  await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: ownCourse, seats: 5, minPlays: 0 });
  await call(S, 'POST', '/api/admin/growth', { action: 'ownScholarships', enabled: false });
  const tok8 = await play(slug); await claim(8, slug, tok8); pass(8, mOwn);
  const c8 = await course(8, ownCourse);
  const c6b = await course(6, ownCourse);
  log(!c8.scholarship && heldCount() === 2 && !!c6b.scholarship, 'switched off: no new seat, and the people who already hold one keep it');
  await call(S, 'POST', '/api/admin/growth', { action: 'ownScholarships', enabled: true });

  // ---- not passing means no seat
  const tokNoPass = await play(slug);
  psql(`delete from "ModuleCompletion" where "traineeId"='${T[8]}'`);
  const c8b = await course(8, ownCourse);
  log(!c8b.scholarship && heldCount() === 2, 'a person who has not passed module 1 gets no seat even with seats free');
  void tokNoPass;

  // ---- an organization's course needs the agreement (already given) and its own scholarship switch
  await call(S, 'POST', '/api/admin/growth', { action: 'seats', courseId: orgCourse, seats: 3, minPlays: 0 });
  const oTok = await play(slugOrg); await claim(5, slugOrg, oTok); pass(5, mOrg);
  let o5 = await course(5, orgCourse);
  log(!o5.scholarship && o5.isPreviewing, "organization course: no seat while the organization's scholarship switch is off");
  const orgCard = (await call(S, 'GET', '/api/admin/growth')).j.organizations.find((o) => o.id === northwindOrg).courses.find((c) => c.id === orgCourse).scholarship;
  log(/off for this organization/.test(orgCard.reason), 'and the screen says why');
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, scholarshipEnabled: true });
  o5 = await course(5, orgCourse);
  log(!!o5.scholarship, 'organization course: once its switch is on, the passer gets a seat');
  // agreement is needed to turn it on
  psql(`update "GrowthSetting" set "agreementAt"=null, "scholarshipEnabled"=false where "scopeType"='ORGANIZATION'`);
  const noAgree = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, scholarshipEnabled: true });
  log(noAgree.s === 409, "scholarship seats cannot be turned on for an organization that has not agreed");

  // ---- the report counts them
  const rep = await call(S, 'GET', '/api/admin/growth/report?period=all');
  log(rep.j.extras && rep.j.extras.scholarships === heldCount(), 'the campaign report counts the seats given');

  // ---- screens
  const br = await launch();
  const ctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' });
  const addC = async (login, email) => ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor(login, email))]);
  await addC('/api/auth/trainee-login', 't6@dev.test');
  const pg = await ctx.newPage();
  await pg.goto(`${B}/trainee/courses/${ownCourse}`);
  await pg.getByTestId('scholarship-card').waitFor();
  log((await pg.getByTestId('scholarship-card').innerText()).includes('scholarship seat'), 'the trainee sees the scholarship card on their phone');
  log((await pg.getByTestId('pay-after-pass').count()) === 0, 'and no payment prompt');
  log(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  await pg.screenshot({ path: '/tmp/dev/growth7-trainee-phone.png' });
  const dctx = await br.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await dctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const ad = await dctx.newPage();
  await ad.goto(`${B}/admin/growth`);
  await ad.getByTestId(`seats-${ownCourse}`).waitFor();
  const panel = await ad.getByTestId(`seats-${ownCourse}`).innerText();
  log(/2 of 5 seats given/.test(panel), 'Super Admin screen shows how many seats are given');
  await ad.getByTestId(`seats-${ownCourse}`).screenshot({ path: '/tmp/dev/growth7-admin.png' });
  ad.on('dialog', (d) => d.accept());
  await ad.getByRole('button', { name: 'Take back' }).first().click();
  await ad.waitForTimeout(900);
  log(Number(psql(`select count(*) from "GrowthScholarship" where status='AWARDED' and "courseId"='${ownCourse}'`)) === 1, 'Take back works from the screen');
  await br.close();

  // restore
  psql(`update "Course" set "createdById"='${origCreator}' where id='${orgCourse}'`);
  const [f0, k0] = origPrice.split('|'); psql(`update "Course" set "isFree"=${f0}, "priceKobo"=${k0 === '' ? 'null' : k0} where id='${orgCourse}'`);
  const [f1, k1] = ownPrice.split('|'); psql(`update "Course" set "isFree"=${f1}, "priceKobo"=${k1 === '' ? 'null' : k1} where id='${ownCourse}'`);
  psql(`delete from "ModuleCompletion" where id like 'schmc%'`); reset();
  psql(`delete from "Module" where id like 'schmod_%'`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
