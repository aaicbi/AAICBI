// CRM email composer end to end, against a local stand-in for Resend (/tmp/dev/resend-standin.cjs, port 9911) and a dev server started with
// RESEND_API_KEY, RESEND_BASE_URL and RESEND_WEBHOOK_SECRET (/tmp/dev/startdev-mail.sh). Covers senders and verification, templates and versions,
// merge safety, consent and suppression, test sends, drafts, scheduling and the hourly job, attachments, rate limits, an organization sending
// "via AAICBI", signed delivery reports (duplicates, out of order, bounces, complaints), who can see what, and the screens.
const crypto = require('crypto');
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const ok = (c, m) => log(!!c, m);
const standin = async () => (await fetch('http://127.0.0.1:9911/_log')).json();
const reset = () => fetch('http://127.0.0.1:9911/_reset');
const secretBytes = Buffer.from('crm-test-webhook-secret-key-1234');
let evn = 0;
const hook = async (payload, over = {}) => {
  const body = JSON.stringify(payload), id = over.id ?? `msg_${Date.now()}_${++evn}`, ts = String(over.ts ?? Math.floor(Date.now() / 1000));
  const sig = over.sig ?? `v1,${crypto.createHmac('sha256', over.key ?? secretBytes).update(`${id}.${ts}.${body}`).digest('base64')}`;
  return { id, ...(await call(null, 'POST', '/api/webhooks/resend', body, { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sig })) };
};
const stamp = Date.now();
const mail = (n) => `crm.test+${stamp}${n}@example.com`;

