const { B, log, cookiesFor, clearThrottle } = require('./lib');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const get = async (base, p, opt = {}) => { const r = await fetch(base + p, { redirect: 'manual', ...opt }); return { s: r.status, h: r.headers, t: await r.text() }; };
(async () => {
  clearThrottle(); psql(`delete from "StaffSignInLog"`);
  const NEW = '/internal-access/staff-sign-in';
  let r = await get(B, NEW); log(r.s === 200 && /Staff Login/.test(r.t), 'the staff sign-in address serves the staff form');
  log(/noindex/.test(r.h.get('x-robots-tag') || '') && /noindex/.test(r.t), 'it is marked noindex (header and page)');
  r = await get(B, '/staff-access'); log(r.s === 404, 'the internal page cannot be reached directly (404)');
  r = await get(B, '/admin/login'); log(r.s === 200, 'the older /admin/login still works');
  log(/noindex/.test(r.h.get('x-robots-tag') || ''), '/admin/login is noindex too');
  for (const p of ['/', '/courses', '/courses/upcoming', '/feed', '/search', '/trainee/login', '/trainee/register', '/employer/login', '/org/login', '/investor/login', '/organizations', '/jobs']) {
    const x = await get(B, p); log(x.s < 400 && !/admin\/login|Staff Login|internal-access|staff-access/.test(x.t), `public page ${p} does not reveal the staff sign-in`);
  }
  r = await get(B, '/sitemap.xml'); log(r.s === 404, 'there is no public sitemap that could list it');
  r = await get(B, '/admin/dashboard'); log(r.s === 307 || r.s === 302 || r.s === 308, 'an unauthenticated staff page redirects (to the sign-in that is switched on)');
  // sign-in works and is logged
  const login = (email, password) => fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'check-script/1.0' }, body: JSON.stringify({ email, password }) });
  let l = await login('super@dev.test', 'wrong-password-1'); log(l.status === 401, 'a wrong password is refused');
  l = await login('nobody@dev.test', 'whatever-1'); log(l.status === 401, 'an unknown email gets the same refusal');
  l = await login('super@dev.test', 'Passw0rd!dev'); const sa = (l.headers.getSetCookie ? l.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
  const rows = psql(`select outcome from "StaffSignInLog" order by at`).split('\n'); log(rows.includes('BAD_CREDENTIALS') && rows.includes('SUCCESS'), `sign-in attempts are recorded (${rows.join(', ')})`);
  log(psql(`select count(*) from "StaffSignInLog" where "userAgent"='check-script/1.0'`) !== '0', 'the user agent is kept');
  // who can read the record
  r = await get(B, '/api/admin/security/sign-ins'); log(r.s === 401, 'a visitor cannot read the sign-in record');
  const t0 = (await cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await get(B, '/api/admin/security/sign-ins', { headers: { Cookie: t0 } }); log(r.s === 403, 'a trainee cannot read it');
  const rv = (await cookiesFor('/api/auth/login', 'staff@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await get(B, '/api/admin/security/sign-ins', { headers: { Cookie: rv } }); log(r.s === 403, 'ordinary staff cannot read it');
  r = await get(B, '/api/admin/security/sign-ins', { headers: { Cookie: sa } }); const d = JSON.parse(r.t); log(r.s === 200 && d.items.length >= 2 && !JSON.stringify(d).includes('passwordHash'), 'a super admin can read it, with no secrets in it');
  // staff areas stay closed to other roles
  for (const p of ['/api/admin/staff', '/api/admin/review']) { r = await get(B, p, { headers: { Cookie: t0 } }); log(r.s === 403 || r.s === 401, `a trainee is refused at ${p}`); }
  // rate limit is recorded
  clearThrottle(); for (let i = 0; i < 6; i++) await login('limit@dev.test', 'x-' + i);
  log(psql(`select count(*) from "StaffSignInLog" where outcome='RATE_LIMITED'`) !== '0', 'being blocked for too many attempts is recorded');
  clearThrottle(); psql(`delete from "StaffSignInLog"`);
})().catch((e) => { console.error(e); process.exit(1); });
