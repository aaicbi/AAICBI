const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  const pages = [
    ['visitor feed', null, '/feed'],
    ['member', ['/api/auth/trainee-login', 't0@dev.test'], '/trainee/dashboard'],
    ['organization', ['/api/auth/training-org-login', 'org@dev.test'], '/admin/dashboard'],
    ['employer', ['/api/auth/employer-login', 'employer@dev.test'], '/employer/dashboard'],
  ];
  for (const [vName, desc] of [['phone', device('iPhone 13')], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
    for (const [name, login, path] of pages) {
      let ctx;
      try { ctx = login ? await signedIn(br, desc, login[0], login[1]) : await br.newContext(desc); } catch (e) { console.log('skip', name, e.message); continue; }
      await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
      const p = await ctx.newPage(); p.setDefaultTimeout(20000);
      await p.goto(B + path, { waitUntil: 'load' });
      const btn = p.getByRole('button', { name: /Switch to (light|dark) mode/ });
      await btn.waitFor();
      const dark0 = await p.evaluate(() => document.documentElement.classList.contains('dark'));
      await p.screenshot({ path: `/tmp/shots/${vName}-${name.replace(' ', '-')}-1.png` });
      const box = await btn.boundingBox();
      log(box && box.y < 5 && box.width >= 44, `${vName} ${name}: the toggle is fixed at the top (${Math.round(box.x)},${Math.round(box.y)})`);
      await btn.click();
      const dark1 = await p.evaluate(() => document.documentElement.classList.contains('dark'));
      log(dark1 !== dark0, `${vName} ${name}: pressing it switches the theme (${dark0 ? 'dark' : 'light'} to ${dark1 ? 'dark' : 'light'})`);
      await p.screenshot({ path: `/tmp/shots/${vName}-${name.replace(' ', '-')}-2.png` });
      await p.reload({ waitUntil: 'load' });
      const dark2 = await p.evaluate(() => document.documentElement.classList.contains('dark'));
      log(dark2 === dark1, `${vName} ${name}: the choice is kept after a reload`);
      await p.mouse.wheel(0, 600); await p.waitForTimeout(300);
      const box2 = await p.getByRole('button', { name: /Switch to/ }).boundingBox();
      log(box2 && box2.y < 20, `${vName} ${name}: it stays at the top while scrolling`);
      await ctx.close();
    }
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
