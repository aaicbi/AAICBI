const { B, launch, signedIn } = require('./lib.cjs');
const CAND = {
  tab16: 'button[aria-label^="Switch to"]{left:50%!important;right:auto!important;transform:translateX(-50%)!important;top:0!important;height:24px!important;width:48px!important;border-radius:0 0 12px 12px!important;} @media (min-width:768px){button[aria-label^="Switch to"]{height:16px!important;width:56px!important;border-radius:0 0 10px 10px!important;}}',
};
const pages = [['visitor', null, '/feed'], ['visitor-about', null, '/about'], ['member', ['/api/auth/trainee-login', 't0@dev.test'], '/trainee/dashboard'], ['org', ['/api/auth/training-org-login', 'org@dev.test'], '/admin/dashboard'], ['employer', ['/api/auth/employer-login', 'employer@dev.test'], '/employer/dashboard'], ['jobs', null, '/jobs'], ['courses', null, '/courses']];
(async () => {
  const br = await launch();
  const hits = {};
  for (const w of [360, 390, 640, 768, 1024, 1280]) {
    for (const [name, login, path] of pages) {
      const opts = { viewport: { width: w, height: 800 } };
      const ctx = login ? await signedIn(br, opts, login[0], login[1]) : await br.newContext(opts);
      await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
      const p = await ctx.newPage(); p.setDefaultTimeout(15000);
      await p.goto(B + path, { waitUntil: 'load' }).catch(() => {});
      await p.getByRole('button', { name: /Switch to/ }).waitFor().catch(() => {});
      for (const [cname, css] of Object.entries(CAND)) {
        const h = await p.evaluate((css) => {
          let st = document.getElementById('cand'); if (!st) { st = document.createElement('style'); st.id = 'cand'; document.head.appendChild(st); } st.textContent = css;
          const t = document.querySelector('button[aria-label^="Switch to"]'); if (!t) return ['no toggle'];
          const r = t.getBoundingClientRect(); const out = [];
          for (const e of document.querySelectorAll('a,button,input,select,textarea,[role=button]')) {
            if (e === t || e.closest('#loop-panel')) continue;
            const b = e.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue;
            const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) {
              const top = document.elementFromPoint(Math.max(r.left + 1, b.left + 1), Math.max(r.top + 1, b.top + 1));
              out.push((e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24));
            }
          }
          return out;
        }, css);
        if (h.length) (hits[cname] = hits[cname] || []).push(`${w}px ${name}: ${h.join(' | ')}`);
      }
      await ctx.close();
    }
  }
  await br.close();
  for (const c of Object.keys(CAND)) console.log(`== ${c}: ${(hits[c] || []).length} overlaps`, '\n' + (hits[c] || []).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
