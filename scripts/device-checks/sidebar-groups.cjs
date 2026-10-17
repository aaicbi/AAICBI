const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 860 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(B + '/admin/courses', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  const side = p.locator('aside nav[aria-label="Admin"]');
  const head = (name) => side.getByRole('button', { name, exact: true });
  const vis = (href) => side.locator(`a[href="${href}"]`).first().isVisible();

  const sections = await side.locator('button[aria-expanded]').allInnerTexts();
  log(sections.length >= 3, 'the sidebar has dropdown sections: ' + sections.map((s) => s.trim()).join(', '));
  log((await head('Teaching').getAttribute('aria-expanded')) === 'true' && (await vis('/admin/courses')), 'on Courses, the Teaching section is open and shows its pages');
  const closed = [];
  for (const s of sections) { const n = s.trim(); if (n !== 'Teaching' && (await head(n).getAttribute('aria-expanded')) === 'false') closed.push(n); }
  log(closed.length >= 1, 'the sections you are not in start closed (' + closed.join(', ') + ')');
  log(!(await vis('/admin/settings')) || closed.length === 0, 'a page inside a closed section is hidden');

  // open one, it stays after a reload
  const target = closed[0];
  await head(target).click();
  log((await head(target).getAttribute('aria-expanded')) === 'true', 'clicking a section opens it');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  log((await head(target).getAttribute('aria-expanded')) === 'true', 'what you opened is remembered after a reload');
  await head(target).click();
  log((await head(target).getAttribute('aria-expanded')) === 'false', 'clicking again closes it');

  // Loop can open a closed section to point at a page in it
  const hidden = await side.locator('[hidden] a[data-guide-target]').first().getAttribute('data-guide-target');
  if (hidden) {
    await p.evaluate((t) => window.dispatchEvent(new CustomEvent('aaicbi:reveal-nav', { detail: t.slice(4) })), hidden);
    await p.waitForTimeout(300);
    log(await side.locator(`a[data-guide-target="${hidden}"]`).first().isVisible(), 'Loop can open a closed section to show a page in it (' + hidden + ')');
  }

  // going to a page in a closed section opens it
  await p.goto(B + '/admin/settings', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  log(await vis('/admin/settings'), 'opening a page in a closed section opens that section');
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await br.close(); process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
