const { B, log, clearThrottle, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  clearThrottle();
  const email = 'vnotice@dev.test';
  psql(`delete from "Trainee" where email='${email}'`);
  const reg = await fetch(B + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Vera Notice', email, password: 'Passw0rd!dev', privacyConsent: true }) });
  log(reg.status < 300, `registered (${reg.status})`);
  psql(`update "Trainee" set "emailVerified"=true where email='${email}'`);
  const cookies = await cookiesFor('/api/auth/trainee-login', email);
  const ck = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const call = async (m) => { const r = await fetch(B + '/api/guide/visibility-notice', { method: m, headers: { cookie: ck } }); return { s: r.status, j: await r.json() }; };
  let r = await call('GET');
  log(r.j.show === true && r.j.target === 'profile-visibility', 'a public, untold member is told, pointing at the visibility control');
  log(!JSON.stringify(r.j).match(/password|postgres/i), 'the notice carries no secrets');
  await call('POST');
  log(psql(`select "profileNoticeAt" is not null from "Trainee" where email='${email}'`) === 't', 'acknowledging records it');
  r = await call('GET');
  log(r.j.show === false, 'they are not told twice');
  psql(`update "Trainee" set "profileNoticeAt"=null, "profileVisibility"='PRIVATE' where email='${email}'`);
  r = await call('GET');
  log(r.j.show === false, 'a private profile is never told it is public');
  const v = await fetch(B + '/api/guide/visibility-notice');
  log((await v.json()).show === false, 'a visitor gets nothing');
  const sc = await cookiesFor('/api/auth/login', 'super@dev.test').catch(() => null);
  if (sc) { const s = await fetch(B + '/api/guide/visibility-notice', { headers: { cookie: sc.map((c) => `${c.name}=${c.value}`).join('; ') } }); log((await s.json()).show === false, 'staff get nothing'); }
  psql(`delete from "Trainee" where email='${email}'`);
})().catch((e) => { console.error(e); process.exit(1); });
