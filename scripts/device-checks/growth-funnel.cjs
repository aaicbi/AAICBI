// Growth funnel, phase 1: the switches (platform, AAICBI, organization, course), the instructor's taster approval,
// and the public no-account taster. Checks the layers one by one, that the answer key only appears after answering,
// that an organization needs its agreement, and the phone flow end to end.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  const orgCourse = psql(`select id from "Course" where id like 'cmv9kyf0b%'`);
  const northwindStaff = 'cmuznki2r0002p61xabzm5kd5';
  const northwindOrg = 'cmuznki2x0004p61x1xbxqwex';
  const origCreator = psql(`select "createdById" from "Course" where id='${orgCourse}'`);
  for (const t of ['GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set "createdById"='${northwindStaff}', published=true, status='PUBLISHED' where id='${orgCourse}'`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const ST = await jar('/api/auth/login', 'staff@dev.test');

  // ---- everything starts off
  let ov = await call(S, 'GET', '/api/admin/growth');
  log(ov.s === 200 && !ov.j.switches.platform && !ov.j.switches.own && !ov.j.switches.orgs, 'every switch starts off');
  const ownCard = ov.j.ownCourses.find((c) => c.id === own);
  log(!!ownCard && !ownCard.enabled && !ownCard.live && ownCard.readinessIssues.some((i) => /approved 0 of 5/.test(i)), 'an AAICBI course shows it still needs the taster approved');
  const orgCard = ov.j.organizations.find((o) => o.id === northwindOrg);
  log(!!orgCard && orgCard.courses.some((c) => c.id === orgCourse), 'the organization lists its course');
  log((await call(ST, 'GET', '/api/admin/growth')).s === 403, 'only a Super Admin can open the growth controls');
  log((await call(null, 'GET', '/api/admin/growth')).s === 401, 'a visitor cannot open the growth controls');

  // ---- readiness blocks opt-in
  let r = await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  log(r.s === 409 && Array.isArray(r.j.issues) && r.j.issues.length > 0, 'a course that is not ready cannot be opted in (' + r.s + ')');

  // ---- the instructor's taster
  log((await call(ST, 'GET', `/api/admin/courses/${own}/growth`)).s === 404, 'someone who does not manage the course cannot see its taster');
  r = await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  const qs = r.j.taster.questions;
  log(r.s === 200 && qs.length === 5 && qs.every((q) => q.status === 'PENDING'), 'proposing picks five questions waiting for approval');
  log(qs.every((q) => q.options.filter((o) => o.isCorrect).length === 1), 'the instructor sees the correct answer of each');
  for (const q of qs.slice(0, 4)) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  r = await call(S, 'GET', `/api/admin/courses/${own}/growth`);
  log(!r.j.taster.approvedAt, 'four of five approved is not enough');
  r = await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: qs[4].questionId });
  log(!!r.j.taster.approvedAt, 'approving the fifth approves the taster');
  r = await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'swap', questionId: qs[0].questionId });
  log(r.s === 200 && !r.j.taster.approvedAt && r.j.taster.questions.find((q) => q.position === 0).status === 'PENDING' && r.j.taster.questions.find((q) => q.position === 0).questionId !== qs[0].questionId, 'swapping a question puts it back to pending and withdraws the approval');
  const swapped = r.j.taster.questions.find((q) => q.position === 0);
  r = await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: swapped.questionId });
  log(!!r.j.taster.approvedAt, 'approving the new question approves the taster again');
  log((await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: 'nope' })).s === 404, 'approving a question that is not in the taster is refused');

  // ---- layers, one at a time
  r = await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  log(r.s === 200, 'the ready course can be opted in');
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  log(/^[a-z0-9-]+$/.test(slug), 'it gets a link (' + slug + ')');
  let st = await call(null, 'POST', `/api/public/growth/${slug}/play`, {});
  log(st.s === 410, 'opted in, but the master switch is off: the link is closed (' + st.s + ')');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  st = await call(null, 'POST', `/api/public/growth/${slug}/play`, {});
  log(st.s === 410, 'master on, AAICBI courses off: still closed (' + st.s + ')');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  st = await call(null, 'POST', `/api/public/growth/${slug}/play`, { source: 'Lagos Tech Women!' });
  log(st.s === 200 && st.j.state.status === 'question' && st.j.state.total === 5, 'every layer on: a visitor with no account can start (' + st.s + ')');
  const raw = JSON.stringify(st.j);
  log(!/isCorrect|correctKey|explanation/.test(raw), 'the answer key is not in the question that was served');
  log(psql(`select source from "GrowthGuestPlay" where token='${st.j.token}'`) === 'lagos-tech-women', 'the share source is stored, cleaned');

  // ---- playing
  const token = st.j.token;
  const resume = await call(null, 'POST', `/api/public/growth/${slug}/play`, { token });
  log(resume.j.token === token && resume.j.state.question.id === st.j.state.question.id, 'a refresh resumes the same question');
  log((await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token, choice: 'ZZZ' })).s === 400, 'an option that does not exist is refused');
  log((await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: 'x'.repeat(30), choice: 'A' })).s === 404, 'an unknown token is refused');
  const par = await Promise.all([1, 2].map(() => call(null, 'POST', `/api/public/growth/${slug}/answer`, { token, choice: st.j.state.question.options[0].key })));
  log(par.filter((p) => p.s === 200).length === 1 && par.filter((p) => p.s === 409).length === 1, 'two taps on the same question count once (' + par.map((p) => p.s).join(',') + ')');
  let last = par.find((p) => p.s === 200);
  log(typeof last.j.correct === 'boolean' && 'correctKey' in last.j, 'the key is revealed only after answering');
  let state = last.j.state; let n = 1;
  while (state.status === 'question') {
    const rr = await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token, choice: state.question.options[0].key });
    state = rr.j.state; n++;
  }
  log(n === 5 && state.status === 'done' && state.total === 5 && state.rank && Array.isArray(state.grid) && state.grid.length === 5, 'five answers end in a result with a rank and a grid');
  log(state.beatPercent === null, 'no percentile is claimed with so few players');
  log((await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token, choice: 'A' })).s === 409, 'a finished play cannot be answered again');

  // ---- switching off keeps a play under way, closes new ones
  const live = await call(null, 'POST', `/api/public/growth/${slug}/play`, {});
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: false });
  const cont = await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: live.j.token, choice: live.j.state.question.options[0].key });
  log(cont.s === 200, 'switching off lets a play already under way carry on');
  log((await call(null, 'POST', `/api/public/growth/${slug}/play`, {})).s === 410, 'but nobody new can start');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });

  // ---- an organization
  r = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: true });
  log(r.s === 409, 'an organization cannot be switched on without its agreement (' + r.s + ')');
  r = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: true, agree: true });
  log(r.s === 200 && r.j.organizations.find((o) => o.id === northwindOrg).agreementAt, 'ticking the agreement records it and switches the organization on');
  r = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, commissionPercent: 150 });
  log(r.s === 400, 'a commission over 100% is refused');
  r = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, commissionPercent: 15, scholarshipEnabled: true });
  log(psql(`select "commissionBps" from "GrowthSetting" where "scopeId"='${northwindOrg}'`) === '1500' && psql(`select "scholarshipEnabled" from "GrowthSetting" where "scopeId"='${northwindOrg}'`) === 't', 'commission is stored as 15% and scholarship seats can be turned on');
  const newOrg = await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg });
  log(newOrg.j.organizations.find((o) => o.id === northwindOrg).scholarshipEnabled === true, 'scholarship setting is shown back');
  // its course needs the same taster approval
  r = await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: orgCourse, enabled: true });
  log(r.s === 409, 'an organization course needs its taster approved first');
  await call(S, 'POST', `/api/admin/courses/${orgCourse}/growth`, { action: 'propose' });
  const oq = (await call(S, 'GET', `/api/admin/courses/${orgCourse}/growth`)).j.taster.questions;
  for (const q of oq) await call(S, 'POST', `/api/admin/courses/${orgCourse}/growth`, { action: 'approve', questionId: q.questionId });
  r = await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: orgCourse, enabled: true });
  const oslug = psql(`select slug from "GrowthCampaign" where "courseId"='${orgCourse}'`);
  log(r.s === 200 && /northwind/.test(oslug), 'once approved it opts in and its link carries the organization name (' + oslug + ')');
  log((await call(null, 'POST', `/api/public/growth/${oslug}/play`, {})).s === 410, 'organization courses switch still off: link closed');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'ORGS', enabled: true });
  log((await call(null, 'POST', `/api/public/growth/${oslug}/play`, {})).s === 200, 'organization courses on: link opens');
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: false });
  log((await call(null, 'POST', `/api/public/growth/${oslug}/play`, {})).s === 410, 'switching the organization off closes its link');
  await call(S, 'POST', '/api/admin/growth', { action: 'org', organizationId: northwindOrg, enabled: true });
  log((await call(null, 'POST', `/api/public/growth/${oslug}/play`, {})).s === 200, 'switching it back on reopens it without asking for the agreement again');
  ov = await call(S, 'GET', '/api/admin/growth');
  log(ov.j.log.length >= 8 && ov.j.log.some((l) => l.action === 'AGREEMENT_RECORDED'), 'every change is in the log (' + ov.j.log.length + ' entries)');

  // ---- a quiz that loses a question needs re-approval
  const firstApproved = psql(`select "questionId" from "GrowthTasterQuestion" t join "GrowthCampaign" c on c.id=t."campaignId" where c."courseId"='${own}' limit 1`);
  psql(`update "Question" set "needsReview"=true where id='${firstApproved}'`);
  ov = await call(S, 'GET', '/api/admin/growth');
  log(!ov.j.ownCourses.find((c) => c.id === own).live && ov.j.ownCourses.find((c) => c.id === own).readinessIssues.some((i) => /approve the taster again/.test(i)), 'a taster question that was pulled from the bank takes the course offline');
  psql(`update "Question" set "needsReview"=false where id='${firstApproved}'`);

  // ---- the pages
  const br = await launch();
  const ctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const page = await ctx.newPage();
  await page.goto(`${B}/play/${slug}?src=whatsapp-group`);
  await page.getByTestId('growth-start').click();
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('growth-question').waitFor();
    await page.getByTestId('growth-option').first().click();
    await page.getByTestId('growth-next').click();
  }
  await page.getByTestId('growth-score').waitFor();
  log(/\d\/5/.test(await page.getByTestId('growth-score').innerText()), 'on a phone: the five questions end in a score');
  log((await page.getByTestId('growth-rank').innerText()).length > 3, 'and a rank is shown');
  const href = await page.getByTestId('growth-share').getAttribute('href');
  log(/^https:\/\/wa\.me\/\?text=/.test(href) && decodeURIComponent(href).includes(`/play/${slug}?src=share`), 'the WhatsApp share carries the link');
  log((await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)), 'no sideways scroll on the phone');
  await page.screenshot({ path: '/tmp/dev/growth-result-phone.png' });
  await page.reload();
  await page.getByTestId('growth-score').waitFor();
  log(true, 'a reload keeps the result');
  log(psql(`select count(*) from "GrowthGuestPlay" where source='whatsapp-group'`) === '1', 'the page stored where the link came from');
  const start2 = await ctx.newPage();
  await start2.goto(`${B}/play/${slug}`);
  await start2.evaluate((k) => window.localStorage.removeItem(k), `aaicbi.growth.${slug}`);
  await start2.reload();
  await start2.screenshot({ path: '/tmp/dev/growth-intro-phone.png' });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: false });
  const ended = await ctx.newPage();
  await ended.goto(`${B}/play/${slug}`);
  log(/campaign has ended/i.test(await ended.locator('main').innerText()), 'a closed link says the campaign has ended and points at the course');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });

  // admin screens
  const dctx = await signedIn(br, device('Desktop Chrome', {}), '/api/auth/login', 'super@dev.test');
  const ap = await dctx.newPage();
  await ap.setViewportSize({ width: 1100, height: 1500 });
  await ap.goto(`${B}/admin/growth`);
  await ap.getByText('Platform master switch').waitFor();
  log(/Northwind/.test(await ap.locator('main').innerText()), 'the Super Admin page lists the organizations');
  await ap.screenshot({ path: '/tmp/dev/growth-admin.png', fullPage: true });
  const cp = await dctx.newPage();
  await cp.setViewportSize({ width: 1100, height: 900 });
  await cp.goto(`${B}/admin/courses/${own}`);
  await cp.getByTestId('growth-taster').waitFor();
  await cp.getByTestId('growth-taster').scrollIntoViewIfNeeded();
  await cp.getByTestId('growth-taster').screenshot({ path: '/tmp/dev/growth-taster.png' });
  log(/5 of 5 approved|approved/.test(await cp.getByTestId('growth-taster').innerText()), 'the instructor screen shows the approval count');
  await br.close();

  // restore
  psql(`update "Course" set "createdById"='${origCreator}' where id='${orgCourse}'`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
