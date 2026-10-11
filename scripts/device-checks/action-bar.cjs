const { B, log, launch, device, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  const ck = await cookiesFor('/api/auth/trainee-login', 't0@dev.test');
  const c = ck.map((x) => `${x.name}=${x.value}`).join('; ');
  const r = await fetch(B + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ body: 'Action bar check', submit: true }) });
  const id = (await r.json()).id;
  const br = await launch();
  for (const [name, o] of [['desktop 1280', { viewport: { width: 1280, height: 900 } }], ['narrow 700', { viewport: { width: 700, height: 900 } }], ['iPhone 13', device('iPhone 13')]]) {
    const ctx = await br.newContext(o); await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...ck]);
    const p = await ctx.newPage(); p.setDefaultTimeout(20000);
    await p.goto(B + '/post/' + id, { waitUntil: 'load' });
    const bar = p.locator('article div.relative.flex.gap-1').first(); await bar.waitFor();
    const boxes = await bar.locator('button').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), t: b.innerText.trim() }; }));
    log(boxes.every((b) => b.h <= 48), `${name}: every action is a single line (${boxes.map((b) => b.t || '·').join(' | ')}; heights ${boxes.map((b) => b.h).join(',')})`);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    log(!over, `${name}: no sideways scrolling`);
    await ctx.close();
  }
  await br.close();
  psql(`delete from "Post" where id='${id}'`);
})().catch((e) => { console.error(e); process.exit(1); });
