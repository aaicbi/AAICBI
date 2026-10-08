const { B, log, launch, device, signedIn } = require('./lib.cjs');
const sizes = [['large desktop', { viewport: { width: 1600, height: 1000 } }], ['laptop', { viewport: { width: 1280, height: 800 } }], ['tablet', device('iPad Mini')], ['phone', device('iPhone 13')], ['small phone', device('iPhone SE')]];
(async () => {
  const br = await launch();
  const errs = [];
  for (const [name, d] of sizes) {
    const ctx = await br.newContext({ ...d });
    const p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', (e) => errs.push(name + ': ' + e.message.slice(0, 80)));
    await p.goto(B + '/courses', { waitUntil: 'load' }); await p.waitForSelector('h3', { timeout: 15000 }); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('main a[href^="/courses/"]')];
      const bad = []; let imgW = [];
      for (const a of cards) {
        const ar = a.getBoundingClientRect();
        for (const el of a.querySelectorAll('h3, p, span, div')) {
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'hidden' && el.clientWidth > 0) bad.push(el.tagName + ':' + (el.textContent || '').slice(0, 30));
          if (!(el.textContent||'').trim()) continue; const r = el.getBoundingClientRect(); if (r.right > ar.right + 1 || r.left < ar.left - 1) bad.push('outside:' + (el.textContent || '').slice(0, 30));
        }
        const img = a.querySelector('div.aspect-video'); if (img) imgW.push(Math.round(img.getBoundingClientRect().width) + 'x' + Math.round(img.getBoundingClientRect().height));
      }
      return { n: cards.length, bad: [...new Set(bad)].slice(0, 5), imgW: imgW.slice(0, 3), hscroll: document.documentElement.scrollWidth > innerWidth + 1, h3Lines: [...document.querySelectorAll('main h3')].map((h) => Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight))) };
    });
    log(r.n >= 4 && r.bad.length === 0 && !r.hscroll, `${name}: ${r.n} cards, no overflow/outside text (images ${r.imgW.join(', ')}; title lines ${r.h3Lines.join('/')}) ${r.bad.join(',')}`);
    if (name === 'phone' || name === 'laptop') await p.screenshot({ path: `/tmp/courses-${name.replace(' ', '')}.png`, fullPage: false });
    await ctx.close();
  }
  console.log('page errors:', errs.length ? errs : 'none');
  await br.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
