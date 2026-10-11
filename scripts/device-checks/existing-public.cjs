const { B, log, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  log(psql(`select count(*) from "Trainee" where "profileVisibility"<>'PUBLIC'`) === '0', 'every existing member is public');
  log(psql(`select count(*) from "Employer" where "profileVisibility"<>'PUBLIC'`) === '0', 'every existing employer is public');
  log(psql(`select count(*) from "User" where "profileVisibility"='PUBLIC'`) === '0', 'no staff profile was made public');
  // a member can still choose private afterwards
  const t = psql(`select email from "Trainee" where email='t3@dev.test'`);
  psql(`update "Trainee" set "profileVisibility"='PRIVATE' where email='${t}'`);
  const h = psql(`select p.handle from "Profile" p join "Trainee" tr on tr.id=p."traineeId" where tr.email='${t}'`);
  const r = await (await fetch(B + '/@' + h)).text();
  log(/keeps the rest of their profile private/.test(r.replace(/<!-- -->/g, '')), 'a member who chooses private afterwards is private again');
  psql(`update "Trainee" set "profileVisibility"='PUBLIC' where email='${t}'`);
})().catch((e) => { console.error(e); process.exit(1); });
