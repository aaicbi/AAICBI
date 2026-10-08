const { B, log, launch, device, signedIn } = require('./lib.cjs');
const C = '/trainee/courses/cmuznki4u000ip61x2v21ycrq';
(async () => {
  const br = await launch(); const errs = [];
  for (const [name, d] of [['iPhone 13', device('iPhone 13')], ['Pixel 7', device('Pixel 7')], ['iPad Mini', device('iPad Mini')], ['laptop', { viewport: { width: 1366, height: 800 } }]]) {
    const ctx = await signedIn(br, d, '/api/auth/trainee-login', 't0@dev.test'); const p = await ctx.newPage(); p.setDefaultTimeout(15000);
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message.slice(0, 80)));
    let navigatedAway = false; p.on('framenavigated', (f) => { if (f === p.mainFrame() && /youtube\.com|youtu\.be/.test(f.url())) navigatedAway = true; });
    await p.goto(B + C, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    log(await p.getByRole('heading', { level: 1 }).first().isVisible(), name + ': course hero shows the title');
    log(await p.locator('section img[alt$="cover"]').first().isVisible().catch(() => false), name + ': course picture is shown');
    log(await p.getByText('Read more').first().isVisible().catch(() => false), name + ': long overview is clamped with Read more');
    if (!(await p.getByRole('button', { name: /Play video: Lesson video/ }).first().isVisible().catch(() => false))) { await p.getByRole('button', { name: /Module 1/ }).first().click(); await p.waitForTimeout(800); }
    const vp = p.getByRole('button', { name: /Play video: Lesson video/ }).first();
    await vp.scrollIntoViewIfNeeded(); const box = await vp.boundingBox(); const vw = p.viewportSize().width;
    log(box && Math.abs(box.width / box.height - 16 / 9) < 0.05 && box.width > vw * 0.85 || vw > 700, `${name}: video frame is 16:9 and wide (${Math.round(box.width)}x${Math.round(box.height)} of ${vw})`);
    const y0 = await p.evaluate(() => scrollY);
    await p.getByRole('button', { name: /Expand video/ }).first().click(); await p.waitForTimeout(600);
    const dlg = p.getByRole('dialog'); const src = await dlg.locator('iframe').getAttribute('src'); const allow = await dlg.locator('iframe').getAttribute('allow');
    log(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(src) && /playsinline=1/.test(src), name + ': modal plays an embedded player (no youtube.com page)');
    log(/fullscreen/.test(allow) && (await dlg.locator('iframe').getAttribute('allowfullscreen')) !== null, name + ': fullscreen is permitted in the player');
    const mb = await dlg.locator('iframe').boundingBox(); log(mb.width > vw * 0.85 || mb.width > 800, `${name}: modal video is large (${Math.round(mb.width)}px)`);
    if (name === 'iPhone 13') await p.screenshot({ path: '/tmp/video-modal-iphone.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    log(!(await dlg.isVisible().catch(() => false)), name + ': Escape closes the modal');
    log(Math.abs((await p.evaluate(() => scrollY)) - y0) < 5, name + ': page stays exactly where it was');
    await vp.click(); await p.waitForTimeout(600);
    const inline = await p.locator('iframe[src*="youtube-nocookie"]').count();
    log(inline === 1 && !navigatedAway && /\/trainee\/courses\//.test(p.url()), name + ': tap plays inline, stays on the platform');
    if (name === 'iPhone 13') { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: '/tmp/course-hero-iphone.png' }); }
    log(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': no sideways scroll');
    await ctx.close();
  }
  console.log('page errors:', errs.length ? errs : 'none'); await br.close();
})().catch((e) => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
