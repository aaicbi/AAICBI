// Growth funnel: the WhatsApp connection a Super Admin controls from the Growth page. Runs against a stand-in for Meta's Cloud API on port 4891.
// The server under test is started with only WHATSAPP_API_BASE=http://127.0.0.1:4891 and CRON_SECRET=cron-secret (NO other WHATSAPP_* values),
// so everything below goes through credentials pasted into the screen. Checks: off by default, validation, secrets sealed in the database and never
// returned, enabling needs everything, test connection, sending with the saved credentials, off holds messages and on releases them, the webhook
// follows the saved verify token and app secret, replacing and removing credentials, the audit log, who may use it, and the screen.
const http = require('http');
const crypto = require('crypto');
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body, headers = {}) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CRON = 'cron-secret';
const TOKEN = 'EAAGm0PX4ZCpsBAabcdefghij1234567890SECRETTOKEN', PHONE_ID = '109876543210', APP1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90', APP2 = '0f9e8d7c6b5a49382716a5b4c3d2e1f0';

const received = [];
const stub = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', () => {
    received.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    const ok = req.headers.authorization === `Bearer ${TOKEN}`;
    if (!ok) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Invalid OAuth access token.' } })); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'GET') return res.end(JSON.stringify({ display_phone_number: '+234 803 000 0000', verified_name: 'AAICBI Test', id: PHONE_ID }));
    res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.SAVED1' }] }));
  });
});

