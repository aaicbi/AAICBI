// Growth funnel: follow-up messages to people who saved their score. Runs against a stand-in for Meta's WhatsApp Cloud API on port 4891
// (the server under test must be started with WHATSAPP_API_BASE=http://127.0.0.1:4891 and the WHATSAPP_* and CRON_SECRET values below).
// Checks the switch, the channels, what is sent and when (welcome, reminders, finish nudge), quiet hours, the daily limit, stopping (opt-out link,
// STOP reply, payment), delivery receipts, the webhook's checks, failures and retries, editing the messages, and the Super Admin screen.
const http = require('http');
const crypto = require('crypto');
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APP_SECRET = 'app-secret', VERIFY = 'vt-secret', CRON = 'cron-secret';

// ---- the stand-in for Meta
const received = []; let failFor = null; let n = 0;
const stub = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    received.push({ url: req.url, auth: req.headers.authorization, body: j });
    if (failFor && j.to === failFor) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: '(#131030) Recipient phone number not in allowed list' } })); }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.TEST' + ++n }] }));
  });
});

(async () => {
  await new Promise((r) => stub.listen(4891, '127.0.0.1', r));
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthMessage', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  const orig = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${own}'`);
  // A paid course, so continuing into module 1 is a preview and not a full enrollment.
  psql(`update "Course" set published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=4500000 where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const ST = await jar('/api/auth/login', 'staff@dev.test');
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  const msg = (body) => call(S, 'POST', '/api/admin/growth/messaging', body);
  const state = async () => (await call(S, 'GET', '/api/admin/growth/messaging')).j;

  // a person who finishes and saves their score
  const person = async ({ phone, email, nickname } = {}) => {
    const st = (await call(null, 'POST', `/api/public/growth/${slug}/play`, {})).j;
    let s = st.state;
    while (s.status === 'question') s = (await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: st.token, choice: s.question.options[0].key })).j.state;
    if (nickname) await call(null, 'POST', `/api/public/growth/${slug}/challenge`, { token: st.token, nickname });
    const sv = await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: st.token, phone, email, consent: true });
    const leadId = psql(`select l.id from "GrowthLead" l join "GrowthGuestPlay" p on p.id=l."playId" where p.token='${st.token}'`);
    return { token: st.token, leadId, save: sv };
  };
  const msgs = (leadId) => psql(`select string_agg(kind||':'||status, ',' order by case kind when 'WELCOME' then 0 when 'REMINDER_1' then 1 when 'REMINDER_2' then 2 else 3 end) from "GrowthMessage" where "leadId"='${leadId}'`);
  const waitFor = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(150); } return false; };
  const age = (leadId, hours) => { psql(`update "GrowthLead" set "createdAt" = now() - interval '${hours} hours' where id='${leadId}'`); psql(`update "GrowthMessage" set "createdAt" = now() - interval '${hours} hours', "sentAt" = case when "sentAt" is null then null else now() - interval '${hours} hours' end where "leadId"='${leadId}'`); };
  const signed = (obj, secret = APP_SECRET) => { const raw = JSON.stringify(obj); return { raw, sig: 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex') }; };

  // ---- off by default
  let o = await state();
  log(o.settings.enabled === false && o.settings.channel === 'MANUAL' && o.settings.dailyCap === 200 && o.providers.whatsapp.configured === true, 'messaging starts off, by hand, with a limit of 200 a day');
  log((await call(ST, 'GET', '/api/admin/growth/messaging')).s === 403 && (await call(null, 'GET', '/api/admin/growth/messaging')).s === 401, 'only a Super Admin can see or change messaging');
  const a0 = await person({ phone: '0803 123 4567' });
  await sleep(800);
  log(psql(`select count(*) from "GrowthMessage"`) === '0', 'saving a score while messaging is off sends and queues nothing');
  let r = await msg({ action: 'run' });
  log(r.s === 200 && r.j.run.enabled === false && psql(`select count(*) from "GrowthMessage"`) === '0', 'sending now does nothing while it is off');
  log(received.length === 0, 'and nothing reached WhatsApp');
  psql(`update "GrowthLead" set "createdAt" = now() - interval '5 days' where id='${a0.leadId}'`);

  // ---- settings
  r = await msg({ action: 'settings', channel: 'EMAIL', enabled: true });
  log(r.s === 409 && /not set up/i.test(r.j.error), 'email cannot be used until the server has an email key (' + r.s + ')');
  r = await msg({ action: 'settings', dailyCap: 0 });
  log(r.s === 400, 'a daily limit of 0 is refused');
  r = await msg({ action: 'settings', channel: 'CARRIER_PIGEON' });
  log(r.s === 400, 'an unknown channel is refused');
  r = await msg({ action: 'settings', channel: 'WHATSAPP', dailyCap: 50, quiet: { start: 0, end: 0 }, enabled: true });
  log(r.s === 200 && r.j.settings.enabled && r.j.settings.channel === 'WHATSAPP' && r.j.settings.dailyCap === 50, 'WhatsApp is switched on with a limit of 50 and no quiet hours');

  // ---- the welcome goes out at once
  const a = await person({ phone: '0803 123 4567', nickname: 'Ada Okoro' });
  log(await waitFor(() => psql(`select status from "GrowthMessage" where "leadId"='${a.leadId}'`) === 'SENT'), 'saving a score sends the welcome right away');
  const first = received[0];
  log(first.url === '/123456/messages' && first.auth === 'Bearer test-token', 'it calls the messages endpoint with the access token');
  log(first.body.messaging_product === 'whatsapp' && first.body.to === '2348031234567' && first.body.type === 'template', 'to the right number as a template message');
  log(first.body.template.name === 'aaicbi_taster_welcome' && first.body.template.language.code === 'en', 'using the welcome template in English');
  const params = first.body.template.components[0].parameters.map((p) => p.text);
  log(params.length === 5 && params[0] === 'Ada' && /Automator|Newcomer/.test(params[1]) && params[2].length > 3, 'with the name, rank and course as the first three variables (' + params.slice(0, 3).join(' | ') + ')');
  log(params[3].endsWith(`/play/${slug}/continue`) && /\/growth\/optout\/[a-f0-9]{40}$/.test(params[4]), 'then the link to continue and the stop link');
  const wamid = psql(`select "providerMessageId" from "GrowthMessage" where "leadId"='${a.leadId}'`);
  log(/^wamid\.TEST/.test(wamid), 'Meta\'s message id is kept (' + wamid + ')');

  const b = await person({ email: 'bola@example.com' });
  await sleep(1200);
  log(msgs(b.leadId) === 'WELCOME:SKIPPED' && /No phone/.test(psql(`select error from "GrowthMessage" where "leadId"='${b.leadId}'`)), 'someone who left only an email is skipped on a WhatsApp send, with the reason');

  r = await msg({ action: 'run' });
  log(msgs(a0.leadId) === '' || msgs(a0.leadId) === 'null', 'a score saved days ago, while messaging was off, is not messaged when it is switched on');

  // ---- reminders
  age(a.leadId, 25);
  r = await msg({ action: 'run' });
  log(r.j.run.sent === 1 && msgs(a.leadId) === 'WELCOME:SENT,REMINDER_1:SENT', 'a day later the first reminder is sent');
  const rem1 = received[received.length - 1].body.template;
  log(rem1.name === 'aaicbi_taster_reminder_1', 'using the reminder 1 template');
  r = await msg({ action: 'run' });
  log(r.j.run.sent === 0 && msgs(a.leadId) === 'WELCOME:SENT,REMINDER_1:SENT', 'running again straight away sends nothing more');
  age(a.leadId, 73); psql(`update "GrowthMessage" set "createdAt" = now() - interval '30 hours', "sentAt" = now() - interval '30 hours' where "leadId"='${a.leadId}' and kind='REMINDER_1'`);
  r = await msg({ action: 'run' });
  log(msgs(a.leadId) === 'WELCOME:SENT,REMINDER_1:SENT,REMINDER_2:SENT', 'three days after saving the last reminder is sent');
  age(a.leadId, 200); psql(`update "GrowthLead" set "createdAt" = now() - interval '4 days' where id='${a.leadId}'`);
  r = await msg({ action: 'run' });
  log(msgs(a.leadId) === 'WELCOME:SENT,REMINDER_1:SENT,REMINDER_2:SENT', 'and nothing after that');

  // ---- quiet hours
  const hourWat = (new Date().getUTCHours() + 1) % 24;
  r = await msg({ action: 'settings', quiet: { start: hourWat, end: (hourWat + 1) % 24 } });
  log(r.j.quietNow === true, 'quiet hours can be set to cover now');
  const before = received.length;
  const c = await person({ phone: '0803 000 1111' });
  await sleep(1200);
  log(msgs(c.leadId) === 'WELCOME:QUEUED' && received.length === before, 'in quiet hours a welcome waits in the queue and nothing is sent');
  r = await msg({ action: 'run' });
  log(r.j.run.quiet === true && r.j.run.sent === 0, 'sending now in quiet hours still sends nothing');
  await msg({ action: 'settings', quiet: { start: 0, end: 0 } });
  r = await msg({ action: 'run' });
  log(msgs(c.leadId) === 'WELCOME:SENT' && received.length === before + 1, 'once quiet hours end the queued welcome goes out');

  // ---- the daily limit
  const sentToday = Number(psql(`select count(*) from "GrowthMessage" where "sentAt" > now() - interval '24 hours' and channel in ('WHATSAPP','EMAIL')`));
  await msg({ action: 'settings', dailyCap: sentToday });
  const d = await person({ phone: '0803 000 2222' });
  await sleep(1200);
  r = await msg({ action: 'run' });
  log(msgs(d.leadId) === 'WELCOME:QUEUED' && r.j.run.capped === true, 'at the daily limit the next message waits (' + sentToday + ' sent in 24 hours)');
  await msg({ action: 'settings', dailyCap: 50 });
  r = await msg({ action: 'run' });
  log(msgs(d.leadId) === 'WELCOME:SENT', 'raising the limit lets it go');

  // ---- stopping
  await msg({ action: 'settings', quiet: { start: hourWat, end: (hourWat + 1) % 24 } });
  const e = await person({ phone: '0803 000 3333' });
  await sleep(1200);
  const stop = psql(`select "optOutToken" from "GrowthLead" where id='${e.leadId}'`);
  log((await call(null, 'POST', '/api/public/growth/optout', { token: stop })).s === 200, 'the stop link opts someone out');
  await msg({ action: 'settings', quiet: { start: 0, end: 0 } });
  const before2 = received.length;
  r = await msg({ action: 'run' });
  log(msgs(e.leadId) === 'WELCOME:SKIPPED' && psql(`select error from "GrowthMessage" where "leadId"='${e.leadId}'`) === 'Opted out' && received.length === before2, 'a message queued before they opted out is skipped, not sent');
  const f = await person({ phone: '0803 000 4444' });
  await waitFor(() => psql(`select status from "GrowthMessage" where "leadId"='${f.leadId}'`) === 'SENT');
  const stopReply = signed({ entry: [{ changes: [{ value: { messages: [{ from: '2348030004444', text: { body: 'STOP' } }] } }] }] });
  r = await call(null, 'POST', '/api/webhooks/whatsapp', stopReply.raw, { 'x-hub-signature-256': stopReply.sig });
  log(r.s === 200 && r.j.optedOut === 1 && psql(`select "optedOutAt" is not null from "GrowthLead" where id='${f.leadId}'`) === 't', 'replying STOP on WhatsApp opts the number out');
  age(f.leadId, 26);
  const before3 = received.length;
  await msg({ action: 'run' });
  log(msgs(f.leadId) === 'WELCOME:SENT' && received.length === before3, 'and no reminder is sent to them');

  // ---- the webhook's checks
  r = await call(null, 'GET', `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`);
  log(r.s === 200 && String(r.j) === '12345', 'Meta\'s one-time check is answered with its challenge');
  log((await call(null, 'GET', '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1')).s === 403, 'a wrong verify token is refused');
  const upd = (status, extra = {}) => signed({ entry: [{ changes: [{ value: { statuses: [{ id: wamid, status, ...extra }] } }] }] });
  let u = upd('delivered');
  log((await call(null, 'POST', '/api/webhooks/whatsapp', u.raw)).s === 401, 'a webhook with no signature is refused');
  u = signed({ entry: [] }, 'wrong-secret');
  log((await call(null, 'POST', '/api/webhooks/whatsapp', u.raw, { 'x-hub-signature-256': u.sig })).s === 401, 'a webhook signed with the wrong secret is refused');
  u = upd('delivered'); await call(null, 'POST', '/api/webhooks/whatsapp', u.raw, { 'x-hub-signature-256': u.sig });
  log(psql(`select status from "GrowthMessage" where "providerMessageId"='${wamid}'`) === 'DELIVERED', 'a delivery receipt marks the message delivered');
  u = upd('read'); await call(null, 'POST', '/api/webhooks/whatsapp', u.raw, { 'x-hub-signature-256': u.sig });
  u = upd('delivered'); await call(null, 'POST', '/api/webhooks/whatsapp', u.raw, { 'x-hub-signature-256': u.sig });
  log(psql(`select status from "GrowthMessage" where "providerMessageId"='${wamid}'`) === 'READ', 'a read receipt moves it on, and an older update does not move it back');
  const sentOne = psql(`select "providerMessageId" from "GrowthMessage" where "leadId"='${c.leadId}'`);
  u = signed({ entry: [{ changes: [{ value: { statuses: [{ id: sentOne, status: 'failed', errors: [{ title: 'Message undeliverable' }] }] } }] }] });
  await call(null, 'POST', '/api/webhooks/whatsapp', u.raw, { 'x-hub-signature-256': u.sig });
  log(psql(`select status||'|'||error from "GrowthMessage" where "leadId"='${c.leadId}'`) === 'FAILED|Message undeliverable', 'a failure report marks it failed with the reason');

  // ---- a person who started module 1, then paid
  const g = await person({ phone: '0803 000 5555' });
  await waitFor(() => msgs(g.leadId) === 'WELCOME:SENT');
  const t7 = psql(`select id from "Trainee" where email='t7@dev.test'`);
  psql(`delete from "CourseEnrollment" where "traineeId"='${t7}' and "courseId"='${own}'`);
  const T7 = await jar('/api/auth/trainee-login', 't7@dev.test');
  const cl = await call(T7, 'POST', '/api/growth/claim', { slug, token: g.token });
  log(cl.s === 200, 'someone continues into module 1');
  psql(`update "GrowthGuestPlay" set "claimedAt" = now() - interval '49 hours' where token='${g.token}'`);
  age(g.leadId, 49);
  r = await msg({ action: 'run' });
  log(msgs(g.leadId) === 'WELCOME:SENT,FINISH_MODULE_1:SENT', 'two days after starting, they get the finish-Module-1 nudge, not a reminder to start');
  const fin = received[received.length - 1].body.template.components[0].parameters.map((p) => p.text);
  log(fin[3].includes(`/trainee/courses/${own}`) && received[received.length - 1].body.template.name === 'aaicbi_taster_finish_module_1', 'which links to the course');
  const h = await person({ phone: '0803 000 6666' });
  await waitFor(() => msgs(h.leadId) === 'WELCOME:SENT');
  const t8 = psql(`select id from "Trainee" where email='t8@dev.test'`);
  psql(`delete from "CourseEnrollment" where "traineeId"='${t8}' and "courseId"='${own}'`);
  const T8 = await jar('/api/auth/trainee-login', 't8@dev.test');
  await call(T8, 'POST', '/api/growth/claim', { slug, token: h.token });
  psql(`update "CourseEnrollment" set source='PAID', "unlockedAt"=now() where "traineeId"='${t8}' and "courseId"='${own}'`);
  psql(`update "GrowthGuestPlay" set "claimedAt" = now() - interval '60 hours' where token='${h.token}'`);
  age(h.leadId, 60);
  const before4 = received.length;
  await msg({ action: 'run' });
  log(msgs(h.leadId) === 'WELCOME:SENT' && received.length === before4, 'someone who paid is not messaged again');
  for (const x of [t7, t8]) psql(`delete from "CourseEnrollment" where "traineeId"='${x}' and "courseId"='${own}'`);

  // ---- a failed send and a retry
  failFor = '2348030007777';
  const i = await person({ phone: '0803 000 7777' });
  await waitFor(() => psql(`select status from "GrowthMessage" where "leadId"='${i.leadId}'`) === 'FAILED');
  log(/not in allowed list/.test(psql(`select error from "GrowthMessage" where "leadId"='${i.leadId}'`)), 'when WhatsApp refuses a message it is marked failed with Meta\'s reason');
  const failedId = psql(`select id from "GrowthMessage" where "leadId"='${i.leadId}'`);
  failFor = null;
  r = await msg({ action: 'retry', id: failedId });
  log(r.s === 200, 'a failed message can be retried');
  r = await msg({ action: 'run' });
  log(msgs(i.leadId) === 'WELCOME:SENT', 'and the retry goes out');
  log((await msg({ action: 'retry', id: failedId })).s === 409, 'a message that already went cannot be retried');

  // ---- editing the messages
  r = await msg({ action: 'template', kind: 'WELCOME', body: 'Hi {name} {link}' });
  log(r.s === 400 && /stop/i.test(r.j.error), 'a message without the stop link is refused');
  r = await msg({ action: 'template', kind: 'WELCOME', body: 'Hi {nme} {stop}' });
  log(r.s === 400 && /Unknown placeholder/.test(r.j.error), 'an unknown placeholder is refused');
  r = await msg({ action: 'template', kind: 'NOPE', body: '{stop}' });
  log(r.s === 404, 'an unknown message is refused');

  // ---- by hand
  await msg({ action: 'settings', channel: 'MANUAL' });
  r = await msg({ action: 'template', kind: 'WELCOME', body: 'Custom hello {name}! {rank} on {course}. Start: {link} Stop: {stop}', waTemplate: 'my_custom_tpl' });
  log(r.s === 200 && r.j.templates.find((t) => t.kind === 'WELCOME').custom === true, 'a custom welcome is saved');
  const before5 = received.length;
  const j = await person({ phone: '0803 000 8888', nickname: 'Jide' });
  await waitFor(() => msgs(j.leadId) === 'WELCOME:MANUAL_PENDING');
  const row = (await state()).outbox.find((m) => m.to === '+2348030008888');
  log(row && row.status === 'MANUAL_PENDING' && /^Custom hello Jide!/.test(row.body) && received.length === before5, 'by hand: the message waits for you, with your wording, and nothing is sent');
  log(row.waMe.startsWith('https://wa.me/2348030008888?text=Custom%20hello%20Jide') && decodeURIComponent(row.waMe).includes('/growth/optout/'), 'with a WhatsApp link that opens the chat with the text filled in, stop link included');
  r = await msg({ action: 'sent', id: row.id });
  log(r.s === 200 && r.j.outbox.find((m) => m.id === row.id).status === 'MANUAL_SENT', 'marking it sent records that you sent it');
  log((await msg({ action: 'sent', id: row.id })).s === 409, 'it cannot be marked twice');
  const k = await person({ phone: '0803 000 9999' });
  await waitFor(() => msgs(k.leadId) === 'WELCOME:MANUAL_PENDING');
  const kid = psql(`select id from "GrowthMessage" where "leadId"='${k.leadId}'`);
  r = await msg({ action: 'skip', id: kid });
  log(r.s === 200 && msgs(k.leadId) === 'WELCOME:SKIPPED', 'a waiting message can be skipped');
  r = await msg({ action: 'resetTemplate', kind: 'WELCOME' });
  log(r.j.templates.find((t) => t.kind === 'WELCOME').custom === false && /^Hi \{name\}!/.test(r.j.templates.find((t) => t.kind === 'WELCOME').body), 'the standard welcome can be put back');
  log(/\{\{1\}\}.*\{\{5\}\}/.test(r.j.templates[0].metaText), 'and the text to register with Meta uses {{1}} to {{5}}');

  // ---- the hourly job
  log((await call(null, 'GET', '/api/cron/growth-messages')).s === 401 && (await call(null, 'GET', '/api/cron/growth-messages', undefined, { authorization: 'Bearer wrong' })).s === 401, 'the hourly job refuses a caller without the secret');
  r = await call(null, 'GET', '/api/cron/growth-messages', undefined, { authorization: `Bearer ${CRON}` });
  log(r.s === 200 && r.j.enabled === true && typeof r.j.queued === 'number', 'and answers with counts when called with it');

  // ---- the screen
  const br = await launch();
  const ctx = await br.newContext({ ...device('Desktop Chrome') });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 1100, height: 1400 });
  await pg.goto(`${B}/admin/growth`);
  await pg.getByTestId('growth-messaging').waitFor();
  log(/Follow-up messages/.test(await pg.getByTestId('growth-messaging').innerText()), 'the Growth page shows the messaging section');
  log((await pg.getByTestId('outbox-row').count()) > 3, 'with the latest messages listed');
  await pg.getByTestId('growth-messaging').screenshot({ path: '/tmp/dev/growth5-messaging-desktop.png' });
  await pg.getByTestId('channel-EMAIL').click();
  await pg.waitForTimeout(600);
  log(/not set up/i.test(await pg.getByTestId('growth-messaging').innerText()), 'on the screen, email shows as not set up on this server');
  await pg.getByTestId('body-WELCOME').fill('No stop link here');
  await pg.getByTestId('save-WELCOME').click();
  await pg.getByRole('alert').first().waitFor();
  log(/stop/i.test(await pg.getByTestId('tpl-WELCOME').innerText()), 'saving a message without the stop link shows why');
  const mp = await (await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' })).newPage();
  await mp.context().addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  await mp.goto(`${B}/admin/growth`);
  await mp.getByTestId('growth-messaging').waitFor();
  log(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'on a phone: no sideways scroll');
  await mp.getByTestId('outbox').scrollIntoViewIfNeeded();
  await mp.screenshot({ path: '/tmp/dev/growth5-messaging-phone.png' });
  await br.close();
  stub.close();
  const [f0, k0] = orig.split('|');
  psql(`update "Course" set "isFree"=${f0}, "priceKobo"=${k0 === '' ? 'null' : k0} where id='${own}'`);
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); stub.close(); process.exit(1); });
