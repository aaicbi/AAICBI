// The ordering game in the normal single-player round: steps are dragged into place by a handle (mouse or touch), arrows move a focused handle.
const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  for (const [name, desc] of [['phone', device('iPhone 13')], ['small', device('iPhone 7', { viewport: { width: 375, height: 553 } })], ['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 900 } })]]) {
    const ctx = await signedIn(br, desc, '/api/auth/login', 'super@dev.test');
    const p = await ctx.newPage(); p.setDefaultTimeout(15000);
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(B + '/admin/studio/demo');
    await p.getByTestId('demo-tab-ORDERING').click();
    await p.getByTestId('round-start').click();
    const skip = p.getByRole('button', { name: 'Skip' }); if (await skip.waitFor({ timeout: 2500 }).then(() => true, () => false)) await skip.click();
    const gp = p.getByTestId('game-player'); await gp.waitFor();
    const rows = gp.locator('ol').first().locator('> li');
    const n = await rows.count();
    const texts = async () => (await gp.locator('ol').first().locator('> li > span:nth-child(2)').allInnerTexts()).map((t) => t.trim());
    log(n >= 3 && (await gp.getByLabel(/Drag it, or use the up and down arrow keys/).count()) === n, `${name}: every step has a drag handle (${n} steps)`);
    // drag the last step up one place
    const before = await texts();
    const handles = gp.getByLabel(/Drag it, or use the up and down arrow keys/);
    await handles.nth(n - 1).scrollIntoViewIfNeeded();
    const gb = await handles.nth(n - 1).boundingBox(); const tb = await handles.nth(n - 2).boundingBox();
    await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down();
    await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 - 8, { steps: 12 }); await p.mouse.up();
    const after = await texts();
    log(after[n - 2] === before[n - 1] && after[n - 1] === before[n - 2], `${name}: dragging a step by its handle moves it up one place`);
    log((await gp.locator('ol').first().locator('> li > span:first-child').allInnerTexts()).join('') === Array.from({ length: n }, (_, i) => i + 1).join(''), `${name}: the numbers still run 1 to ${n}`);
    // drag the first step to the very bottom, in one long move
    await handles.nth(0).scrollIntoViewIfNeeded();
    const first = await handles.nth(0).boundingBox();
    await p.mouse.move(first.x + first.width / 2, first.y + first.height / 2); await p.mouse.down();
    const lastBox = await handles.nth(n - 1).boundingBox();
    await p.mouse.move(first.x + first.width / 2, lastBox.y + lastBox.height, { steps: 30 }); await p.mouse.up();
    const bottom = await texts();
    log(bottom[n - 1] === after[0], `${name}: a long drag carries a step to the end of the list`);
    // keyboard
    await handles.nth(1).focus(); await p.keyboard.press('ArrowUp');
    const keyed = await texts();
    log(keyed[0] === bottom[1] && keyed[1] === bottom[0], `${name}: the up arrow key moves a focused step up`);
    // the answer is still checked from the new order
    await p.getByRole('button', { name: 'Check answer' }).click();
    await p.getByRole('button', { name: /Next question|See my results/ }).waitFor();
    log(true, `${name}: the dragged order can be checked`);
    log(errs.length === 0, `${name}: no page errors (${errs.join('; ')})`);
    await p.screenshot({ path: `/tmp/dev/ordering-drag-${name}.png` });
    await ctx.close();
  }
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
