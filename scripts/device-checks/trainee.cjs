const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  // ===== iPhone 13: trainee phone home, bottom nav, More sheet
  let ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' });
  log(await p.getByRole('heading', { level: 1 }).first().isVisible(), 'iPhone: phone home is shown');
  const order = await p.evaluate(() => [...document.querySelectorAll('main h2, main p.uppercase')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 8));
  console.log('   order:', JSON.stringify(order));
  log(await p.getByRole('button', { name: 'Show full dashboard' }).isVisible(), 'iPhone: "Show full dashboard" offered');
  log(await p.getByRole('navigation', { name: 'Main' }).isVisible(), 'iPhone: bottom navigation visible');
  const tabs = (await p.getByRole('navigation', { name: 'Main' }).locator('a, button').allInnerTexts()).map(t => t.replace(/\d+\s*unread\s*/i, ''));
  log(JSON.stringify(tabs.map(t => t.trim())) === JSON.stringify(['Home', 'Messages', 'Events', 'Alerts', 'More']), 'iPhone: tabs are Home, Messages, Events, Alerts, More -> ' + JSON.stringify(tabs.map(t => t.trim())));
  // tap targets
  const small = await p.evaluate(() => [...document.querySelectorAll('nav[aria-label="Main"] a, nav[aria-label="Main"] button')].map(e => e.getBoundingClientRect()).filter(r => r.height < 44 || r.width < 44).length);
  log(small === 0, 'iPhone: every bottom-nav target is at least 44px');
  // Loop FAB must sit above the bottom nav, not on it
  const fab = await p.getByRole('button', { name: /Ask Loop/ }).boundingBox();
  const nav = await p.getByRole('navigation', { name: 'Main' }).boundingBox();
  log(fab && nav && fab.y + fab.height <= nav.y + 1, `iPhone: Loop button clears the bottom bar (fab bottom ${fab && Math.round(fab.y + fab.height)} <= nav top ${nav && Math.round(nav.y)})`);
  await p.getByRole('button', { name: 'More' }).click();
  log(await p.getByRole('dialog', { name: 'More' }).isVisible(), 'iPhone: More sheet opens');
  log(await p.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Certificates' }).isVisible(), 'iPhone: More lists the full menu');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  log(!(await p.getByRole('dialog', { name: 'More' }).isVisible()), 'iPhone: Escape closes More');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.getByRole('button', { name: 'Show full dashboard' }).click();
  log(await p.getByRole('button', { name: 'Back to simple view' }).isVisible(), 'iPhone: full dashboard can be opened and left again');
  await p.screenshot({ path: '/tmp/dev/trainee-phone-full.png' });
  await p.getByRole('button', { name: 'Back to simple view' }).click();
  await p.screenshot({ path: '/tmp/dev/trainee-phone-home.png' });
  log(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'iPhone: no horizontal scroll on the home');
  console.log('page errors:', errors.length ? errors : 'none');
  await ctx.close();
  // ===== Laptop: no bottom nav, full dashboard
  ctx = await signedIn(br, { viewport: { width: 1366, height: 800 } }, '/api/auth/trainee-login', 't0@dev.test');
  p = await ctx.newPage(); p.setDefaultTimeout(20000);
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' });
  log(!(await p.getByRole('navigation', { name: 'Main' }).isVisible().catch(() => false)), 'laptop: no bottom navigation');
  log(!(await p.getByRole('button', { name: 'Show full dashboard' }).isVisible()), 'laptop: no phone home controls');
  log(await p.getByText('Quick Actions', { exact: true }).filter({ visible: true }).first().isVisible(), 'laptop: the full dashboard is shown');
  await ctx.close();
  // ===== iPad portrait vs landscape
  for (const [label, d] of [['iPad portrait', device('iPad (gen 7)')], ['iPad landscape', device('iPad (gen 7) landscape')]]) {
    ctx = await signedIn(br, d, '/api/auth/trainee-login', 't0@dev.test');
    p = await ctx.newPage(); p.setDefaultTimeout(20000);
    await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' });
    const w = await p.evaluate(() => innerWidth);
    const navVisible = await p.getByRole('navigation', { name: 'Main' }).isVisible().catch(() => false);
    log(navVisible === (w < 1024), `${label} (${w}px): bottom nav ${navVisible ? 'shown' : 'hidden'} as expected`);
    await p.screenshot({ path: `/tmp/dev/${label.replace(' ', '-')}.png` });
    await ctx.close();
  }
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 500)); process.exit(1); });
