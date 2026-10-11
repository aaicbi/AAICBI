const { B, log, launch, device } = require('./lib.cjs');
(async () => {
  const br = await launch();
  for (const [name, ctxOpts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['phone', device('iPhone 13')]]) {
    const ctx = await br.newContext({ ...ctxOpts }); await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
    const p = await ctx.newPage(); p.setDefaultTimeout(20000);
    await p.goto(B + '/feed', { waitUntil: 'load' });
    await p.getByRole('button', { name: /Ask Loop/ }).click();
    const panel = p.locator('#loop-panel'); await panel.waitFor();
    const sub = panel.getByText('Your guide to the ecosystem');
    const h = await sub.evaluate((e) => e.getBoundingClientRect().height);
    log(h < 20, `${name}: "Your guide to the ecosystem" stays on one line (${Math.round(h)}px high)`);
    log(await panel.getByRole('button', { name: 'Start over' }).isVisible() && await panel.getByRole('button', { name: 'Minimize Loop' }).isVisible(), `${name}: Start over and Minimize are both visible`);
    await ctx.close();
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
