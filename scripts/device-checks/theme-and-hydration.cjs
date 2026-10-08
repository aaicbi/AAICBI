const { B, launch, device, signedIn } = require('./lib.cjs');
const pages = ['/', '/jobs', '/trainees', '/trainee/login', '/trainee/register', '/organizations', '/events', '/showcase', '/employer/login'];
(async () => {
  const br = await launch(); let bad = 0;
  for (const dn of ['iPhone 13', 'Pixel 7', null]) {
    const ctx = await br.newContext(dn ? device(dn) : { viewport: { width: 1280, height: 800 } });
    for (const path of pages) {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message.slice(0, 60)));
      await p.goto(B + path, { waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(1500);
      const dark = await p.evaluate(() => document.documentElement.classList.contains('dark'));
      const ok = dark && errs.length === 0; if (!ok) bad++;
      console.log(ok ? 'PASS' : 'FAIL', dn || 'laptop', path, 'dark=' + dark, errs.slice(0, 1).join(''));
      await p.close();
    }
    await ctx.close();
  }
  const ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test'); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 60)));
  for (const path of ['/trainee/dashboard', '/trainee/courses', '/notifications']) { await p.goto(B + path, { waitUntil: 'load' }); await p.waitForTimeout(1500); const dark = await p.evaluate(() => document.documentElement.classList.contains('dark')); console.log(dark && !errs.length ? 'PASS' : 'FAIL', 'signed-in iPhone', path, dark, errs.join('')); }
  await br.close(); console.log('bad:', bad);
})();
