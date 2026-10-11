const { B, log, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const call = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, redirect: 'manual' }); let d = null; const t = await r.text(); try { d = JSON.parse(t); } catch {} return { s: r.status, d, t, loc: r.headers.get('location') }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const tr = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const emp = jar(await cookiesFor('/api/auth/employer-login', 'employer@dev.test'));
  const tid = psql(`select id from "Trainee" where email='t0@dev.test'`);
  const orig = psql(`select handle from "Profile" where "traineeId"='${tid}'`);
  const origVis = psql(`select "profileVisibility" from "Trainee" where id='${tid}'`);
  const origUser = psql(`select coalesce(username,'') from "Trainee" where id='${tid}'`);
  psql(`delete from "HandleChangeRequest"; delete from "ProfileHandleHistory"; update "Trainee" set "profileVisibility"='PUBLIC' where id='${tid}'`);
  let r = await call('GET', '/api/profiles/handle-requests', tr); log(r.s === 200 && r.d.handle === orig, 'a member sees their handle and no requests: @' + orig);
  r = await call('GET', '/api/profiles/handle-requests'); log(r.s === 401, 'a visitor cannot use the request API');
  const ask = (h, reason = 'My professional name is Ada Obi and I want it on my profile.') => call('POST', '/api/profiles/handle-requests', tr, { handle: h, reason });
  r = await ask('ada-obi', ''); log(r.s === 400, 'a request without a reason is refused: ' + r.d?.error);
  r = await ask('feed'); log(r.s === 400, 'a reserved handle is refused');
  const orgH = psql(`select handle from "Profile" where kind='TRAINING_ORG' limit 1`);
  r = await ask(orgH); log(r.s === 409, 'a handle someone else holds is refused (409)');
  r = await ask('ada-obi'); log(r.s === 201, 'a valid request is sent');
  const reqId = r.d?.id;
  r = await ask('ada-obi-2'); log(r.s === 409, 'only one request can wait at a time');
  log(psql(`select handle from "Profile" where "traineeId"='${tid}'`) === orig, 'nothing changed yet: the handle is still @' + orig);
  // staff and others cannot decide
  for (const [who, c] of [['trainee', tr], ['employer', emp], ['ordinary staff', staff], ['visitor', null]]) { const x = await call('POST', `/api/admin/handle-requests/${reqId}`, c, { action: 'approve' }); const y = await call('GET', '/api/admin/handle-requests', c); if (![401, 403].includes(x.s) || ![401, 403].includes(y.s)) log(false, `${who} reached the decision routes (${x.s}/${y.s})`); else log(true, `${who} cannot see or decide requests`); }
  r = await call('GET', '/api/admin/handle-requests?status=PENDING', sa); log(r.s === 200 && r.d.requests.some((q) => q.id === reqId && q.reason.includes('Ada Obi')), 'the super admin sees the request with its reason');
  r = await call('POST', `/api/admin/handle-requests/${reqId}`, sa, { action: 'reject' }); log(r.s === 400, 'declining without a reason is refused');
  r = await call('POST', `/api/admin/handle-requests/${reqId}`, sa, { action: 'reject', note: 'Please use your full legal name.' }); log(r.s === 200, 'declined with a reason');
  r = await call('GET', '/api/profiles/handle-requests', tr); log(r.d.requests[0].status === 'REJECTED' && /legal name/.test(r.d.requests[0].decisionNote), 'the member sees it was declined and why');
  log(psql(`select handle from "Profile" where "traineeId"='${tid}'`) === orig, 'declining changed nothing');
  // cancel
  r = await ask('ada-obi'); const id2 = r.d.id; r = await call('DELETE', `/api/profiles/handle-requests?id=${id2}`, tr); log(r.s === 200, 'a member can withdraw a waiting request');
  r = await call('POST', `/api/admin/handle-requests/${id2}`, sa, { action: 'approve' }); log(r.s === 404, 'a withdrawn request cannot be approved');
  // approve
  r = await ask('ada-obi'); const id3 = r.d.id;
  r = await call('POST', `/api/admin/handle-requests/${id3}`, sa, { action: 'approve' }); log(r.s === 200, 'approved by the super admin');
  log(psql(`select handle from "Profile" where "traineeId"='${tid}'`) === 'ada-obi', 'the handle is now @ada-obi');
  log(psql(`select username from "Trainee" where id='${tid}'`) === 'ada-obi', 'the username moved with it');
  log(psql(`select count(*) from "ProfileHandleHistory" where handle='${orig}'`) === '1', 'the old handle is kept in history');
  const oldPage = await call('GET', '/@' + orig); log(oldPage.s === 308 && /\/@ada-obi$/.test(oldPage.loc || ''), 'the old address forwards permanently (308) to /@ada-obi: ' + oldPage.s + ' ' + oldPage.loc);
  const newPage = await call('GET', '/@ada-obi'); log(newPage.s === 200, 'the new address opens');
  const legacy = await call('GET', '/profile/u/' + orig); log([307, 308].includes(legacy.s) && /\/@ada-obi$/.test(legacy.loc || ''), 'the older /profile/u address of the old handle also forwards');
  // reserved for the owner
  r = await call('POST', '/api/profiles/handle-requests', emp, { handle: orig, reason: 'I would like this handle for my company.' }); log(r.s === 409, 'nobody else can take the old handle');
  const chk = await (await fetch(B + '/api/profiles/handle?h=' + orig)).json(); log(chk.available === false, 'the handle check says the old handle is unavailable');
  // search
  const byOld = await call('GET', '/search?q=' + encodeURIComponent(orig)); log(byOld.s === 200 && /Formerly/.test(byOld.t) && /\/@ada-obi/.test(byOld.t), 'searching the OLD handle finds the person, marked "Formerly", linking to the new address');
  const byNew = await call('GET', '/search?q=ada-obi'); log(/\/@ada-obi/.test(byNew.t) && !/Formerly/.test(byNew.t), 'searching the new handle finds them without the "Formerly" note');
  psql(`update "Trainee" set "profileVisibility"='PRIVATE' where id='${tid}'`);
  const hidden = await call('GET', '/search?q=' + encodeURIComponent(orig)); log(!/\/@ada-obi/.test(hidden.t), 'once the profile is private, search no longer shows it (old or new handle)');
  const hiddenOld = await call('GET', '/@' + orig); log(hiddenOld.s === 404, 'and the old address is a 404 too (nothing is confirmed)');
  psql(`update "Trainee" set "profileVisibility"='PUBLIC' where id='${tid}'`);
  // reclaim own old handle
  r = await call('POST', '/api/profiles/handle-requests', tr, { handle: orig, reason: 'Changed my mind, I want my original handle back.' }); const id4 = r.d?.id; log(r.s === 201, 'the owner may ask for their own old handle back');
  r = await call('POST', `/api/admin/handle-requests/${id4}`, sa, { action: 'approve' }); log(r.s === 200 && psql(`select handle from "Profile" where "traineeId"='${tid}'`) === orig, 'and gets it back');
  log(psql(`select count(*) from "ProfileHandleHistory" where handle='${orig}'`) === '0' && psql(`select count(*) from "ProfileHandleHistory" where handle='ada-obi'`) === '1', 'history now holds ada-obi and no longer lists the restored handle');
  // direct change for an organization
  const orgBefore = psql(`select handle from "Profile" where kind='TRAINING_ORG' and handle='northwind-academy'`);
  if (orgBefore) {
    r = await call('POST', '/api/admin/handle-requests/direct', sa, { currentHandle: 'northwind-academy', handle: 'northwind-ng', reason: 'Shorter name agreed with the organization.' }); log(r.s === 200, 'a super admin can change an organization handle directly');
    const o = await call('GET', '/@northwind-academy'); log(o.s === 308 && /northwind-ng$/.test(o.loc || ''), 'the organization old address forwards');
    r = await call('POST', '/api/admin/handle-requests/direct', tr, { currentHandle: 'northwind-ng', handle: 'x-hack', reason: 'trying to cheat the system' }); log([401, 403].includes(r.s), 'a member cannot use the direct change');
  }
  // restore
  psql(`update "Trainee" set "profileVisibility"='${origVis}', username=${origUser ? `'${origUser}'` : 'null'} where id='${tid}'`);
  psql(`update "Profile" set handle='${orig}' where "traineeId"='${tid}'`);
  if (orgBefore) psql(`update "Profile" set handle='northwind-academy' where handle='northwind-ng'`);
  psql(`delete from "HandleChangeRequest"; delete from "ProfileHandleHistory"; delete from "NotificationLog" where type like 'HANDLE_CHANGE%'; delete from "UserNotification" where type like 'HANDLE_CHANGE%'`);
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
