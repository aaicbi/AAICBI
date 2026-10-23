// CRM step 1: course registration end to end on the private test database. Public form API (validation, bot checks, agreement version, signature,
// duplicates, capacity, deadlines), one CRM per owner, consent and timeline records, the taster link, the confirmation page, staff and organization
// access (scoped, switched by a Super Admin), the agreement versions, opt-out, CSV, and the screens on a phone.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers, t }; };
const ok = (c, m) => log(!!c, m);
const stamp = Date.now();
const mail = (n) => `crm.test+${stamp}${n}@example.com`;

(async () => {
  clearThrottle();
  const northwindOrg = 'cmuznki2x0004p61x1xbxqwex';
  const orgCourse = 'cmuznki4u000ip61x2v21ycrq'; // an organization's course
  const own = psql(`select c.id from "Course" c join "User" u on u.id=c."createdById" where not exists (select 1 from "TrainingOrganization" o where o."staffUserId"=u.id) and c."isDemo"=false order by c."createdAt" limit 3`).split('\n').filter(Boolean);
  const [own1, own2, own3] = own;
  const snap = {};
  for (const id of [orgCourse, ...own]) snap[id] = psql(`select status||'|'||published||'|'||"registrationEnabled"||'|'||coalesce("startDate"::text,'')||'|'||coalesce("registrationDeadline"::text,'')||'|'||coalesce(capacity::text,'') from "Course" where id='${id}'`);
  const cleanup = () => {
    psql(`delete from "CrmContact" where email like 'crm.test+%'`);
    psql(`delete from "GrowthLead" where email like 'crm.test+%'`);
    psql(`delete from "GrowthGuestPlay" where token like 'crmtest-%'`);
    psql(`delete from "GrowthCampaign" where slug like 'crmtest-%'`);
    psql(`delete from "RegistrationAgreement" where version > 1`);
    psql(`update "RegistrationAgreement" set active=true where version=1`);
    psql(`update "TrainingOrganization" set "crmEnabled"=false where id='${northwindOrg}'`);
    for (const id of Object.keys(snap)) { const [st, pub, reg, sd, dl, cap] = snap[id].split('|'); psql(`update "Course" set status='${st}', published=${pub}, "registrationEnabled"=${reg}, "startDate"=${sd ? `'${sd}'` : 'null'}, "registrationDeadline"=${dl ? `'${dl}'` : 'null'}, capacity=${cap || 'null'} where id='${id}'`); }
  };
  cleanup();
  const future = (d) => new Date(Date.now() + d * 86400000).toISOString();
  // own1: a coming-soon course (start date set, deadline ahead); own2: switched on by staff, no dates; own3: not open at all; orgCourse: switched on.
  psql(`update "Course" set status='PUBLISHED', published=true, "startDate"='${future(20)}', "registrationDeadline"='${future(10)}', "registrationEnabled"=false, capacity=null where id='${own1}'`);
  psql(`update "Course" set status='PUBLISHED', published=true, "startDate"=null, "registrationDeadline"=null, "registrationEnabled"=true, capacity=null where id='${own2}'`);
  psql(`update "Course" set status='PUBLISHED', published=true, "startDate"=null, "registrationDeadline"=null, "registrationEnabled"=false, capacity=null where id='${own3}'`);
  psql(`update "Course" set status='PUBLISHED', published=true, "startDate"=null, "registrationDeadline"=null, "registrationEnabled"=true, capacity=null where id='${orgCourse}'`);

  const S = await jar('/api/auth/login', 'super@dev.test');
  const ORG = await jar('/api/auth/training-org-login', 'org@dev.test');
  let ver = Number(psql(`select version from "RegistrationAgreement" where active`));
  const good = (n, extra = {}) => ({ firstName: 'Amaka', lastName: 'Okon', email: mail(n), phone: '0801 234 5678', country: 'Nigeria', state: 'Akwa Ibom', motivation: 'To automate reports', agreementVersion: extra.agreementVersion ?? ver, agreementAccepted: true, signedName: 'Amaka Okon', followUp: true, newsletter: false, website: '', openedForMs: 20000, ...extra });
  const reg = (courseId, body, qs = '') => call(null, 'POST', `/api/public/register/${courseId}${qs}`, body);

  // ---- the public page
  const p1 = await call(null, 'GET', `/register/${own1}`);
  ok(p1.s === 200 && /What you will learn|Your details/.test(p1.t) && /Learner Agreement/.test(p1.t), 'registration page shows the course, the form and the agreement');
  const p3 = await call(null, 'GET', `/register/${own3}`);
  ok(p3.s === 200 && /Registration is not open for this course/.test(p3.t) && !/register-form/.test(p3.t), 'a course that is not open shows why, with no form');
  psql(`update "Course" set status='DRAFT' where id='${own3}'`);
  ok(/NEXT_NOT_FOUND|could not be found|404/i.test((await call(null, 'GET', `/register/${own3}`)).t), 'a draft course has no registration page');
  psql(`update "Course" set status='PUBLISHED' where id='${own3}'`);

  // ---- validation and protection
  clearThrottle();
  ok((await reg(own1, good('a', { followUp: false }))).s === 400, 'no follow-up tick: refused');
  ok((await reg(own1, good('a', { agreementAccepted: false }))).s === 400, 'no agreement tick: refused');
  ok((await reg(own1, good('a', { signedName: 'Someone Else' }))).s === 400, 'a signature that does not match the name: refused');
  ok((await reg(own1, good('a', { agreementVersion: ver + 9 }))).s === 409, 'an out-of-date agreement version: refused');
  ok((await reg(own1, good('a', { website: 'http://spam' }))).s === 400, 'a filled hidden field (bot): refused');
  ok((await reg(own1, good('a', { openedForMs: 500 }))).s === 400, 'a form opened for half a second (bot): refused');
  ok((await reg(own1, good('a', { email: 'nope' }))).s === 400, 'a bad email: refused');
  ok((await reg(own1, good('a', { phone: 'abc' }))).s === 400, 'a bad phone number: refused');
  ok((await reg(own1, good('a', { firstName: '<script>x' }))).s === 400, 'markup in a name: refused');
  ok((await reg(own3, good('a'))).s === 409, 'a course that is not open: refused');
  ok(psql(`select count(*) from "CrmContact" where email like 'crm.test+%'`) === '0', 'nothing was saved by any refused attempt');

  // ---- a good registration
  clearThrottle();
  const r1 = await reg(own1, good('a', { src: 'WhatsApp Group!' }));
  ok(r1.s === 201 && /^REG-\d{4}-[A-Z2-9]{6}$/.test(r1.j.reference) && r1.j.duplicate === false, 'registered: a reference is returned');
  const ref1 = r1.j.reference;
  const row = psql(`select r.source||'|'||coalesce(r."sourceTag",'')||'|'||r.stage||'|'||r."followUpEmail"||'|'||r."followUpWhatsapp"||'|'||r.newsletter||'|'||length(r."signIpHash")||'|'||c."ownerKey"||'|'||c.phone from "CourseRegistration" r join "CrmContact" c on c.id=r."contactId" where r.reference='${ref1}'`);
  ok(row === 'LINK|whatsappgroup|REGISTERED|true|true|false|32|PLATFORM|+2348012345678', `saved as expected: ${row}`);
  ok(psql(`select count(*) from "CrmConsent" c join "CrmContact" k on k.id=c."contactId" where k.email='${mail('a')}'`) === '2', 'two consent records (follow-up, newsletter), kept separate');
  ok(psql(`select count(*) from "CrmTask" t join "CrmContact" k on k.id=t."contactId" where k.email='${mail('a')}' and t."doneAt" is null`) === '1', 'a follow-up task was created');
  const kinds = psql(`select string_agg(distinct a.kind, ',' order by a.kind) from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('a')}'`);
  ok(/AGREEMENT_SIGNED/.test(kinds) && /CONSENT/.test(kinds) && /REGISTERED/.test(kinds) && /EMAIL_SENT/.test(kinds), `timeline has the registration, agreement, consent and the email attempt: ${kinds}`);
  ok(/could not be sent|accepted/.test(psql(`select a.summary from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('a')}' and a.kind='EMAIL_SENT'`)), 'the email is recorded as accepted or failed, never as delivered');

  // ---- a repeat, a second course, a second owner
  const r1b = await reg(own1, good('a'));
  ok(r1b.s === 200 && r1b.j.reference === ref1 && r1b.j.duplicate === true, 'registering twice for the same course returns the same reference');
  ok(psql(`select count(*) from "CourseRegistration" r join "CrmContact" k on k.id=r."contactId" where k.email='${mail('a')}'`) === '1', 'no duplicate registration was saved');
  const r2 = await reg(own2, good('a'));
  ok(r2.s === 201 && psql(`select count(*) from "CrmContact" where email='${mail('a')}' and "ownerKey"='PLATFORM'`) === '1', 'the same person on a second course stays one contact');
  const r3 = await reg(orgCourse, good('a'));
  ok(r3.s === 201 && psql(`select count(*) from "CrmContact" where email='${mail('a')}'`) === '2' && psql(`select "ownerKey" from "CrmContact" where email='${mail('a')}' and "ownerKey"<>'PLATFORM'`) === northwindOrg, "an organization's course makes a separate contact in that organization's own CRM");

  // ---- the taster link
  clearThrottle();
  psql(`insert into "GrowthCampaign" (id, "courseId", slug, enabled, "createdAt", "updatedAt") values ('crmtest-camp', '${own1}', 'crmtest-slug', false, now(), now()) on conflict do nothing`);
  psql(`insert into "GrowthGuestPlay" (id, token, "campaignId", "questionIds", "startedAt") values ('crmtest-play', 'crmtest-token', 'crmtest-camp', '[]', now())`);
  psql(`insert into "GrowthLead" (id, "playId", "campaignId", phone, email, "consentAt", "consentText", "optOutToken", "createdAt") values ('crmtest-lead', 'crmtest-play', 'crmtest-camp', '+2348099999999', 'crm.test+${stamp}lead@example.com', now(), 'x', 'crmtest-opt', now())`);
  const pre = await call(null, 'GET', `/register/${own1}?src=taster&play=crmtest-token`);
  ok(pre.s === 200 && pre.t.includes(`crm.test+${stamp}lead@example.com`) && pre.t.includes('+2348099999999'), 'a player who saved their score has their email and number filled in');
  const preOther = await call(null, 'GET', `/register/${own2}?src=taster&play=crmtest-token`);
  ok(!preOther.t.includes(`crm.test+${stamp}lead@example.com`), "a taster token for another course fills in nothing");
  const rt = await reg(own1, good('t'), '');
  ok(rt.s === 201, 'control registration');
  const rt2 = await reg(own1, { ...good('tt'), play: 'crmtest-token', src: 'taster' });
  ok(rt2.s === 201 && psql(`select source||'|'||coalesce("growthPlayId",'') from "CourseRegistration" where reference='${rt2.j.reference}'`) === 'TASTER|crmtest-play', 'a registration from the taster game is tagged TASTER and linked to the play');
  const rt3 = await reg(own2, { ...good('t3'), play: 'crmtest-token', src: 'taster' });
  ok(rt3.s === 201 && psql(`select source from "CourseRegistration" where reference='${rt3.j.reference}'`) === 'LINK', 'a taster token from a different course is ignored');

  // ---- the confirmation page
  const done = await call(null, 'GET', `/register/${own1}/done?ref=${ref1}`);
  ok(done.s === 200 && done.t.includes(ref1) && /What happens next/.test(done.t) && !done.t.includes(mail('a')) && !/Amaka/.test(done.t), 'the confirmation page shows the reference and next steps and nothing personal');
  ok(/NEXT_NOT_FOUND|could not be found|404/i.test((await call(null, 'GET', `/register/${own2}/done?ref=${ref1}`)).t), 'a reference does not open the page of another course');
  ok(/NEXT_NOT_FOUND|could not be found|404/i.test((await call(null, 'GET', `/register/${own1}/done?ref=REG-2026-AAAAAA`)).t), 'an invented reference opens nothing');
  const fc = await call(null, 'GET', '/free-courses');
  ok(fc.s === 200 && /Try a free course/.test(fc.t), 'the free courses page loads');

  // ---- who sees what
  const sup = await call(S, 'GET', '/api/admin/crm/registrations');
  ok(sup.s === 200 && sup.j.total >= 5 && sup.j.rows.some((x) => x.reference === ref1), 'a Super Admin sees registrations from every owner');
  const orgOff = await call(ORG, 'GET', '/api/admin/crm/registrations');
  ok(orgOff.s === 403, 'an organization is refused while the CRM is switched off for it');
  ok((await call(null, 'GET', '/api/admin/crm/registrations')).s === 401, 'no sign-in: refused');
  const sw = await call(S, 'POST', '/api/admin/crm/settings', { action: 'switch', organizationId: northwindOrg, enabled: true });
  ok(sw.s === 200, 'the Super Admin switches the CRM on for the organization');
  const orgOn = await call(ORG, 'GET', '/api/admin/crm/registrations');
  ok(orgOn.s === 200 && orgOn.j.total === 1 && orgOn.j.rows[0].reference === r3.j.reference, 'the organization sees only its own registration');
  ok((await call(ORG, 'GET', `/api/admin/crm/registrations/${sup.j.rows.find((x) => x.reference === ref1).id}`)).s === 404, "the organization cannot open AAICBI's registration");
  const orgReg = orgOn.j.rows[0];
  const det = await call(ORG, 'GET', `/api/admin/crm/registrations/${orgReg.id}`);
  ok(det.s === 200 && det.j.activities.length >= 3 && det.j.consents.length >= 2 && det.j.signedName === 'Amaka Okon', 'the detail shows the timeline, consent and the signed agreement');
  const pa = await call(ORG, 'PATCH', `/api/admin/crm/registrations/${orgReg.id}`, { stage: 'CONTACTED', note: 'Called, will join', followUpAt: future(3) });
  ok(pa.s === 200, 'the organization changes the stage, adds a note and sets a follow-up');
  const det2 = await call(ORG, 'GET', `/api/admin/crm/registrations/${orgReg.id}`);
  ok(det2.j.stage === 'CONTACTED' && det2.j.activities.some((a) => a.kind === 'NOTE') && det2.j.activities.some((a) => a.kind === 'STAGE') && !!det2.j.followUpAt, 'the changes are on the timeline');
  const task = det2.j.tasks[0];
  ok((await call(ORG, 'POST', `/api/admin/crm/tasks/${task.id}`)).s === 200 && psql(`select count(*) from "CrmTask" where id='${task.id}' and "doneAt" is not null`) === '1', 'a task is finished');
  const platTask = psql(`select t.id from "CrmTask" t where t."organizationId" is null limit 1`);
  ok((await call(ORG, 'POST', `/api/admin/crm/tasks/${platTask}`)).s === 404, "an organization cannot finish AAICBI's task");
  ok((await call(ORG, 'PATCH', `/api/admin/crm/registrations/${sup.j.rows.find((x) => x.reference === ref1).id}`, { stage: 'ENROLLED' })).s === 404, "an organization cannot change AAICBI's registration");
  ok((await call(ORG, 'PATCH', `/api/admin/crm/registrations/${orgReg.id}`, { stage: 'NONSENSE' })).s === 400, 'an unknown stage is refused');
  const csv = await call(ORG, 'GET', '/api/admin/crm/registrations?format=csv');
  ok(csv.s === 200 && /^Reference,Registered,Course,Name,Email,WhatsApp,Source,Stage/.test(csv.t) && csv.t.split('\r\n').filter(Boolean).length === 2, 'the organization downloads only its own registration as a spreadsheet');
  ok(/RESTRICT|CRM_EXPORT/.test(psql(`select string_agg(action, ',') from "AuditEvent" where action='CRM_EXPORT'`)), 'the export is on the audit log');
  ok((await call(ORG, 'POST', '/api/admin/crm/settings', { action: 'switch', organizationId: northwindOrg, enabled: false })).s === 403, 'an organization cannot switch its own CRM');
  ok((await call(ORG, 'GET', '/api/admin/crm/settings')).s === 403, 'an organization cannot open the CRM settings');

  // ---- agreement versions
  clearThrottle();
  const ag = await call(S, 'POST', '/api/admin/crm/settings', { action: 'agreement', title: 'AAICBI Learner Agreement', body: 'Second version. '.repeat(20) });
  ok(ag.s === 200 && ag.j.version === ver + 1, 'a new agreement version is published');
  ok((await reg(own2, good('v', { agreementVersion: ver }))).s === 409, 'the old version can no longer be signed');
  const rv = await reg(own2, good('v', { agreementVersion: ver + 1 }));
  ok(rv.s === 201 && psql(`select a.version from "CourseRegistration" r join "RegistrationAgreement" a on a.id=r."agreementId" where r.reference='${rv.j.reference}'`) === String(ver + 1), 'the new version is recorded on the registration');
  ok(psql(`select a.version from "CourseRegistration" r join "RegistrationAgreement" a on a.id=r."agreementId" where r.reference='${ref1}'`) === String(ver), 'earlier registrations keep the version they signed');
  ok((await call(S, 'POST', '/api/admin/crm/settings', { action: 'agreement', title: 'x', body: 'too short' })).s === 400, 'a too-short agreement is refused');
  ver += 1;

  // ---- opt out, then register again
  const tok = psql(`select "optOutToken" from "CrmContact" where email='${mail('t')}'`);
  ok((await call(null, 'POST', '/api/public/crm/optout', { token: tok })).s === 200, 'the stop link works');
  ok(psql(`select ("optedOutAt" is not null)::text||'|'||"followUpEmail"||'|'||"followUpWhatsapp"||'|'||newsletter from "CrmContact" where email='${mail('t')}'`) === 'true|false|false|false', 'all consent is switched off for the contact');
  const afterStop = await call(S, 'GET', `/api/admin/crm/registrations?q=${encodeURIComponent(mail('t'))}`);
  ok(afterStop.j.rows.length === 1 && afterStop.j.rows[0].optedOut === true && afterStop.j.rows[0].emailOk === false, 'staff see that the person stopped messages');
  ok((await call(null, 'POST', '/api/public/crm/optout', { token: 'nope' })).s === 404, 'a wrong stop link is refused');
  const again = await reg(own2, good('t'));
  ok(again.s === 201 && psql(`select ("optedOutAt" is null)::text from "CrmContact" where email='${mail('t')}'`) === 'true', 'registering again with a fresh tick is new consent');

  // ---- capacity and deadline
  clearThrottle();
  psql(`update "Course" set capacity=1, status='PUBLISHED', "registrationEnabled"=true, "registrationDeadline"=null where id='${own3}'`);
  ok((await reg(own3, good('c1'))).s === 201, 'the last place is taken');
  ok((await reg(own3, good('c2'))).s === 409, 'a full course is closed');
  psql(`update "Course" set capacity=null, "registrationDeadline"='${future(-1)}' where id='${own3}'`);
  ok((await reg(own3, good('c3'))).s === 409, 'a course past its deadline is closed');

  // ---- the course switch
  const card = await call(S, 'GET', `/api/admin/courses/${own3}/registration`);
  ok(card.s === 200 && card.j.open === false && card.j.registered >= 1 && /\/register\//.test(card.j.link), 'the course card shows state, count and link');
  const off = await call(S, 'PATCH', `/api/admin/courses/${own2}/registration`, { enabled: false });
  ok(off.s === 200 && off.j.open === false && (await reg(own2, good('off'))).s === 409, 'switching a course off closes its page');
  ok((await call(null, 'PATCH', `/api/admin/courses/${own2}/registration`, { enabled: true })).s === 401, 'switching a course needs sign-in');

  // ---- the screens on a phone
  const br = await launch();
  const phone = device('iPhone 13');
  const ctx = await br.newContext({ ...phone });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/register/${own1}?src=qr`, { waitUntil: 'networkidle' });
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'the registration page does not scroll sideways on a phone');
  ok(await pg.locator('[data-testid="register-submit"]').isDisabled(), 'the Register button is off until the agreement and tick are done');
  await pg.getByLabel('First name').fill('Chidi');
  await pg.getByLabel('Last name').fill('Eze');
  await pg.locator('input[type=email]').fill(mail('ui'));
  await pg.getByLabel('WhatsApp number').fill('+234 802 000 1111');
  await pg.getByLabel('Type your full name to sign').fill('Chidi Eze');
  await pg.getByLabel('I have read and agree to the agreement above.').check();
  ok(await pg.locator('[data-testid="register-submit"]').isDisabled(), 'still off without the follow-up tick');
  await pg.getByLabel(/Contact me by email and WhatsApp/).check();
  ok(!(await pg.locator('[data-testid="register-submit"]').isDisabled()), 'on once everything is done');
  await pg.waitForTimeout(3200);
  await Promise.all([pg.waitForURL(/\/done\?ref=REG-/), pg.locator('[data-testid="register-submit"]').click()]);
  ok(await pg.locator('[data-testid="register-done"]').isVisible(), 'submitting through the form lands on the confirmation page');
  ok(psql(`select source||'|'||"sourceTag" from "CourseRegistration" r join "CrmContact" k on k.id=r."contactId" where k.email='${mail('ui')}'`) === 'QR|qr', 'the QR tag made the source QR');
  await pg.screenshot({ path: '/tmp/dev/crm-done-phone.png', fullPage: true });
  await pg.goto(`${B}/register/${own1}`, { waitUntil: 'networkidle' });
  await pg.screenshot({ path: '/tmp/dev/crm-register-phone.png', fullPage: true });

  const sctx = await br.newContext({ ...device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }) });
  await sctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const sp = await sctx.newPage();
  await sp.goto(`${B}/admin/crm`, { waitUntil: 'networkidle' });
  ok(await sp.locator('[data-testid="crm-rows"]').isVisible(), 'the staff list shows registrations');
  await sp.locator('[data-testid="crm-rows"] button').first().click();
  await sp.waitForSelector('[data-testid="crm-timeline"] li');
  ok(await sp.locator('[data-testid="crm-timeline"] li').count() >= 3, 'opening one shows its timeline');
  await sp.screenshot({ path: '/tmp/dev/crm-staff-desktop.png', fullPage: true });
  await sp.goto(`${B}/admin/crm/settings`, { waitUntil: 'networkidle' });
  ok(await sp.locator('[data-testid="crm-orgs"]').isVisible() && await sp.locator('[data-testid="crm-agreement"]').isVisible(), 'the settings page shows the organization switches and the agreement');
  await sp.screenshot({ path: '/tmp/dev/crm-settings-desktop.png', fullPage: true });
  const sphone = await br.newContext({ ...phone });
  await sphone.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const spp = await sphone.newPage();
  await spp.goto(`${B}/admin/crm`, { waitUntil: 'networkidle' });
  ok(!(await spp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'the staff list does not scroll sideways on a phone');
  await br.close();

  cleanup();
  const bad = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
