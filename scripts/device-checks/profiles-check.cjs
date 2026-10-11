const { B, log, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const get = async (p, cookie) => { const r = await fetch(B + p, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' }); return { s: r.status, t: await r.text() }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const orgPublic = psql(`select p.handle from "Profile" p join "OrganizationPublicProfile" o on o."trainingOrganizationId"=p."trainingOrganizationId" join "TrainingOrganization" t on t.id=p."trainingOrganizationId" where o."publicEnabled" and t."approvalState"='APPROVED' limit 1`);
  const traPub = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t."profileVisibility"='PUBLIC' limit 1`);
  const traPriv = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t."profileVisibility"='PRIVATE' limit 1`);
  const staffPriv = psql(`select p.handle from "Profile" p join "User" u on u.id=p."userId" where u."profileVisibility"='PRIVATE' limit 1`);
  const inv = psql(`select handle from "Profile" where kind='INVESTOR' limit 1`);
  console.log({ orgPublic, traPub, traPriv, staffPriv, inv });
  if (orgPublic) { const r = await get('/@' + orgPublic); log(r.s === 200 && /Training organization/.test(r.t), `public organization opens at /@${orgPublic} while signed out`); }
  if (traPub) { const r = await get('/@' + traPub); log(r.s === 200 && />Member</.test(r.t), `public member opens at /@${traPub}`); }
  const missing = await get('/@no-such-handle-xyz');
  log(missing.s === 404, 'an unknown handle is a 404');
  if (traPriv) { const r = await get('/@' + traPriv); log(r.s === 404, 'a private member looks exactly like an unknown one (404)'); const own = await get('/@' + traPriv, sa); log(own.s === 200, 'staff can still open a private member profile'); }
  if (staffPriv) { const r = await get('/@' + staffPriv); log(r.s === 404, 'a private staff profile is hidden from visitors'); }
  if (inv) { const r = await get('/@' + inv); log(r.s === 404, 'an investor profile is hidden from visitors'); const s = await get('/@' + inv, sa); log(s.s === 200, 'an investor profile is visible to staff'); }
  let h = await (await fetch(B + '/api/profiles/handle?h=feed')).json(); log(h.available === false, 'reserved handle is unavailable: ' + h.error);
  h = await (await fetch(B + '/api/profiles/handle?h=' + (orgPublic || 'x'))).json(); log(h.available === false, 'a taken handle is unavailable');
  h = await (await fetch(B + '/api/profiles/handle?h=brand-new-handle-1')).json(); log(h.available === true, 'a fresh handle is available');
  log(psql(`select count(*) from (select handle from "Profile" group by handle having count(*)>1) x`) === '0', 'no duplicate handles');
  const all = Number(psql(`select (select count(*) from "Trainee")+(select count(*) from "Employer")+(select count(*) from "Investor")+(select count(*) from "TrainingOrganization")+(select count(*) from "User" u where not exists (select 1 from "TrainingOrganization" t where t."staffUserId"=u.id))`));
  log(Number(psql(`select count(*) from "Profile"`)) === all, `every account has exactly one profile (${all})`);
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
