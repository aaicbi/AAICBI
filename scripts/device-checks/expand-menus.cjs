// Expand pickers and the sideways sidebar, in a real browser: computers get the new look; phones and tablets keep what they had.
const { B, launch, signedIn } = require('./lib.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };

(async () => {
  const br = await launch();
  // ---------- computer
  const ctx = await signedIn(br, { viewport: { width: 1280, height: 900 } }, '/api/auth/training-org-login', 'org@dev.test');
  const p = await ctx.newPage();
  await p.goto(B + '/admin/organization/team', { waitUntil: 'networkidle' });

  const pickerHead = p.locator('[data-expand-select] button[aria-haspopup="listbox"]').first();
  ok(await pickerHead.isVisible(), 'computer: the role field is an expand button');
  ok((await p.locator('select').first().evaluate((n) => getComputedStyle(n).opacity)) === '0', 'computer: the plain dropdown is not shown');
  ok((await pickerHead.innerText()).includes('Expand'), 'computer: it says Expand');
  await pickerHead.click();
  await p.locator('[role="listbox"]').first().waitFor();
  const opts = p.locator('[role="listbox"] [role="option"]');
  ok((await opts.count()) === 4, 'computer: all four roles are listed');
  const txt = await p.locator('[role="listbox"]').first().innerText();
  ok(/Admin/.test(txt) && /Instructor/.test(txt) && /Everything except billing/.test(txt) && /Edits only|builds and edits only/i.test(txt), 'computer: each role comes with what it allows');
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok((await p.locator('[role="listbox"]').count()) === 0, 'computer: Escape closes the list');
  await pickerHead.click();
  await p.locator('[role="option"]', { hasText: 'Instructor' }).click();
  ok((await pickerHead.innerText()).includes('Instructor'), 'computer: choosing a role shows it on the button');
  ok(await p.getByText('Courses this instructor teaches').isVisible(), 'computer: the form reacted to the choice (course ticks appear)');
  // forms still submit the chosen value
  const nativeVal = await p.locator('select').first().inputValue();
  ok(nativeVal === 'INSTRUCTOR', 'computer: the form field behind the picker holds the value (' + nativeVal + ')');
  await p.screenshot({ path: '/tmp/dev/expand-team-desktop.png' });

  // sidebar flyout
  await p.goto(B + '/admin/organization/team', { waitUntil: 'networkidle' });
  const aside = p.locator('aside nav[aria-label="Admin"]');
  const before = await aside.evaluate((n) => n.scrollHeight);
  const secBtn = aside.locator('button[aria-controls^="nav-flyout-"]').first();
  const sectionId = await secBtn.getAttribute('aria-controls');
  await secBtn.click();
  const panel = p.locator('#' + sectionId).first();
  ok(await panel.isVisible(), 'computer: a section opens a panel');
  await p.waitForTimeout(400);
  const box = await panel.boundingBox(); const abox = await p.locator('aside').boundingBox();
  ok(box && Math.abs(box.x - (abox.x + abox.width)) < 3, 'computer: the panel sits beside the sidebar, to its right');
  ok((await aside.evaluate((n) => n.scrollHeight)) === before, 'computer: the sidebar does not grow taller');
  await p.screenshot({ path: '/tmp/dev/expand-sidebar-desktop.png' });
  await p.keyboard.press('Escape');
  ok(!(await panel.isVisible()), 'computer: Escape closes the panel');
  await secBtn.click();
  await p.mouse.click(900, 600);
  ok(!(await panel.isVisible()), 'computer: clicking elsewhere closes it');
  await secBtn.click();
  const link = panel.locator('a').first();
  const href = await link.getAttribute('href');
  await link.click();
  await p.waitForURL('**' + href.split('?')[0], { timeout: 20000 }).catch(() => undefined);
  ok(p.url().includes(href.split('?')[0]), 'computer: choosing a page goes there');
  ok(!(await p.locator('#' + sectionId).first().isVisible()), 'computer: and the panel closes');

  // ---------- phone: must be exactly what it was
  const ph = await signedIn(br, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '/api/auth/training-org-login', 'org@dev.test');
  const m = await ph.newPage();
  await m.goto(B + '/admin/organization/team', { waitUntil: 'networkidle' });
  ok(await m.locator('select').first().isVisible(), 'phone: the plain dropdown is still the control');
  ok((await m.locator('[data-expand-select] button[aria-haspopup="listbox"]').first().isVisible()) === false, 'phone: no expand picker is shown');
  await m.getByRole('button', { name: /open menu/i }).click();
  const mnav = m.locator('nav[aria-label="Admin"]:visible').last();
  const msec = mnav.locator('button[aria-controls^="nav-section-"]:visible').first();
  const msecId = await msec.getAttribute('aria-controls');
  const hiddenBefore = await m.locator('#' + msecId).first().isHidden();
  await msec.click();
  const mp = m.locator('#' + msecId).first();
  ok(hiddenBefore && (await mp.isVisible()), 'phone: sections still open downward inside the menu');
  const mbox = await mp.boundingBox(); const bbox = await msec.boundingBox();
  ok(mbox && mbox.y >= bbox.y && mbox.x < 120, 'phone: the pages appear under the section, in the list (not beside it)');
  await m.screenshot({ path: '/tmp/dev/expand-sidebar-phone.png' });

  // tablet (below the large-screen width) also unchanged
  const tb = await signedIn(br, { viewport: { width: 820, height: 1100 } }, '/api/auth/training-org-login', 'org@dev.test');
  const t = await tb.newPage();
  await t.goto(B + '/admin/organization/team', { waitUntil: 'networkidle' });
  ok(await t.locator('select').first().isVisible(), 'tablet: the plain dropdown is still the control');

  await br.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
