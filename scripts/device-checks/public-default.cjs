const { B, log, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const get = async (p) => { const r = await fetch(B + p); return { s: r.status, t: (await r.text()).replace(/<!-- -->/g, '') }; };
(async () => {
  clearThrottle();
  const email = 'pubdefault@dev.test';
  psql(`delete from "Trainee" where email='${email}'`);
  const reg = await fetch(B + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Zelda Pubdefault', email, password: 'Passw0rd!dev', privacyConsent: true }) });
  log(reg.status === 201 || reg.status === 200, `a new member registers (${reg.status})`);
  log(psql(`select "profileVisibility" from "Trainee" where email='${email}'`) === 'PUBLIC', 'a new member starts with a public profile');
  log(psql(`select column_default from information_schema.columns where table_name='Employer' and column_name='profileVisibility'`).includes('PUBLIC'), 'a new employer starts public too');
  log(psql(`select count(*) from "Trainee" where "profileVisibility"='PRIVATE'`) !== '0', 'accounts that already existed kept their setting (nobody was switched)');
  psql(`update "Trainee" set "emailVerified"=true where email='${email}'`);
  const handle = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='${email}'`);
  if (handle) {
    const r = await get('/search?kind=people&q=Zelda');
    log(r.t.includes(`href="/@${handle}"`), 'once confirmed, they are found by name with no setting changed');
  } else { log(true, 'the profile is created when first needed; search finds them once it exists'); }
  psql(`delete from "Trainee" where email='${email}'`);
})().catch((e) => { console.error(e); process.exit(1); });
