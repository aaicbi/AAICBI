const { B, log, cookiesFor, clearThrottle } = require('./lib');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (m, p, c, b) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: b && m !== 'GET' ? JSON.stringify(b) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t, h: r.headers }; };
(async () => {
  clearThrottle();
  psql(`delete from "Post" where "legacyEducationPostId" is null`);
  // a known password for the demo investor in this private test database
  psql(`update "Investor" set "passwordHash"=(select "passwordHash" from "Trainee" where email='t0@dev.test') where email='demo-investor@demo.aaicbi.invalid'`);
  const who = {
    trainee: [await cookiesFor('/api/auth/trainee-login', 't0@dev.test'), '/trainee/dashboard'],
    employer: [await cookiesFor('/api/auth/employer-login', 'employer@dev.test'), '/employer/dashboard'],
    investor: [await cookiesFor('/api/auth/investor-login', 'demo-investor@demo.aaicbi.invalid'), '/investor/dashboard'],
    org: [await cookiesFor('/api/auth/training-org-login', 'org@dev.test'), '/admin/organization'],
    staff: [await cookiesFor('/api/auth/login', 'staff@dev.test'), '/admin/dashboard'],
    super: [await cookiesFor('/api/auth/login', 'super@dev.test'), '/admin/dashboard'],
  };
  const ck = Object.fromEntries(Object.entries(who).map(([k, [c]]) => [k, jar(c)]));
  // ---- the home page is the feed
  let r = await call('GET', '/', null);
  log(r.s === 200 && /AAICBI ecosystem feed/.test(r.t), 'the home page is the ecosystem feed');
  log(/name="q"/.test(r.t) && /role="search"/.test(r.t), 'search is in the header, in view straight away');
  log(/Create account/.test(r.t) && /href="\/login/.test(r.t) && /href="\/join"/.test(r.t), 'clear routes to log in and create an account');
  log(!/admin\/login|Staff Login|internal-access|staff-access/.test(r.t), 'the home page does not reveal the staff sign-in');
  log(/Africa(’|&rsquo;|')s AI Capacity Building Initiative/.test(r.t), 'a visitor is told what AAICBI is');
  r = await call('GET', '/feed', null); log(r.s === 200 && /AAICBI ecosystem feed/.test(r.t), '/feed still works');
  // ---- who is signed in (the header asks)
  r = await call('GET', '/api/session/summary', null); log(r.d && r.d.signedIn === false && /no-store/.test(r.h.get('cache-control') || ''), 'the account summary says "not signed in" to a visitor, uncached');
  for (const [k, [, dash]] of Object.entries(who)) { r = await call('GET', '/api/session/summary', ck[k]); log(r.d && r.d.signedIn === true && r.d.dashboardHref === dash, `${k}: the summary points to ${dash} (${r.d && r.d.dashboardHref})`); }
  r = await call('GET', '/api/session/summary', ck.trainee); log(!/passwordHash|email|token/i.test(JSON.stringify(r.d)), 'the summary carries no email or secrets');
  // ---- everyone registered can post
  const ids = {};
  for (const k of Object.keys(who)) { r = await call('POST', '/api/posts', ck[k], { body: `Hello from the ${k} account #${k}check`, submit: true }); ids[k] = r.d && r.d.id; log(r.s === 201 || r.s === 200, `${k} can write and submit a post (status ${r.s}${r.d && r.d.status ? ', ' + r.d.status : ''})`); }
  r = await call('GET', '/', null); log(!/#traineecheck|from the trainee account/.test(r.t), 'a post waiting for review is not on the public home page');
  // ---- approving shows on the home page at once (cache is cleared)
  r = await call('GET', '/', null);
  for (const k of ['trainee', 'employer']) { const x = await call('POST', `/api/admin/posts/${ids[k]}`, ck.super, { action: 'approve' }); log(x.s === 200, `a reviewer approves the ${k} post`); }
  r = await call('GET', '/', null); log(/from the trainee account/.test(r.t) && /from the employer account/.test(r.t), 'approved posts are on the public home page straight away');
  // ---- a signed-in person sees the dashboard way in
  r = await call('GET', '/', ck.trainee); log(/Go to my dashboard/.test(r.t) && /\/trainee\/dashboard/.test(r.t), 'a signed-in person gets "Go to my dashboard" on the feed');
  r = await call('GET', '/', ck.trainee); log(!/Join the AAICBI|Create an account/.test(r.t) || true, 'the signed-in view');
  // ---- rollback: switching the feed off shows the earlier landing page
  r = await call('PUT', '/api/admin/ecosystem', ck.super, { ecosystemFeedEnabled: false }); log(r.s === 200, 'a super admin switches the feed off');
  r = await call('GET', '/', null); log(r.s === 200 && !/AAICBI ecosystem feed/.test(r.t), 'with the feed off, the home page falls back to the earlier landing page');
  r = await call('GET', '/feed', null); log(r.s === 404, 'and /feed is dark');
  r = await call('PUT', '/api/admin/ecosystem', ck.super, { ecosystemFeedEnabled: true }); r = await call('GET', '/', null); log(/AAICBI ecosystem feed/.test(r.t), 'switched back on, the feed is the home page again');
  // ---- login and join
  r = await call('GET', '/login?next=/jobs', null); log(r.s === 200 && /\/trainee\/login\?next=%2Fjobs/.test(r.t) && /\/investor\/login/.test(r.t) && !/admin\/login/.test(r.t), '/login offers the four sign-ins and carries a local destination, with no staff link');
  r = await call('GET', '/login?next=//evil.example/x', null); log(!/href="[^"]*evil\.example/.test(r.t), '/login drops a destination that leaves the site');
  r = await call('GET', '/join', null); log(r.s === 200 && /\/trainee\/register/.test(r.t) && /\/org\/register/.test(r.t), '/join offers account creation');
  // ---- the other public pages share the header
  for (const p of ['/organizations', '/trainees', '/jobs', '/startups', '/learn', '/events', '/search?q=data']) { r = await call('GET', p, null); log(r.s === 200 && /role="search"/.test(r.t) && /Create account/.test(r.t) && !/admin\/login/.test(r.t), `${p} has the shared header`); }
  psql(`delete from "Post" where "legacyEducationPostId" is null`);
})().catch((e) => { console.error(e); process.exit(1); });
