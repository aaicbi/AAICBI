const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
(async () => {
  const br = await launch();
  const errors = [];
  // ---- employer job posting is stepped on a phone
  let ctx = await signedIn(br, device('Pixel 7'), '/api/auth/employer-login', 'employer@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message));
  await p.goto(B + '/employer/job-postings', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  log(await p.getByText('Step 1 of 3 · The role').isVisible(), 'Pixel 7: job posting is stepped (Step 1 of 3 · The role)');
  await p.getByRole('button', { name: /Next/ }).click();
  log(await p.getByText('Step 1 of 3').isVisible(), 'job posting: Next refuses empty required fields');
  await p.getByLabel('Job title').fill('Data Analyst');
  await p.getByLabel('Job description').fill('Analyse and report on data.');
  await p.getByRole('button', { name: /Next/ }).click();
  await p.getByLabel('Closing date').fill('2027-01-15');
  await p.getByRole('button', { name: /Next/ }).click();
  log(await p.getByText('Step 3 of 3 · Pictures and videos').isVisible(), 'job posting: reaches step 3');
  const sb = await p.getByRole('button', { name: 'Submit for Review' }).boundingBox();
  const nav = await p.getByRole('navigation', { name: 'Main' }).boundingBox();
  log(sb && nav && sb.y + sb.height <= nav.y + 1, 'job posting: Submit sits above the bottom bar');
  await p.getByRole('button', { name: 'Submit for Review' }).click(); await p.waitForTimeout(1500);
  log(await p.getByText('Data Analyst').first().isVisible(), 'job posting is submitted and listed');
  await ctx.close();

  // ---- install prompt: appears on 2nd visit when the browser offers it, never again after dismissing
  ctx = await signedIn(br, device('Pixel 7'), '/api/auth/trainee-login', 't0@dev.test');
  p = await ctx.newPage(); p.setDefaultTimeout(15000);
  await p.addInitScript(() => { localStorage.setItem('pwa-install-v1', JSON.stringify({ visits: 1, dismissedAt: null })); });
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  await p.waitForTimeout(500);
  log(await p.getByRole('region', { name: 'Install the app' }).isVisible(), 'install card appears on the second visit when the browser offers installing');
  await p.getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(300);
  log(!(await p.getByRole('region', { name: 'Install the app' }).isVisible()), 'Not now hides it');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  await p.waitForTimeout(500);
  log(!(await p.getByRole('region', { name: 'Install the app' }).isVisible()), 'it does not come back after being dismissed');
  await ctx.close();
  // iPhone gets the Share / Add to Home Screen steps
  ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  p = await ctx.newPage(); p.setDefaultTimeout(15000);
  await p.addInitScript(() => { localStorage.setItem('pwa-install-v1', JSON.stringify({ visits: 1, dismissedAt: null })); });
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  log(await p.getByRole('region', { name: 'Install the app' }).isVisible(), 'iPhone: install card offers instructions');
  await p.getByRole('button', { name: 'How to add it' }).click();
  log(await p.getByText('Add to Home Screen').first().isVisible(), 'iPhone: shows Share, Add to Home Screen steps');
  await ctx.close();

  // ---- offline and slow network inside the signed-in app
  ctx = await signedIn(br, device('Pixel 7'), '/api/auth/trainee-login', 't0@dev.test');
  p = await ctx.newPage(); p.setDefaultTimeout(20000);
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  const swState = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active && r.active.state; });
  log(swState === 'activated', 'service worker is active while signed in');
  await ctx.setOffline(true);
  await p.goto(B + '/trainee/courses').catch(() => {});
  log(await p.getByText("You're offline").first().isVisible(), 'offline navigation inside the app shows the offline page');
  await ctx.setOffline(false);
  await p.waitForTimeout(1500); const tb = p.getByRole('button', { name: 'Try again' }); if (await tb.isVisible().catch(() => false)) await tb.click().catch(() => {}); await p.waitForTimeout(3000);
  log(/trainee\/courses/.test(p.url()) && !(await p.getByText("You're offline").first().isVisible().catch(() => false)), 'recovers once back online (auto-reload or Try again)');
  // pages and API are never stored by the worker
  const cached = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) out.push(new URL(r.url).pathname); } return out; });
  log(!cached.some(u => u.startsWith('/api/') || u.startsWith('/trainee/') || u.startsWith('/admin/')), 'worker caches no API response and no signed-in page (' + cached.length + ' public files)');
  console.log('   cached:', JSON.stringify(cached.filter(u => !u.startsWith('/_next/static')).slice(0, 8)));
  // slow connection: CDP throttling to roughly slow 3G
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 });
  const t0 = Date.now();
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'commit' });
  const early = await p.evaluate(() => document.body.innerText.length).catch(() => 0);
  await p.getByRole('navigation', { name: 'Main' }).waitFor({ timeout: 60000 });
  console.log(`   slow 3G: bottom bar visible after ${Date.now() - t0} ms`);
  log(true, 'slow connection: the page still loads and shows its navigation (no blank end state)');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ctx.close();
  console.log('page errors:', errors.length ? errors : 'none');
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 700)); process.exit(1); });
