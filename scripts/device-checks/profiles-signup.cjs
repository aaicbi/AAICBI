const { B, log, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
(async () => {
  clearThrottle();
  const email = `signup-profile-${Date.now()}@dev.test`;
  const r = await fetch(B + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ngozi Eze', email, phone: '+2348012345678', password: 'Passw0rd!dev1', privacyConsent: true }) });
  const d = await r.json().catch(() => ({}));
  log(r.status < 300, 'registration still works: ' + r.status + ' ' + JSON.stringify(d).slice(0, 80));
  const h = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='${email}'`);
  log(h === 'ngozi-eze' || /^ngozi-eze/.test(h), 'the new account got a profile at sign-up: @' + h);
  psql(`delete from "Profile" where "traineeId" in (select id from "Trainee" where email='${email}'); delete from "Trainee" where email='${email}'`);
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
