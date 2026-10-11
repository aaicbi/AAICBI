const { B, log, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const get = async (p, cookie) => { const r = await fetch(B + p, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' }); return { s: r.status, loc: r.headers.get('location'), t: await r.text() }; };
(async () => {
  clearThrottle();
  const tr = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const me = (await (await fetch(B + '/api/trainee/profile', { headers: { Cookie: tr } })).json());
  log(!!me.handle, 'the member settings API now returns their handle: @' + me.handle);
  const tid = psql(`select id from "Trainee" where email='t0@dev.test'`);
  const origUser = me.username; const origHandle = me.handle; const origVis = me.profileVisibility;
  const put = async (patch) => { const body = { username: me.username ?? '', location: me.location ?? '', linkedinUrl: me.linkedinUrl ?? '', githubUrl: me.githubUrl ?? '', portfolioUrl: me.portfolioUrl ?? '', currentEmploymentStatus: me.currentEmploymentStatus ?? 'STUDENT', openToWork: me.openToWork, availabilityTypes: me.availabilityTypes, profileVisibility: me.profileVisibility, ...patch }; const r = await fetch(B + '/api/trainee/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: tr }, body: JSON.stringify(body) }); return { s: r.status, d: await r.json().catch(() => ({})) }; };
  // make public with a username
  let r = await put({ username: 'ada-lovelace-t0', profileVisibility: 'PUBLIC' });
  log(r.s === 200, 'saving a username works: ' + r.s + ' ' + JSON.stringify(r.d).slice(0, 80));
  log(psql(`select handle from "Profile" where "traineeId"='${tid}'`) === 'ada-lovelace-t0', 'the handle followed the username');
  let old = await get('/profile/u/ada-lovelace-t0');
  log([307, 308].includes(old.s) && old.loc && old.loc.endsWith('/@ada-lovelace-t0'), 'the old address forwards to /@ada-lovelace-t0: ' + old.s + ' ' + old.loc);
  const full = await get('/@ada-lovelace-t0');
  log(full.s === 200 && />Member</.test(full.t), 'the new address shows the profile');
  r = await put({ username: 'feed', profileVisibility: 'PUBLIC' }); log(r.s === 400, 'a reserved username is refused: ' + JSON.stringify(r.d).slice(0, 90));
  const other = psql(`select handle from "Profile" where kind='TRAINING_ORG' limit 1`);
  r = await put({ username: other, profileVisibility: 'PUBLIC' }); log(r.s === 409, 'a username that is someone else\'s handle is refused (409)');
  // hidden stays hidden, no redirect
  await put({ username: 'ada-lovelace-t0', profileVisibility: 'PRIVATE' });
  old = await get('/profile/u/ada-lovelace-t0');
  const unknown = await get('/profile/u/no-such-person-zzz');
  log(old.s === 200 && unknown.s === 200 && /could not be found/.test(old.t) && /could not be found/.test(unknown.t), 'a hidden profile and an unknown one look the same at the old address (no redirect)');
  const hid = await get('/@ada-lovelace-t0'); log(hid.s === 404, 'hidden profile is a 404 at the new address');
  const own = await get('/@ada-lovelace-t0', tr); log(own.s === 200, 'the owner can still see it');
  // details
  await put({ username: 'ada-lovelace-t0', profileVisibility: 'PUBLIC' });
  const sk = psql(`select count(*) from "TraineeSkill" where "traineeId"='${tid}'`);
  const page = await get('/@ada-lovelace-t0');
  log(Number(sk) === 0 || /Skills/.test(page.t), `full details render on the new page (skills in db: ${sk})`);
  // restore
  psql(`update "Trainee" set username=${origUser ? `'${origUser}'` : 'null'}, "profileVisibility"='${origVis}' where id='${tid}'`);
  psql(`update "Profile" set handle='${origHandle}' where "traineeId"='${tid}'`);
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