(async () => {
  await new Promise((r) => stub.listen(4891, '127.0.0.1', r));
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthMessage', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  const orig = psql(`select "isFree"::text || '|' || coalesce("priceKobo"::text,'') from "Course" where id='${own}'`);
  psql(`update "Course" set published=true, status='PUBLISHED', "isFree"=false, "priceKobo"=4500000 where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const ST = await jar('/api/auth/login', 'staff@dev.test');
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  const W = (b) => call(S, 'POST', '/api/admin/growth/whatsapp', b);
  const status = async () => (await call(S, 'GET', '/api/admin/growth/whatsapp')).j;
  const msg = (b) => call(S, 'POST', '/api/admin/growth/messaging', b);
  const person = async (phone) => {
    const st = (await call(null, 'POST', `/api/public/growth/${slug}/play`, {})).j; let s = st.state;
    while (s.status === 'question') s = (await call(null, 'POST', `/api/public/growth/${slug}/answer`, { token: st.token, choice: s.question.options[0].key })).j.state;
    await call(null, 'POST', `/api/public/growth/${slug}/save`, { token: st.token, phone, consent: true });
    return psql(`select l.id from "GrowthLead" l join "GrowthGuestPlay" p on p.id=l."playId" where p.token='${st.token}'`);
  };
  const sign = (raw, secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const hook = (payload, secret) => { const raw = JSON.stringify(payload); return call(null, 'POST', '/api/webhooks/whatsapp', raw, { 'x-hub-signature-256': sign(raw, secret) }); };

  // ---- off by default, and who may touch it
  let st0 = await status();
  log(st0.enabled === false && st0.source === 'none' && !st0.accessToken.set && !st0.appSecret.set && st0.phoneNumberId === null && st0.missing.length === 3, 'starts off with nothing saved');
  log((await call(ST, 'GET', '/api/admin/growth/whatsapp')).s === 403 && (await call(null, 'GET', '/api/admin/growth/whatsapp')).s === 401 && (await call(ST, 'POST', '/api/admin/growth/whatsapp', { action: 'clear' })).s === 403, 'only a Super Admin can see or change it');
  let r = await W({ action: 'enable', enabled: true });
  log(r.s === 409 && /access token/.test(r.j.error) && /phone number ID/.test(r.j.error) && /app secret/.test(r.j.error), 'it cannot be switched on with nothing saved, and says what is missing');
  r = await W({ action: 'test' });
  log(r.s === 409, 'there is nothing to test yet');

  // ---- validation
  log((await W({ action: 'save', accessToken: 'short' })).s === 400, 'a token that is too short is refused');
  log((await W({ action: 'save', accessToken: 'has spaces in it so it cannot possibly be right' })).s === 400, 'a token with spaces is refused');
  log((await W({ action: 'save', phoneNumberId: '+234 803 000 0000' })).s === 400, 'a phone number is refused where the ID is wanted');
  log((await W({ action: 'save', appSecret: 'tooshort' })).s === 400 && (await W({ action: 'save', verifyToken: 'a b' })).s === 400 && (await W({ action: 'save', templateLang: 'English' })).s === 400, 'bad app secret, verify token and language are refused');
  log((await W({ action: 'save' })).s === 400 && (await W({ action: 'save', accessToken: '   ' })).s === 400, 'saving nothing is refused');
  log(psql(`select count(*) from "GrowthSetting" where "scopeType"='WHATSAPP'`) === '0', 'refused saves store nothing');

  // ---- saving: sealed, and never returned
  r = await W({ action: 'save', accessToken: TOKEN, phoneNumberId: PHONE_ID });
  log(r.s === 200 && r.j.status.accessToken.set && r.j.status.accessToken.hint === '••••OKEN' && r.j.status.phoneNumberId === PHONE_ID, 'saved: the screen shows the end of the token and the phone number ID');
  log(!r.t.includes(TOKEN) && !(await call(S, 'GET', '/api/admin/growth/whatsapp')).t.includes(TOKEN), 'the token is never in any answer');
  const stored = psql(`select config::text from "GrowthSetting" where "scopeType"='WHATSAPP'`);
  log(!stored.includes(TOKEN) && !stored.includes('SECRETTOKEN') && /"accessToken": "v1\./.test(stored), 'in the database it is encrypted, not plain text');
  r = await W({ action: 'enable', enabled: true });
  log(r.s === 409 && /app secret/.test(r.j.error) && !/access token/.test(r.j.error), 'still cannot be switched on without the app secret');
  r = await W({ action: 'save', appSecret: APP1 });
  log(r.s === 200 && r.j.status.appSecret.hint === '••••' + APP1.slice(-4) && !r.t.includes(APP1), 'app secret saved, shown only by its last four characters');
  log((await status()).verifyToken === null, 'no verify token yet');

  // ---- test connection (sends nothing)
  received.length = 0;
  r = await W({ action: 'test' });
  log(r.s === 200 && r.j.test.ok && r.j.test.displayNumber === '+234 803 000 0000' && r.j.test.verifiedName === 'AAICBI Test', 'test connection reaches Meta and reports the business and number');
  log(received.length === 1 && received[0].method === 'GET' && received[0].url.startsWith(`/${PHONE_ID}?fields=`) && received[0].auth === `Bearer ${TOKEN}` && !received.some((x) => x.method === 'POST'), 'it used the saved token and sent no message');
  await W({ action: 'save', accessToken: TOKEN.replace('SECRETTOKEN', 'WRONGTOKENXX') });
  r = await W({ action: 'test' });
  log(r.s === 200 && r.j.test.ok === false && /Invalid OAuth/.test(r.j.test.error) && !r.t.includes('WRONGTOKEN'), 'a wrong token is reported with Meta\'s own words, without echoing it');
  await W({ action: 'save', accessToken: TOKEN });

  // ---- switching on
  r = await W({ action: 'enable', enabled: true });
  log(r.s === 200 && r.j.status.enabled === true, 'with everything saved it switches on');
  const vt = (await status()).verifyToken;
  log(/^[A-Za-z0-9_-]{20,}$/.test(vt || ''), 'and a verify token was made for pasting into Meta (' + (vt || '').slice(0, 6) + '...)');
  const h = (await call(null, 'GET', `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${vt}&hub.challenge=abc123`));
  log(h.s === 200 && h.t === 'abc123' && (await call(null, 'GET', '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x')).s === 403, "Meta's check passes with the saved verify token and fails with another");

  // ---- sending uses the saved credentials; off holds, on releases
  r = await msg({ action: 'settings', channel: 'WHATSAPP', dailyCap: 50, quiet: { start: 0, end: 0 }, enabled: true });
  log(r.s === 200 && r.j.settings.channel === 'WHATSAPP' && r.j.providers.whatsapp.configured === true, 'messaging can use WhatsApp now');
  received.length = 0;
  const lead1 = await person('0803 111 2222');
  let sent = false; for (let i = 0; i < 40 && !sent; i++) { sent = psql(`select status from "GrowthMessage" where "leadId"='${lead1}'`) === 'SENT'; if (!sent) await sleep(150); }
  const post = received.find((x) => x.method === 'POST');
  log(sent && post && post.url === `/${PHONE_ID}/messages` && post.auth === `Bearer ${TOKEN}`, 'a welcome went out with the saved token and phone number ID');
  await W({ action: 'enable', enabled: false });
  received.length = 0;
  const lead2 = await person('0803 333 4444');
  await sleep(1000);
  await call(null, 'GET', '/api/cron/growth-messages', undefined, { Authorization: `Bearer ${CRON}` });
  log(received.length === 0 && psql(`select status from "GrowthMessage" where "leadId"='${lead2}'`) === 'QUEUED', 'switched off: nothing is sent and the message waits, still queued');
  log((await msg({ action: 'settings', enabled: true, channel: 'WHATSAPP' })).s === 409, 'and messaging cannot be pointed at WhatsApp while it is off');
  await W({ action: 'enable', enabled: true });
  await call(null, 'GET', '/api/cron/growth-messages', undefined, { Authorization: `Bearer ${CRON}` });
  sent = false; for (let i = 0; i < 40 && !sent; i++) { sent = psql(`select status from "GrowthMessage" where "leadId"='${lead2}'`) === 'SENT'; if (!sent) await sleep(150); }
  log(sent, 'switched back on: the waiting message goes');

  // ---- the webhook follows the saved app secret
  const receipt = (id) => ({ entry: [{ changes: [{ value: { statuses: [{ id, status: 'delivered' }] } }] }] });
  log((await hook(receipt('wamid.SAVED1'), APP1)).s === 200, 'a receipt signed with the saved app secret is accepted');
  log((await hook(receipt('wamid.SAVED1'), 'someone-elses-secret-0000000000')).s === 401, 'one signed with anything else is refused');
  await W({ action: 'save', appSecret: APP2 });
  log((await hook(receipt('wamid.SAVED1'), APP1)).s === 401 && (await hook(receipt('wamid.SAVED1'), APP2)).s === 200, 'replacing the app secret takes effect at once');
  log((await W({ action: 'generateVerifyToken' })).s === 200 && (await status()).verifyToken !== vt, 'a new verify token can be made');

  // ---- audit never holds a secret
  const auditText = psql(`select string_agg(action || ' ' || coalesce(detail,''), ' | ') from "GrowthAudit" where "scopeType"='WHATSAPP'`);
  log(/WHATSAPP_SAVED/.test(auditText) && /WHATSAPP_ON/.test(auditText) && /WHATSAPP_OFF/.test(auditText), 'saves and switches are in the log');
  log(!auditText.includes(TOKEN) && !auditText.includes(APP1) && !auditText.includes(APP2) && !auditText.includes('SECRETTOKEN'), 'but no secret is');

  // ---- the screen
  const br = await launch();
  const dctx = await br.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
  await dctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  const pg = await dctx.newPage();
  await pg.goto(`${B}/admin/growth`);
  await pg.getByTestId('growth-whatsapp').waitFor();
  const text = await pg.getByTestId('growth-whatsapp').innerText();
  log(/Saved ••••OKEN/.test(text) && /Saved ••••/.test(text) && !text.includes(TOKEN) && !text.includes(APP2), 'the screen shows what is saved without revealing it');
  log((await pg.getByTestId('wa-url').innerText()).endsWith('/api/webhooks/whatsapp'), 'and the callback URL to give Meta');
  log((await pg.getByTestId('wa-token').getAttribute('type')) === 'password' && (await pg.getByTestId('wa-secret').getAttribute('type')) === 'password', 'secret boxes hide what is typed');
  await pg.getByTestId('wa-test').click();
  await pg.getByTestId('wa-test-result').waitFor();
  log(/Connected/.test(await pg.getByTestId('wa-test-result').innerText()), 'Test connection works from the screen');
  await pg.getByTestId('wa-token').fill('too short');
  await pg.getByTestId('wa-save').click();
  await pg.getByTestId('wa-problem').waitFor();
  log(/access token does not look right/.test(await pg.getByTestId('wa-problem').innerText()), 'a bad paste is explained on the screen');
  await pg.getByTestId('wa-token').fill('');
  await pg.getByTestId('wa-lang').fill('en_GB');
  await pg.getByTestId('wa-save').click();
  await pg.waitForTimeout(800);
  log(psql(`select config->>'templateLang' from "GrowthSetting" where "scopeType"='WHATSAPP'`) === 'en_GB', 'a field can be changed on its own without retyping the secrets');
  log((await pg.getByTestId('wa-token').inputValue()) === '', 'the boxes empty after saving');
  await pg.getByTestId('growth-whatsapp').screenshot({ path: '/tmp/dev/growth9-desktop.png' });
  pg.on('dialog', (d) => d.accept());
  await pg.getByTestId('wa-clear').click();
  await pg.waitForTimeout(900);
  const after = await status();
  log(after.enabled === false && !after.accessToken.set && !after.appSecret.set && after.phoneNumberId === null && after.verifyToken === null, 'Remove credentials forgets everything and switches WhatsApp off');
  log((await call(null, 'GET', `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${vt}&hub.challenge=x`)).s === 403 && (await hook(receipt('x'), APP2)).s === 503, 'and the webhook stops answering');
  log((await msg({ action: 'settings', enabled: true, channel: 'WHATSAPP' })).s === 409, 'and WhatsApp cannot be chosen for follow-ups');
  const pm = await (await br.newContext({ ...device('iPhone 13'), serviceWorkers: 'block' })).newPage();
  await pm.context().addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...(await cookiesFor('/api/auth/login', 'super@dev.test'))]);
  await pm.goto(`${B}/admin/growth`);
  await pm.getByTestId('growth-whatsapp').waitFor();
  log(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  await pm.getByTestId('growth-whatsapp').screenshot({ path: '/tmp/dev/growth9-phone.png' });
  await br.close();

  psql(`delete from "GrowthSetting" where "scopeType"='WHATSAPP'`);
  const [f0, k0] = orig.split('|'); psql(`update "Course" set "isFree"=${f0}, "priceKobo"=${k0 === '' ? 'null' : k0} where id='${own}'`);
  stub.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); stub.close(); process.exit(1); });
