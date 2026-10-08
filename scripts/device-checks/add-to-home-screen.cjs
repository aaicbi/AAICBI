const { B, log, launch, device } = require('./lib.cjs');
(async () => {
  const br = await launch();
  for (const [name, dev] of [['iPhone 13', 'iPhone 13'], ['Pixel 7', 'Pixel 7']]) {
    const ctx = await br.newContext({ ...device(dev) });
    const p = await ctx.newPage(); p.setDefaultTimeout(15000);
    await p.goto(B + '/', { waitUntil: 'load' }); await p.waitForTimeout(1500);
    const btn = p.getByRole('button', { name: /Install app|Add to home screen/ }).first();
    log(await btn.isVisible(), name + ': Install button visible on the public page');
    await btn.click(); await p.waitForTimeout(500);
    const dlg = p.getByRole('dialog', { name: 'Add to home screen' });
    log(await dlg.isVisible(), name + ': steps sheet opens');
    const t = await dlg.innerText();
    log(name.startsWith('iPhone') ? /Add to Home Screen/.test(t) && /Safari/.test(t) : /Install app/.test(t), name + ': shows the right steps');
    await p.screenshot({ path: '/tmp/a2hs-' + name.replace(' ', '') + '.png' });
    await p.getByRole('button', { name: 'Got it' }).click();
    log(!(await dlg.isVisible()), name + ': closes');
    await ctx.close();
  }
  const d = await br.newContext({ viewport: { width: 1280, height: 800 } }); const p = await d.newPage();
  await p.goto(B + '/', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  log(await p.getByRole('button', { name: /Install app|Add to home screen/ }).count() === 0 || !(await p.getByRole('button', { name: /Install app/ }).first().isVisible()), 'laptop: no install button');
  await br.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
