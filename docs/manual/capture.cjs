// Captures real screenshots of the running app (local throwaway database, synthetic demo accounts) for the user manuals.
// Usage: node docs/manual/capture.cjs [filterSubstring]
const { B, launch, device, signedIn, clearThrottle } = require('../../scripts/device-checks/lib.cjs');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'screenshots');
const DESK = { colorScheme: 'dark', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const PHONE = { colorScheme: 'dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const ORG = ['/api/auth/training-org-login', 'org@dev.test'], TR = ['/api/auth/trainee-login', 't0@dev.test'];
// [folder, name, who, path, opts]  who: null = signed out
const SHOTS = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.SHOTS || 'shots.json'), 'utf8'));
(async () => {
  clearThrottle();
  const filter = process.argv[2] || '';
  const br = await launch();
  const ctxs = {};
  const ctxFor = async (who, kind) => {
    const k = who + kind; if (ctxs[k]) return ctxs[k];
    const d = kind === 'm' ? PHONE : DESK;
    if (!who) { const c = await br.newContext(d); await c.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]); return (ctxs[k] = c); }
    const [lp, em] = who === 'org' ? ORG : TR;
    { const c = await signedIn(br, d, lp, em); return (ctxs[k] = c); }
  };
  for (const s of SHOTS) {
    if (filter && !(s.folder + '/' + s.name).includes(filter)) continue;
    for (const kind of s.kinds || ['d', 'm']) {
      const ctx = await ctxFor(s.who, kind); const page = await ctx.newPage();
      try {
        await page.goto(B + s.path, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(s.wait || 1800);
        for (const a of s.actions || []) {
          if (a.click) await page.locator(a.click).first().click({ timeout: 5000 }).catch((e) => console.log('  click miss', a.click));
          if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1]).catch(() => console.log('  fill miss', a.fill[0]));
          if (a.select) await page.locator(a.select[0]).first().selectOption(a.select[1]).catch(() => console.log('  select miss', a.select[0]));
          if (a.press) await page.keyboard.press(a.press);
          if (a.wait) await page.waitForTimeout(a.wait);
        }
        await page.waitForTimeout(400);
        const dir = path.join(OUT, s.folder); fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${s.name}-${kind === 'm' ? 'mobile' : 'desktop'}.png`);
        await page.screenshot({ path: file, fullPage: !!s.full });
        // Annotations: find each element, store its position as percent of the image so the manual can number and box it.
        const marks = (s.marks || []).filter((m) => !m.kind || m.kind === kind);
        if (marks.length) {
          const dims = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, sy: window.scrollY }));
          const imgH = s.full ? dims.h : (kind === 'm' ? 844 : 900), imgW = dims.w;
          const out = [];
          for (const m of marks) {
            const el = page.locator(m.sel).first();
            const b = await el.boundingBox({ timeout: 4000 }).catch(() => null);
            if (!b) { console.log('  mark miss', m.n, m.sel); continue; }
            const top = b.y + (s.full ? dims.sy : 0);
            const r = { n: m.n, label: m.label, x: +(((b.x) / imgW) * 100).toFixed(2), y: +((top / imgH) * 100).toFixed(2) };
            if (m.box !== false) r.box = [+((b.x / imgW) * 100).toFixed(2), +((top / imgH) * 100).toFixed(2), +((b.width / imgW) * 100).toFixed(2), +((b.height / imgH) * 100).toFixed(2)];
            if (m.at === 'center') { r.x = +(((b.x + b.width / 2) / imgW) * 100).toFixed(2); r.y = +(((top + b.height / 2) / imgH) * 100).toFixed(2); }
            out.push(r);
          }
          fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(out));
        }
        console.log('ok', path.relative(OUT, file), page.url().replace(B, ''));
      } catch (e) { console.log('FAIL', s.name, kind, e.message.split('\n')[0]); }
      await page.close();
    }
  }
  await br.close();
})();
