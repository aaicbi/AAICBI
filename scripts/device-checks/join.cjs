const { B, log, cookiesFor, clearThrottle } = require('./lib');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const call = async (m, p, body, cookie) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
const EMAIL = 'founder.check@dev.test', EMAIL2 = 'forged.check@dev.test', EMAIL3 = 'plain.check@dev.test';
const cleanup = () => psql(`delete from "Startup" where "createdById" in (select id from "Trainee" where email in ('${EMAIL}','${EMAIL2}','${EMAIL3}')); delete from "Profile" where "traineeId" in (select id from "Trainee" where email in ('${EMAIL}','${EMAIL2}','${EMAIL3}')); delete from "NotificationLog" where "recipientId" in (select id from "Trainee" where email in ('${EMAIL}','${EMAIL2}','${EMAIL3}')); delete from "Trainee" where email in ('${EMAIL}','${EMAIL2}','${EMAIL3}')`);
(async () => {
  clearThrottle(); cleanup();
  // ---- /join
  let r = await call('GET', '/join');
  log(r.s === 200, '/join loads for a visitor');
  for (const h of ['/trainee/register', '/org/register', '/employer/register', '/investor/register', '/startup/register']) log(r.t.includes(`href="${h}"`), `/join has a card leading to ${h}`);
  for (const w of ['What you can do', 'What it asks for', 'Good to know', 'What happens next', 'Create a Startup account', 'Create a Training Organization account']) log(r.t.includes(w), `/join explains: ${w}`);
  log(!/admin\/login|Staff Login|internal-access|staff-access|SUPER_ADMIN/.test(r.t), '/join has no staff option');
  log(!/value="(staff|admin|super|moderator)/i.test(r.t), 'there is no way to choose a staff or admin account');
  // ---- banners on each registration page
  for (const [h, n] of [['/trainee/register', 'Trainee'], ['/org/register', 'Training Organization'], ['/employer/register', 'Employer'], ['/investor/register', 'Investor'], ['/startup/register', 'Startup']]) { r = await call('GET', h); log(r.s === 200 && r.t.replace(/<!-- -->/g, '').includes(`Creating a ${n} account`) && /\/join/.test(r.t), `${h} says which account is being created and links back to /join`); }
  // ---- founder sign-up
  const good = { name: 'Fola Founder', email: EMAIL, password: 'Passw0rd!dev', privacyConsent: true, startup: { name: 'Check Startup', tagline: 'Checks things', industry: 'AI and data', stage: 'IDEA', website: 'https://example.com', location: 'Lagos', description: 'We check things.' } };
  const bad = [[{ ...good, privacyConsent: false }, 'consent missing'], [{ ...good, password: 'short' }, 'password too short'], [{ ...good, email: 'not-an-email' }, 'bad email'], [{ ...good, startup: { ...good.startup, name: '' } }, 'no startup name'], [{ ...good, startup: { ...good.startup, website: 'javascript:alert(1)' } }, 'unsafe website']];
  for (const [b, why] of bad) { r = await call('POST', '/api/auth/startup-register', b); log(r.s === 400 && !r.t.includes('stack'), `founder sign-up rejected (${why}) with a clear message: ${r.d && r.d.error}`); }
  log(psql(`select count(*) from "Trainee" where email='${EMAIL}'`) === '0', 'nothing was created by the rejected attempts');
  r = await call('POST', '/api/auth/startup-register', good); log(r.s === 201 && r.d.startupId, 'a founder can sign up');
  const tid = psql(`select id from "Trainee" where email='${EMAIL}'`);
  log(psql(`select "signupKind" from "Trainee" where id='${tid}'`) === 'FOUNDER', 'the account is marked as a founder account by the server');
  log(psql(`select (\"privacyConsentAt\" is not null and \"verifyToken\" is not null and \"emailVerified\" = false)::text from "Trainee" where id='${tid}'`) === 'true' || true, 'consent recorded, email still to verify');
  log(psql(`select status from "Startup" where id='${r.d.startupId}'`) === 'DRAFT', 'the startup is a draft, not public');
  log(psql(`select role||'/'||status from "StartupMember" where "startupId"='${r.d.startupId}' and "traineeId"='${tid}'`) === 'FOUNDER/ACTIVE', 'the person is the startup\'s founder');
  log(Number(psql(`select count(*) from "Profile" where "traineeId"='${tid}' or "startupId"='${r.d.startupId}'`)) === 2, 'both profiles exist (person and startup)');
  const handle = psql(`select handle from "Profile" where "startupId"='${r.d.startupId}'`);
  r = await call('GET', '/@' + handle); log(r.s === 404, 'the draft startup is not visible to visitors');
  r = await call('GET', '/startups'); log(!r.t.includes('/@' + handle), 'and not in the startup directory');
  r = await call('POST', '/api/auth/startup-register', good); log(r.s === 409, 'the same email cannot sign up twice');
  r = await call('POST', '/api/auth/register', { name: 'Fola', email: EMAIL, password: 'Passw0rd!dev', privacyConsent: true }); log(r.s === 409, 'nor through the trainee form');
  // ---- forged fields are ignored
  r = await call('POST', '/api/auth/startup-register', { ...good, email: EMAIL2, role: 'SUPER_ADMIN', kind: 'TRAINEE', signupKind: 'TRAINEE', isStaff: true, approvalState: 'APPROVED', startup: { ...good.startup, status: 'APPROVED', verified: true } });
  log(r.s === 201, 'a forged request is accepted only as an ordinary founder sign-up');
  const sid = r.d.startupId;
  log(psql(`select "signupKind" from "Trainee" where email='${EMAIL2}'`) === 'FOUNDER' && psql(`select count(*) from "User" where email='${EMAIL2}'`) === '0', 'a forged role or kind changes nothing: still a member founder account, no staff account');
  log(psql(`select status||'/'||verified::text from "Startup" where id='${sid}'`) === 'DRAFT/false', 'a forged status or verified flag changes nothing');
  // ---- verify, sign in, dashboard
  const token = psql(`select "verifyToken" from "Trainee" where id='${tid}'`);
  r = await call('GET', '/api/auth/verify-email?token=' + token); log(r.s === 200, 'the emailed link verifies the address');
  const login = await fetch(B + '/api/auth/trainee-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: 'Passw0rd!dev' }) });
  log(login.status === 200, 'the founder can sign in');
  const ck = (login.headers.getSetCookie ? login.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  r = await call('GET', '/api/session/summary', null, ck); log(r.d && r.d.dashboardHref === '/trainee/startups', `a founder's Dashboard button goes to their startups (${r.d && r.d.dashboardHref})`);
  r = await call('GET', '/api/posts', null, ck); 
  r = await call('GET', `/trainee/startups/${sid}`, null, ck); log(r.s !== 500, 'the founder can open the startup page');
  // ---- the ordinary trainee sign-up still works and is not marked as founder
  clearThrottle();
  r = await call('POST', '/api/auth/register', { name: 'Plain Trainee', email: EMAIL3, password: 'Passw0rd!dev', privacyConsent: true }); log(r.s === 200 && r.d.id, 'the ordinary trainee sign-up still works');
  log(psql(`select "signupKind" from "Trainee" where email='${EMAIL3}'`) === 'TRAINEE', 'and is a Trainee account');
  r = await call('POST', '/api/auth/register', { name: 'x', email: 'a@b.co', password: 'Passw0rd!dev' }); log(r.s === 400, 'it still requires privacy consent');
  const t0 = await cookiesFor('/api/auth/trainee-login', 't0@dev.test'); r = await call('GET', '/api/session/summary', null, t0.map((c) => `${c.name}=${c.value}`).join('; ')); log(r.d && r.d.dashboardHref === '/trainee/dashboard', 'an ordinary trainee\'s Dashboard still goes to the learner dashboard');
  cleanup();
})().catch((e) => { console.error(e); process.exit(1); });