(async () => {
  clearThrottle(); await reset();
  const northwindOrg = 'cmuznki2x0004p61x1xbxqwex';
  const orgCourse = 'cmuznki4u000ip61x2v21ycrq';
  const own = psql(`select c.id from "Course" c join "User" u on u.id=c."createdById" where not exists (select 1 from "TrainingOrganization" o where o."staffUserId"=u.id) and c."isDemo"=false order by c."createdAt" limit 2`).split('\n').filter(Boolean);
  const [own1] = own;
  const snap = {};
  for (const id of [orgCourse, ...own]) snap[id] = psql(`select status||'|'||published||'|'||"registrationEnabled"||'|'||coalesce("startDate"::text,'')||'|'||coalesce("registrationDeadline"::text,'')||'|'||coalesce(capacity::text,'') from "Course" where id='${id}'`);
  const tplSnap = "You're registered for {{course_name}}";
  const cleanup = () => {
    psql(`delete from "CrmContact" where email like 'crm.test+%'`);
    psql(`delete from "EmailTemplate" where "key" like 'crm_test%'`);
    psql(`update "EmailTemplate" set "subject"=$q$${tplSnap}$q$, "version"=1 where "key"='registration_received'`);
    psql(`delete from "EmailTemplateVersion" where "version" > 1`);
    psql(`update "EmailSender" set "verified"=false, "replyTo"=null, "active"=true, "allowOrganizations"=true where id in ('sender_admissions','sender_hello')`);
    psql(`delete from "EmailSender" where "fromAddress" like 'crmtest%'`);
    psql(`update "TrainingOrganization" set "crmEnabled"=false where id='${northwindOrg}'`);
    for (const id of Object.keys(snap)) { const [st, pub, reg, sd, dl, cap] = snap[id].split('|'); psql(`update "Course" set status='${st}', published=${pub}, "registrationEnabled"=${reg}, "startDate"=${sd ? `'${sd}'` : 'null'}, "registrationDeadline"=${dl ? `'${dl}'` : 'null'}, capacity=${cap || 'null'} where id='${id}'`); }
  };
  cleanup();
  psql(`update "Course" set status='PUBLISHED', published=true, "startDate"='${new Date(Date.now() + 20 * 86400000).toISOString()}', "registrationDeadline"='${new Date(Date.now() + 10 * 86400000).toISOString()}', capacity=null where id='${own1}'`);
  psql(`update "Course" set status='PUBLISHED', published=true, "registrationEnabled"=true, "startDate"=null, "registrationDeadline"=null, capacity=null where id='${orgCourse}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const ORG = await jar('/api/auth/training-org-login', 'org@dev.test');
  const ver = Number(psql(`select version from "RegistrationAgreement" where active`));

  const register = async (courseId, n, extra = {}) => {
    clearThrottle();
    const r = await call(null, 'POST', `/api/public/register/${courseId}`, { firstName: 'Amaka', lastName: 'Okon', email: mail(n), phone: '0801 234 5678', country: 'Nigeria', state: 'Akwa Ibom', motivation: '', agreementVersion: ver, agreementAccepted: true, signedName: 'Amaka Okon', followUp: true, newsletter: false, website: '', openedForMs: 20000, ...extra });
    if (r.s !== 201) throw new Error(`register ${n} failed ${r.s} ${r.t}`);
    return psql(`select r.id from "CourseRegistration" r join "CrmContact" k on k.id=r."contactId" where k.email='${mail(n)}' and r."courseId"='${courseId}'`);
  };
  const regA = await register(own1, 'a');
  const send = (cookie, regId, over = {}) => call(cookie, 'POST', '/api/admin/crm/email', { action: 'send', registrationId: regId, senderId: 'sender_admissions', templateId: null, category: 'SERVICE', subject: 'Hello {{first_name}}', body: '<p>Hi {{first_name}}, about {{course_name}}.</p>', ...over });

  // ---- senders: starter set, nothing sends until verified
  const snd = await call(S, 'GET', '/api/admin/crm/senders');
  ok(snd.s === 200 && snd.j.senders.length >= 2 && snd.j.senders.every((x) => x.verified === false) && snd.j.canManage, 'the starter senders exist and none is verified');
  const un = await send(S, regA);
  ok(un.s === 409 && un.j.code === 'SENDER_UNVERIFIED', 'sending from an unverified sender is refused');
  const nr = await call(S, 'POST', '/api/admin/crm/senders', { action: 'update', id: 'sender_admissions', verified: true });
  ok(nr.s === 200, 'a Super Admin marks the sender verified');
  const noReply = await send(S, regA);
  ok(noReply.s === 409 && noReply.j.code === 'NO_REPLY_TO', 'a sender with no reply-to is refused, so replies cannot vanish');
  ok((await call(S, 'POST', '/api/admin/crm/senders', { action: 'update', id: 'sender_admissions', replyTo: 'admissions@aaicbi.org' })).s === 200, 'the reply-to is saved');
  await call(S, 'POST', '/api/admin/crm/senders', { action: 'update', id: 'sender_hello', verified: true, replyTo: 'hello@aaicbi.org' });
  ok((await call(S, 'POST', '/api/admin/crm/senders', { action: 'create', name: 'Dup', fromAddress: 'admissions@mail.aaicbi.org', stream: 'SERVICE' })).s === 409, 'a duplicate sender address is refused');
  ok((await call(S, 'POST', '/api/admin/crm/senders', { action: 'create', name: 'Bad', fromAddress: 'not-an-address', stream: 'SERVICE' })).s === 400, 'a bad sender address is refused');
  ok((await call(ORG, 'GET', '/api/admin/crm/senders')).s === 403, 'an organization cannot open the senders');

  // ---- composer options
  const opt = await call(S, 'GET', `/api/admin/crm/email/compose?registrationId=${regA}`);
  ok(opt.s === 200 && opt.j.recipient.serviceOk && !opt.j.recipient.marketingOk && opt.j.templates.length >= 4 && opt.j.senders.some((x) => x.usable) && opt.j.fields.length === 12, 'the composer gets the person, their consent, the templates, usable senders and the 12 fields');

  // ---- a test send goes to the writer, not the person
  await reset();
  const t1 = await call(S, 'POST', '/api/admin/crm/email', { action: 'test', registrationId: regA, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Check {{first_name}}', body: '<p>Hi {{first_name}}</p>' });
  let sent = await standin();
  ok(t1.s === 200 && t1.j.status === 'ACCEPTED' && sent.length === 1 && sent[0].to.includes('super@dev.test') && /^\[Test\] Check Amaka/.test(sent[0].subject), 'a test email goes to the writer with [Test] in the subject');
  ok(psql(`select count(*) from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('a')}' and a.summary like '%Check%'`) === '0', 'a test email is not put on the person\'s timeline');

  // ---- a real send
  await reset();
  const tpl = opt.j.templates.find((t) => t.key === 'registration_received');
  const s1 = await send(S, regA, { templateId: tpl.id, subject: tpl.subject, body: tpl.body });
  sent = await standin();
  const m = sent[0] || {};
  ok(s1.s === 200 && s1.j.status === 'ACCEPTED' && sent.length === 1, 'sending works and Resend accepts it');
  ok(m.from === 'AAICBI Admissions <admissions@mail.aaicbi.org>' && m.to.includes(mail('a')) && (m.reply_to || m.replyTo || '').includes('admissions@aaicbi.org'), `from the approved sender, with the reply-to: ${m.from} / ${m.reply_to}`);
  ok(/registered for/.test(m.subject) && !/\{\{/.test(m.subject + m.html + m.text) && /Amaka/.test(m.html) && /REG-\d{4}-/.test(m.html), 'merge fields were filled in: no {{ left, name and reference present');
  ok(/optout\//.test(m.html) && /Stop messages/.test(m.html) && /optout\//.test(m.text) && m.text.length > 50, 'a branded letterhead, a stop link, and a plain-text version');
  ok(m.headers && /optout\//.test(m.headers['List-Unsubscribe'] || ''), 'a List-Unsubscribe header is set');
  ok(m._headers.idempotency && m._headers.idempotency.startsWith('crm-email-'), 'an idempotency key is sent so a retry cannot double send');
  const row = psql(`select status||'|'||(select count(*) from "CrmEmailEvent" e where e."emailId"=m.id)||'|'||coalesce("providerId",'')||'|'||"templateVersion" from "CrmEmail" m where m."contactId"=(select id from "CrmContact" where email='${mail('a')}') and m."isTest"=false order by m."createdAt" desc limit 1`);
  ok(/^ACCEPTED\|1\|re_standin_/.test(row) && row.endsWith('|1'), `stored as accepted (never delivered) with the provider id and template version: ${row}`);
  ok(/Resend accepted it/.test(psql(`select a.summary from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('a')}' and a.kind='EMAIL_SENT' order by a."createdAt" desc limit 1`)), 'the timeline says accepted, not delivered');

  // ---- content safety
  ok((await send(S, regA, { body: '<p>{{password}} {{first_name}}</p>' })).j.code === 'UNKNOWN_FIELD', 'a field that is not on the list is refused');
  ok((await send(S, regA, { subject: '   ' })).j.code === 'NO_SUBJECT', 'no subject is refused');
  ok((await send(S, regA, { body: '<p></p>' })).j.code === 'NO_BODY', 'an empty message is refused');
  await reset();
  await send(S, regA, { subject: 'Line\r\nBcc: evil@x.com', body: '<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a>' });
  sent = await standin(); const m2 = sent[0] || {};
  ok(!/[\r\n]/.test(m2.subject) && !/<script|onclick|onerror|javascript:|src=\"?x/i.test(m2.html), 'scripts, handlers, images, javascript links and header injection are removed');

  // ---- consent
  const mk = await send(S, regA, { category: 'MARKETING' });
  ok(mk.s === 409 && mk.j.code === 'NO_MARKETING_CONSENT', 'marketing to someone who did not tick the newsletter is refused');
  const regN = await register(own1, 'n', { newsletter: true });
  const wrongStream = await send(S, regN, { category: 'MARKETING' });
  ok(wrongStream.s === 409 && wrongStream.j.code === 'WRONG_STREAM', 'marketing from a service sender is refused even with consent');
  const regO = await register(own1, 'o');
  const tok = psql(`select "optOutToken" from "CrmContact" where email='${mail('o')}'`);
  await call(null, 'POST', '/api/public/crm/optout', { token: tok });
  ok((await send(S, regO)).j.code === 'OPTED_OUT', 'someone who stopped all messages is refused');

  // ---- delivery reports
  const providerId = psql(`select "providerId" from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('a')}') and "isTest"=false and status='ACCEPTED' order by "createdAt" limit 1`);
  const emailId = psql(`select id from "CrmEmail" where "providerId"='${providerId}'`);
  ok((await call(null, 'POST', '/api/webhooks/resend', JSON.stringify({ type: 'email.delivered' }))).s === 401, 'a report with no signature is refused');
  ok((await hook({ type: 'email.delivered', data: { email_id: providerId } }, { key: Buffer.from('wrong') })).s === 401, 'a report signed with the wrong secret is refused');
  ok((await hook({ type: 'email.delivered', data: { email_id: providerId } }, { ts: Math.floor(Date.now() / 1000) - 3600 })).s === 401, 'an old report is refused');
  const d1 = await hook({ type: 'email.delivered', data: { email_id: providerId } });
  ok(d1.s === 200 && d1.j.result === 'applied' && psql(`select status from "CrmEmail" where id='${emailId}'`) === 'DELIVERED' && psql(`select ("deliveredAt" is not null)::text from "CrmEmail" where id='${emailId}'`) === 'true', 'a signed delivery report makes the email Delivered');
  const d2 = await hook({ type: 'email.delivered', data: { email_id: providerId } }, { id: d1.id });
  ok(d2.j.result === 'duplicate' && psql(`select count(*) from "CrmEmailEvent" where "emailId"='${emailId}' and type='delivered'`) === '1', 'the same report twice is recorded once');
  await hook({ type: 'email.sent', data: { email_id: providerId } });
  await hook({ type: 'email.delivery_delayed', data: { email_id: providerId } });
  ok(psql(`select status from "CrmEmail" where id='${emailId}'`) === 'DELIVERED', 'late "sent" and "delayed" reports do not move Delivered backwards');
  await hook({ type: 'email.opened', data: { email_id: providerId } });
  ok(psql(`select status from "CrmEmail" where id='${emailId}'`) === 'DELIVERED' && psql(`select count(*) from "CrmEmailEvent" where "emailId"='${emailId}' and type='opened'`) === '1', 'an open is recorded without changing the status');
  ok((await hook({ type: 'email.delivered', data: { email_id: 're_not_ours' } })).j.result === 'ignored', 'a report for an email we did not send is ignored');

  // ---- bounce and complaint switch the address off
  const regB = await register(own1, 'b');
  await reset();
  await send(S, regB);
  const bId = psql(`select "providerId" from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('b')}') and "isTest"=false order by "createdAt" desc limit 1`);
  await hook({ type: 'email.bounced', data: { email_id: bId, bounce: { type: 'Transient', message: 'mailbox full' } } });
  ok(psql(`select status from "CrmEmail" where "providerId"='${bId}'`) === 'BOUNCED' && psql(`select ("emailSuppressedAt" is null)::text from "CrmContact" where email='${mail('b')}'`) === 'true', 'a temporary bounce is shown but does not switch the address off');
  const regP = await register(own1, 'p');
  await send(S, regP);
  const pId = psql(`select "providerId" from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('p')}') and "isTest"=false order by "createdAt" desc limit 1`);
  await hook({ type: 'email.bounced', data: { email_id: pId, bounce: { type: 'Permanent', message: 'mailbox does not exist' } } });
  ok(psql(`select "emailSuppressedReason" from "CrmContact" where email='${mail('p')}'`) === 'BOUNCE', 'a permanent bounce switches the address off');
  ok(psql(`select count(*) from "CrmTask" t join "CrmContact" k on k.id=t."contactId" where k.email='${mail('p')}' and t.title like 'Ask%working email%'`) === '1', 'and leaves staff a task to ask for a working address');
  ok((await send(S, regP)).j.code === 'SUPPRESSED', 'a switched-off address is refused');
  const regC = await register(own1, 'c');
  await send(S, regC);
  const cId = psql(`select "providerId" from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('c')}') and "isTest"=false order by "createdAt" desc limit 1`);
  await hook({ type: 'email.complained', data: { email_id: cId } });
  ok(psql(`select status||'|'||(select "emailSuppressedReason" from "CrmContact" where email='${mail('c')}') from "CrmEmail" where "providerId"='${cId}'`) === 'COMPLAINED|COMPLAINT', 'a spam complaint switches the address off');

  // ---- a send that Resend refuses
  const regF = await register(own1, 'fail');
  const f1 = await send(S, regF);
  ok(f1.s === 502 && /refused/.test(f1.j.error || ''), 'when Resend refuses, the writer is told why');
  ok(psql(`select status from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('fail')}') order by "createdAt" desc limit 1`) === 'FAILED' && /could not be sent/.test(psql(`select a.summary from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('fail')}' and a.kind='EMAIL_SENT' order by a."createdAt" desc limit 1`)), 'it is stored as failed and noted on the timeline');

  // ---- drafts, scheduling and the hourly job
  const dr = await call(S, 'POST', '/api/admin/crm/email', { action: 'draft', registrationId: regA, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Draft for {{first_name}}', body: '<p>Draft body</p>' });
  ok(dr.s === 200 && dr.j.status === 'DRAFT', 'a draft is saved');
  const opt2 = await call(S, 'GET', `/api/admin/crm/email/compose?registrationId=${regA}`);
  ok(opt2.j.drafts.length === 1 && opt2.j.drafts[0].subjectRaw === 'Draft for {{first_name}}', 'the draft comes back when the composer is opened again');
  const dr2 = await call(S, 'POST', '/api/admin/crm/email', { action: 'draft', draftId: dr.j.id, registrationId: regA, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Draft v2', body: '<p>Draft body</p>' });
  ok(dr2.j.id === dr.j.id && psql(`select count(*) from "CrmEmail" where "contactId"=(select id from "CrmContact" where email='${mail('a')}') and status='DRAFT'`) === '1', 'saving a draft again updates it');
  const future = (min) => new Date(Date.now() + min * 60000).toISOString();
  ok((await call(S, 'POST', '/api/admin/crm/email', { action: 'schedule', registrationId: regA, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Soon', body: '<p>x</p>', scheduledFor: future(1) })).s === 400, 'a time less than 5 minutes away is refused');
  const sc = await call(S, 'POST', '/api/admin/crm/email', { action: 'schedule', draftId: dr.j.id, registrationId: regA, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Scheduled for {{first_name}}', body: '<p>Later, {{first_name}}</p>', scheduledFor: future(20) });
  ok(sc.s === 200 && sc.j.status === 'SCHEDULED' && sc.j.id === dr.j.id, 'a draft is scheduled');
  await reset();
  const cron = (cookie) => call(cookie, 'GET', '/api/cron/crm-email', undefined, cookie ? {} : { Authorization: 'Bearer devcron-secret' });
  ok((await call(null, 'GET', '/api/cron/crm-email')).s === 401, 'the hourly job needs its secret');
  let c1 = await cron(null);
  ok(c1.j.sent === 0 && (await standin()).length === 0, 'nothing goes out before its time');
  psql(`update "CrmEmail" set "scheduledFor"=now() - interval '1 minute' where id='${sc.j.id}'`);
  c1 = await cron(null);
  sent = await standin();
  ok(c1.j.sent === 1 && sent.length === 1 && /Scheduled for Amaka/.test(sent[0].subject) && psql(`select status from "CrmEmail" where id='${sc.j.id}'`) === 'ACCEPTED', 'when due, it is sent, with the name filled in');
  c1 = await cron(null);
  ok(c1.j.sent === 0 && (await standin()).length === 1, 'running the job again sends nothing twice');
  const regS = await register(own1, 's');
  const sc2 = await call(S, 'POST', '/api/admin/crm/email', { action: 'schedule', registrationId: regS, senderId: 'sender_admissions', category: 'SERVICE', subject: 'Will be skipped', body: '<p>This one will be skipped.</p>', scheduledFor: future(20) });
  await call(null, 'POST', '/api/public/crm/optout', { token: psql(`select "optOutToken" from "CrmContact" where email='${mail('s')}'`) });
  psql(`update "CrmEmail" set "scheduledFor"=now() - interval '1 minute' where id='${sc2.j.id}'`);
  await reset();
  c1 = await cron(null);
  console.log('SKIP DEBUG', JSON.stringify(c1.j), psql(`select status||' '||coalesce(error,'') from "CrmEmail" where id='${sc2.j.id}'`), psql(`select string_agg(a.summary, ' // ') from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('s')}'`));
  ok(c1.j.skipped >= 1 && (await standin()).length === 0 && psql(`select status from "CrmEmail" where id='${sc2.j.id}'`) === 'FAILED' && /not sent/.test(psql(`select a.summary from "CrmActivity" a join "CrmContact" k on k.id=a."contactId" where k.email='${mail('s')}' and a.summary like 'Scheduled email not sent%' limit 1`)), 'someone who opts out after it was scheduled is skipped, with a note');

  // ---- attachments
  await reset();
  const regT = await register(own1, 't');
  await reset();
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const at = await call(S, 'POST', '/api/admin/crm/email', { action: 'send', registrationId: regT, senderId: 'sender_admissions', category: 'SERVICE', subject: 'With file', body: '<p>See file</p>', attachments: [{ filename: 'terms.pdf', contentBase64: pdf }] });
  sent = await standin();
  if (!(sent[0] && sent[0].attachments)) console.log('ATT DEBUG', at.s, JSON.stringify(at.j), JSON.stringify(sent[0] && Object.keys(sent[0])));
  ok(at.s === 200 && sent[0].attachments && sent[0].attachments[0].filename === 'terms.pdf', 'an allowed attachment is sent');
  ok((await call(S, 'POST', '/api/admin/crm/email', { action: 'send', registrationId: regT, senderId: 'sender_admissions', category: 'SERVICE', subject: 'x', body: '<p>Please read the attached file.</p>', attachments: [{ filename: 'run.exe', contentBase64: pdf }] })).s === 400, 'an exe attachment is refused');

  // ---- limits
  const regL = await register(own1, 'l');
  clearThrottle();
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await send(S, regL, { subject: `n${i}` })).s;
  ok(last === 429, 'a sixth email to the same person in a day is refused');

  // ---- an organization sends via AAICBI
  await call(S, 'POST', '/api/admin/crm/settings', { action: 'switch', organizationId: northwindOrg, enabled: true });
  const regOrg = await register(orgCourse, 'org');
  clearThrottle();
  const oo = await call(ORG, 'GET', `/api/admin/crm/email/compose?registrationId=${regOrg}`);
  ok(oo.s === 200 && oo.j.viaOrganization === 'Northwind Academy' && oo.j.replyToOrganization, 'an organization sees that it sends as itself via AAICBI');
  await reset();
  const os = await send(ORG, regOrg);
  sent = await standin();
  ok(os.s === 200 && sent[0].from === 'Northwind Academy via AAICBI <admissions@mail.aaicbi.org>' && (sent[0].reply_to || sent[0].replyTo || '').includes('@') && !(sent[0].reply_to || '').includes('admissions@aaicbi.org') && /Northwind Academy/.test(sent[0].html), `an organization's email comes from "Organization via AAICBI" with replies to the organization: ${sent[0] && sent[0].from} / ${sent[0] && sent[0].reply_to}`);
  ok((await send(ORG, regA)).s === 404, "an organization cannot email AAICBI's registrant");
  await call(S, 'POST', '/api/admin/crm/senders', { action: 'update', id: 'sender_hello', allowOrganizations: false });
  ok((await send(ORG, regOrg, { senderId: 'sender_hello', subject: 'again' })).j.code === 'ORG_NOT_ALLOWED', 'an organization cannot use a sender that is closed to organizations');
  const ot = await call(ORG, 'GET', '/api/admin/crm/templates');
  ok(ot.s === 200 && ot.j.canEdit === false && ot.j.templates.length >= 4, 'an organization can read the templates but not edit them');
  ok((await call(ORG, 'POST', '/api/admin/crm/templates', { action: 'create', name: 'x', category: 'SERVICE', subject: 'x', body: '<p>x</p>' })).s === 403, 'an organization cannot create a template');
  const odetail = await call(ORG, 'GET', `/api/admin/crm/registrations/${regOrg}`);
  ok(odetail.j.emails.length === 1 && odetail.j.emails[0].status === 'ACCEPTED', 'the registration shows the email and its status');

  // ---- templates and versions
  const tl = await call(S, 'GET', '/api/admin/crm/templates');
  const rr = tl.j.templates.find((t) => t.key === 'registration_received');
  ok(tl.j.canEdit && rr.used >= 1, 'templates list with how often they were used');
  const edit = await call(S, 'POST', '/api/admin/crm/templates', { action: 'update', id: rr.id, name: rr.name, description: rr.description, category: 'SERVICE', subject: 'Welcome aboard, {{first_name}}', body: rr.body + '<script>x</script>', senderId: null });
  ok(edit.s === 200 && edit.j.version === 2 && psql(`select count(*) from "EmailTemplateVersion" where "templateId"='${rr.id}'`) === '2' && !/script/.test(psql(`select body from "EmailTemplate" where id='${rr.id}'`)), 'saving changed words makes version 2 and cleans the body');
  ok((await call(S, 'POST', '/api/admin/crm/templates', { action: 'update', id: rr.id, name: rr.name, category: 'SERVICE', subject: 'x {{secret}}', body: '<p>hi</p>' })).s === 400, 'a template with an unknown field is refused');
  const same = await call(S, 'POST', '/api/admin/crm/templates', { action: 'update', id: rr.id, name: 'Registration received', category: 'SERVICE', subject: 'Welcome aboard, {{first_name}}', body: psql(`select body from "EmailTemplate" where id='${rr.id}'`), senderId: null });
  ok(same.j.version === 2, 'saving without changing the words keeps the version');
  const nt = await call(S, 'POST', '/api/admin/crm/templates', { action: 'create', name: 'CRM test one', category: 'SERVICE', subject: 'Hi {{first_name}}', body: '<p>Hello</p>' });
  ok(nt.s === 200, 'a new template is created');
  psql(`update "EmailTemplate" set "key"='crm_test_one' where id='${nt.j.id}'`);

  // ---- the detail view and the screens
  const det = await call(S, 'GET', `/api/admin/crm/registrations/${regA}`);
  ok(det.s === 200 && det.j.emails.some((e) => e.status === 'DELIVERED' && e.events.some((x) => x.type === 'delivered')) && det.j.emails.every((e) => e.status !== 'DRAFT'), 'the detail view shows emails with their delivery events and no drafts');
  const br = await launch();
  const ctx = await br.newContext({ ...device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }) });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pg = await ctx.newPage();
  await pg.goto(`${B}/admin/crm?r=${regA}`, { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-testid="crm-emails"]');
  ok(await pg.locator('[data-testid="crm-email-button"]').isVisible() && await pg.locator('[data-testid="crm-emails"] li').count() >= 1, 'the registration shows an Email button and its emails');
  await pg.screenshot({ path: '/tmp/dev/crm-email-detail.png', fullPage: true });
  await Promise.all([pg.waitForURL(/\/admin\/crm\/compose/), pg.locator('[data-testid="crm-email-button"]').click()]);
  await pg.waitForSelector('[data-testid="composer"]');
  await pg.locator('[data-testid="email-template"]').selectOption({ label: 'Missing information' });
  await pg.waitForFunction(() => document.querySelector('[data-testid="email-subject"]').value.includes('question about your registration'));
  ok((await pg.locator('[data-testid="email-body"]').innerText()).includes('{{first_name}}'), 'choosing a template fills the subject and the message');
  const prev = await pg.frameLocator('[data-testid="email-preview"]').locator('body').innerText();
  ok(/Amaka/.test(prev) && !/\{\{/.test(prev), 'the preview shows the person\'s details filled in');
  await pg.locator('[data-testid="email-body"]').click();
  await pg.keyboard.press('End');
  await pg.keyboard.type(' Extra line.');
  await pg.screenshot({ path: '/tmp/dev/crm-email-compose.png', fullPage: true });
  clearThrottle();
  await pg.locator('[data-testid="email-send"]').click();
  await pg.waitForSelector('[data-testid="email-result"]');
  ok(/Resend accepted/.test(await pg.locator('[data-testid="email-result"]').innerText()), 'sending through the screen says Resend accepted it, not delivered');
  await pg.selectOption('select >> nth=1', 'MARKETING').catch(() => {});
  const cat = pg.locator('select').nth(1);
  await cat.selectOption('MARKETING', { force: true }).catch(() => {});
  await pg.waitForTimeout(300);
  ok(await pg.locator('[data-testid="email-blocked"]').isVisible() && await pg.locator('[data-testid="email-send"]').isDisabled(), 'choosing marketing for someone who did not agree blocks Send and explains why');
  await pg.goto(`${B}/admin/crm/templates`, { waitUntil: 'networkidle' });
  ok(await pg.locator('[data-testid="template-list"] li').count() >= 4, 'the templates screen lists the templates');
  await pg.getByRole('button', { name: 'Edit' }).first().click();
  ok(await pg.locator('[data-testid="template-editor"]').isVisible(), 'a template opens for editing with a preview');
  await pg.goto(`${B}/admin/crm/senders`, { waitUntil: 'networkidle' });
  ok(await pg.locator('[data-testid="sender-row"]').count() >= 2 && /Resend/.test(await pg.locator('body').innerText()), 'the senders screen lists senders and the Resend setup steps');
  await pg.screenshot({ path: '/tmp/dev/crm-email-senders.png', fullPage: true });
  const ph = await br.newContext({ ...device('iPhone 13') });
  await ph.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pp = await ph.newPage();
  for (const path of [`/admin/crm/compose?r=${regA}`, '/admin/crm/templates', '/admin/crm/senders']) {
    await pp.goto(B + path, { waitUntil: 'load' });
    await pp.waitForSelector('main h1');
    await pp.waitForTimeout(1500);
    ok(!(await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${path.split('?')[0]} does not scroll sideways on a phone`);
  }
  await pp.goto(`${B}/admin/crm/compose?r=${regA}`, { waitUntil: 'load' });
  await pp.waitForSelector('[data-testid="composer"]');
  await pp.screenshot({ path: '/tmp/dev/crm-email-compose-phone.png', fullPage: true });
  await br.close();

  cleanup();
  const bad = results.filter((r) => !r[0]).length;
  console.log(`\n${results.length - bad}/${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
