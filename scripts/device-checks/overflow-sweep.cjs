const { B, log, launch, device, signedIn } = require('./lib.cjs');
const cfg = require('../a11y-pages.json').roles;
const roles = [
  ['trainee', '/api/auth/trainee-login', 't0@dev.test', cfg.trainee.paths],
  ['employer', '/api/auth/employer-login', 'employer@dev.test', cfg.employer.paths],
  ['organization', '/api/auth/training-org-login', 'org@dev.test', cfg.organization.paths],
  ['staff', '/api/auth/login', 'super@dev.test', cfg.staff.paths],
];
(async () => {
  const br = await launch();
  const bad = [];
  for (const dev of ['iPhone SE', 'iPad Mini']) {
    for (const [role, login, email, paths] of roles) {
      const ctx = await signedIn(br, device(dev), login, email);
      const p = await ctx.newPage(); p.setDefaultTimeout(20000);
      const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
      for (const u of paths) {
        const r = await p.goto(B + u, { waitUntil: 'load' }).catch(() => null); await p.waitForTimeout(1200);
        const info = await p.evaluate(() => {
          const w = innerWidth; const over = [];
          document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width > 0 && r.right > w + 2 && cs.position !== 'fixed' && !e.closest('[class*="overflow-x"]') && !e.closest('table') && cs.visibility !== 'hidden' && e.offsetParent !== null) over.push((e.tagName + '.' + (e.className || '').toString().split(' ')[0]).slice(0, 40)); });
          return { hscroll: document.documentElement.scrollWidth > w + 1, over: over.slice(0, 3), status: document.title };
        });
        const st = r ? r.status() : 0;
        if (info.hscroll || st >= 500 || errs.length) bad.push(`${dev} ${role} ${u} -> status ${st} hscroll=${info.hscroll} overflowing=${JSON.stringify(info.over)} errors=${JSON.stringify(errs)}`);
        errs.length = 0;
      }
      await ctx.close();
    }
  }
  console.log(bad.length ? 'ISSUES:\n' + bad.join('\n') : 'No horizontal overflow, server errors or script errors on any checked page.');
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 500)); process.exit(1); });
