// Growth funnel, phase 2: saving a score (consent, phone/email checks), opting out, continuing into module 1 as a trainee
// (enrolled with module 1 open and the rest behind payment, Arena locked until payment), access kept after a switch-off,
// and the pass-then-pay card. Phone first.
const { B, log, launch, device, signedIn, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  const mod1 = psql(`select id from "Module" where "courseId"='${own}' order by "order" limit 1`);
  const orig = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${own}'`);
  for (const t of ['GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=4500000 where id='${own}'`);
  psql(`delete from "Module" where id='growth_m2'`);
  psql(`insert into "Module"(id,"courseId",title,"order","createdAt") values ('growth_m2','${own}','Growth module 2',1,now())`);
  psql(`update "ArenaConfig" set enabled=true,"gameEnabled"=true where "scopeType"='PLATFORM'`);
  const idOf = (e) => psql(`select id from "Trainee" where email='${e}'`);
  const t5 = idOf('t5@dev.test'), t6 = idOf('t6@dev.test');
  for (const x of [t5, t6]) { psql(`delete from "CourseEnrollment" where "traineeId"='${x}' and "courseId"='${own}'`); psql(`delete from "ModuleCompletion" where "traineeId"='${x}' and "moduleId"='${mod1}'`); }
  const S = await jar('/api/auth/login', 'super@dev.test');
  const T5 = await jar('/api/auth/trainee-login', 't5@dev.test');
  const T6 = await jar('/api/auth/trainee-login', 't6@dev.test');

  // a live campaign
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  const qs = (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions;
  for (const q of qs) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  const play = async () => {
    const st = await call(null, 'POST', `/api/public/growth/${slug}/play`, {});
    return st.j;
  };
  const finish = async (p) => { let state = p.state; while (state.status === 'question') state = (await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: p.token, choice: state.question.options[0].key })).j.state; return state; };

  // ---- saving a score
  const p1 = await play();
  let r = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, phone: '0803 123 4567', consent: true });
  log(r.s === 409, 'a score cannot be saved before the five questions are done (' + r.s + ')');
  await finish(p1);
  r = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, phone: '0803 123 4567', consent: false });
  log(r.s === 400 && /tick/i.test(r.j.error), 'saving needs the consent box ticked');
  r = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, phone: '12345', consent: true });
  log(r.s === 400 && /phone/i.test(r.j.error), 'a phone number that does not look right is refused');
  r = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, consent: true });
  log(r.s === 400, 'a save with no number or email is refused');
  r = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, phone: '0803 123 4567', consent: true });
  log(r.s === 200 && r.j.phone === '+2348031234567', 'a good number is saved as +234 (' + r.s + ')');
  log(psql(`select "consentText" like '%contacted%' and "consentAt" is not null from "GrowthLead" where "playId"=(select id from "GrowthGuestPlay" where token='${p1.token}')`) === 't', 'the consent text and time are stored with the lead');
  await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: p1.token, email: 'Ada@Example.com', phone: '0803 123 4567', consent: true });
  log(psql(`select count(*) from "GrowthLead"`) === '1' && psql(`select email from "GrowthLead"`) === 'ada@example.com', 'saving again updates the same lead and cleans the email');
  log((await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: 'x'.repeat(30), phone: '0803 123 4567', consent: true })).s === 404, 'an unknown play cannot save');

  // ---- opting out
  const ot = psql(`select "optOutToken" from "GrowthLead"`);
  log((await call(null, 'POST', '/api/public/growth/optout', { token: 'nope'.repeat(4) })).s === 404, 'a wrong opt-out link is refused');
  log((await call(null, 'POST', '/api/public/growth/optout', { token: ot })).s === 200 && psql(`select "optedOutAt" is not null from "GrowthLead"`) === 't', 'the opt-out link stops contact');
  log((await call(null, 'POST', '/api/public/growth/optout', { token: ot })).s === 200, 'and can be used twice');

  // ---- continuing into module 1
  log((await call(null, 'POST', '/api/growth/claim', { slug, token: p1.token })).s === 401, 'continuing without signing in asks to sign in');
  log((await call(S, 'POST', '/api/growth/claim', { slug, token: p1.token })).s === 403, 'a staff account cannot continue (module 1 is for trainees)');
  r = await call(T5, 'POST', '/api/growth/claim', { slug, token: p1.token });
  log(r.s === 200 && r.j.courseId === own, 'a trainee continues into the course (' + r.s + ')');
  log(psql(`select source from "CourseEnrollment" where "traineeId"='${t5}' and "courseId"='${own}'`) === 'PREVIEW' && psql(`select "unlockedAt" is null from "CourseEnrollment" where "traineeId"='${t5}' and "courseId"='${own}'`) === 't', 'they are enrolled as a preview, not unlocked');
  log(psql(`select modules from "GrowthGrant" where "traineeId"='${t5}'`) === '1', 'and given module 1');
  log(psql(`select "traineeId"='${t5}' from "GrowthGuestPlay" where token='${p1.token}'`) === 't' && psql(`select "traineeId"='${t5}' from "GrowthLead"`) === 't', 'their play and saved score now belong to their account');
  log((await call(T5, 'POST', '/api/growth/claim', { slug, token: p1.token })).s === 200 && psql(`select count(*) from "CourseEnrollment" where "traineeId"='${t5}' and "courseId"='${own}'`) === '1', 'continuing twice changes nothing');
  let c = await call(T5, 'GET', `/api/courses/${own}`);
  const mods = c.j.modules;
  log(c.s === 200 && c.j.isPreviewing && mods[0].unlocked && !mods[1].unlocked && mods[1].lockedReason === 'payment', 'module 1 is open and module 2 says pay to unlock');
  log(!mods[1].description && mods[1].lessons.every((l) => l.materials.length === 0), 'locked module content is not sent');
  const arena = await call(T5, 'POST', `/api/arena/courses/${own}/challenge`, { opponentId: t6 });
  log(arena.s === 403 && /enrolled/i.test(arena.j.error), 'the Arena is closed to them until they pay (' + arena.s + ')');
  log((await call(T5, 'GET', `/api/courses/${own}`)).j.freePreviewModuleCount === 1, 'the course reports one free module');

  // ---- keeping access after a switch-off
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: false });
  c = await call(T5, 'GET', `/api/courses/${own}`);
  log(c.s === 200 && c.j.modules[0].unlocked, 'switched off: the trainee who started keeps module 1');
  r = await call(T6, 'POST', '/api/growth/claim', { slug, token: null });
  log(r.s === 410, 'but a new trainee can no longer start (' + r.s + ')');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  r = await call(T6, 'POST', '/api/growth/claim', { slug, token: null });
  log(r.s === 200, 'switched on again: they can continue without a saved score');

  // ---- a free course just enrolls
  psql(`delete from "CourseEnrollment" where "traineeId"='${t6}' and "courseId"='${own}'`); psql(`delete from "GrowthGrant" where "traineeId"='${t6}'`);
  psql(`update "Course" set "isFree"=true, "priceKobo"=null where id='${own}'`);
  r = await call(T6, 'POST', '/api/growth/claim', { slug, token: null });
  log(r.s === 200 && psql(`select source from "CourseEnrollment" where "traineeId"='${t6}' and "courseId"='${own}'`) === 'FREE' && psql(`select "unlockedAt" is not null from "CourseEnrollment" where "traineeId"='${t6}' and "courseId"='${own}'`) === 't' && psql(`select count(*) from "GrowthGrant" where "traineeId"='${t6}'`) === '0', 'a free course enrolls them fully, with no grant needed');
  psql(`update "Course" set "isFree"=false, "priceKobo"=4500000 where id='${own}'`);

  // ---- the pages
  psql(`insert into "ModuleCompletion"(id,"moduleId","traineeId","completedAt") values ('gmc1','${mod1}','${t5}',now()) on conflict do nothing`);
  const br = await launch();
  const ctx = await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const page = await ctx.newPage();
  await page.goto(`${B}/play/${slug}?src=lagos-group`);
  await page.getByTestId('growth-start').click();
  for (let i = 0; i < 5; i++) { await page.getByTestId('growth-question').waitFor(); await page.getByTestId('growth-option').first().click(); await page.getByTestId('growth-next').click(); }
  await page.getByTestId('growth-score').waitFor();
  await page.getByTestId('growth-save-open').click();
  await page.getByTestId('growth-save-submit').click();
  log(/tick/i.test(await page.getByTestId('growth-save-form').innerText()), 'on a phone: saving without the tick shows why');
  await page.locator('#growth-phone').fill('0912 345 6789');
  await page.getByTestId('growth-consent').check();
  await page.getByTestId('growth-save-submit').click();
  await page.getByTestId('growth-saved').waitFor();
  log(true, 'on a phone: the score saves');
  log(psql(`select phone from "GrowthLead" where phone='+2349123456789'`) === '+2349123456789', 'the number reached the database in +234 form');
  await page.screenshot({ path: '/tmp/dev/growth2-result-phone.png' });
  await page.getByTestId('growth-continue').click();
  await page.getByTestId('continue-register').waitFor();
  const reg = await page.getByTestId('continue-register').getAttribute('href');
  const lg = await page.getByTestId('continue-login').getAttribute('href');
  log(reg.includes('/trainee/register?next=') && decodeURIComponent(reg).includes(`/play/${slug}/continue`) && decodeURIComponent(lg).includes(`/play/${slug}/continue`), 'not signed in: Start Module 1 offers sign-up and sign-in, both coming back');
  await page.screenshot({ path: '/tmp/dev/growth2-continue-phone.png' });
  log(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');

  const tctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't5@dev.test');
  const tp = await tctx.newPage();
  await tp.goto(`${B}/trainee/courses/${own}`);
  await tp.getByTestId('pay-after-pass').waitFor();
  log(/Pay to keep going/.test(await tp.getByTestId('pay-after-pass').innerText()), 'after finishing module 1 the trainee sees the pay card');
  log(await tp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the pay card fits the phone');
  await tp.screenshot({ path: '/tmp/dev/growth2-pay-phone.png', fullPage: false });
  const op = await (await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't6@dev.test')).newPage();
  await op.goto(`${B}/growth/optout/${ot}`);
  await op.getByTestId('optout').click();
  log(/won.t hear from us again/i.test(await op.locator('main').innerText()), 'the opt-out page confirms');
  await br.close();

  // restore
  psql(`delete from "ModuleCompletion" where id='gmc1'`);
  psql(`delete from "Module" where id='growth_m2'`);
  const [f, k] = orig.split('|');
  psql(`update "Course" set "isFree"=${f}, "priceKobo"=${k === '' ? 'null' : k} where id='${own}'`);
  for (const x of [t5, t6]) psql(`delete from "CourseEnrollment" where "traineeId"='${x}' and "courseId"='${own}'`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
