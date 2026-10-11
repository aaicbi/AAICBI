const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const get = async (p, c) => { const r = await fetch(B + p, { headers: c ? { Cookie: c } : {}, redirect: 'manual' }); return { s: r.status, t: await r.text() }; };
(async () => {
  clearThrottle();
  const who = {
    trainee: ['/api/auth/trainee-login', 't0@dev.test', '/trainee/dashboard'],
    employer: ['/api/auth/employer-login', 'employer@dev.test', '/employer/dashboard'],
    org: ['/api/auth/training-org-login', 'org@dev.test', '/admin/organization'],
    staff: ['/api/auth/login', 'staff@dev.test', '/admin/dashboard'],
    super: ['/api/auth/login', 'super@dev.test', '/admin/dashboard'],
  };
  for (const [k, [lp, email, dash]] of Object.entries(who)) {
    const c = jar(await cookiesFor(lp, email));
    const r = await get(dash, c);
    log(r.s === 200 && /href="\/feed"/.test(r.t) && /href="\/compose"/.test(r.t) && /href="\/my-posts"/.test(r.t), `${k}: the dashboard menu has Feed, Write a post and My posts (${r.s})`);
    const i = await (await fetch(B + '/api/posts/identities', { headers: { Cookie: c } })).json();
    log(i.identities.length > 0 && i.blockedReason === null, `${k}: can post as ${i.identities.map((x) => x.label).join(', ')}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
