const { B, log, launch, device, signedIn } = require('./lib.cjs');
const openChat = async (p) => { await p.getByRole('button', { name: /Ask Loop, the ecosystem guide/ }).click(); await p.locator('#loop-panel').waitFor(); };
const say = async (p, text) => { await p.locator('#loop-input').fill(text); await p.locator('#loop-input').press('Enter'); await p.waitForTimeout(1800); };
const card = (p) => p.locator('[data-guide-card]');
const over = (p, sel) => p.evaluate((s) => { const b = document.querySelector('.guide-beam'); const t = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0); if (!b || !t) return false; const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect(); return br.left <= tr.left + 1 && br.top <= tr.top + 1 && br.right >= tr.right - 1 && br.bottom >= tr.bottom - 1; }, sel);
(async () => {
  const br = await launch(); const errs = [];
  // ---- organization: multi-step tour that follows the person
  let ctx = await signedIn(br, { viewport: { width: 1366, height: 800 } }, '/api/auth/training-org-login', 'org@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  await p.goto(B + '/admin/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await openChat(p); await say(p, 'How do I upload a course?');
  await p.getByRole('button', { name: 'Show me on screen' }).click(); await p.waitForTimeout(1200);
  log(await p.locator('#loop-panel').count() === 0, 'starting a tour tucks the chat away so the page is visible');
  log(/Step 1 of \d+/.test(await card(p).innerText()), 'tour card shows "Step 1 of N"');
  log(await over(p, '[data-guide-target="nav:/admin/courses"]'), 'step 1: the Courses menu item glows');
  await p.locator('[data-guide-target="nav:/admin/courses"]').first().click(); await p.waitForTimeout(1800);
  log(/Step 2 of/.test(await card(p).innerText()) && await over(p, '[data-guide-target="create-course"]'), 'clicked it, the guide moved on by itself: + Create Course glows');
  await p.screenshot({ path: '/tmp/guide-tour-step2.png' });
  await p.locator('[data-guide-target="create-course"]').click(); await p.waitForTimeout(2000);
  log(/courses\/new/.test(p.url()) && /Step 3 of/.test(await card(p).innerText()) && await over(p, '[data-guide-target="course-title"]'), 'step 3: the Course Title field glows');
  log(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-guide-target') === 'course-title'), 'the field was focused for typing');
  await p.keyboard.type('My first course'); await p.waitForTimeout(2600);
  log(/Step 4 of/.test(await card(p).innerText()) && await over(p, '[data-guide-target="create-course-submit"]'), 'after typing, it moved on: Create & Add Modules glows');
  await p.screenshot({ path: '/tmp/guide-tour-step4.png' });
  await p.getByRole('button', { name: 'End this guide' }).click(); await p.waitForTimeout(500);
  log(await p.locator('.guide-beam').count() === 0 && await card(p).count() === 0, 'ending the guide removes the highlight and card');

  // ---- a step that lives on another page offers to take you there
  await p.goto(B + '/admin/dashboard', { waitUntil: 'load' });
  await p.evaluate(() => sessionStorage.setItem('loop-interaction-v1', JSON.stringify({ tour: { id: 'upload-course', step: 1 }, spot: null })));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2000);
  log(await p.getByRole('button', { name: /Take me there/ }).isVisible() && await p.locator('.guide-beam').count() === 0, 'on the wrong page it offers "Take me there" and highlights nothing');
  await p.getByRole('button', { name: /Take me there/ }).click(); await p.waitForTimeout(2200);
  log(/\/admin\/courses/.test(p.url()) && await over(p, '[data-guide-target="create-course"]'), 'after going there, the control glows');
  // does not steal the page while typing elsewhere
  await p.evaluate(() => sessionStorage.removeItem('loop-interaction-v1'));

  // ---- reduced motion
  const rm = await br.newContext({ viewport: { width: 1366, height: 800 }, reducedMotion: 'reduce' });
  await rm.addCookies(await ctx.cookies());
  const pr = await rm.newPage(); await pr.goto(B + '/admin/dashboard', { waitUntil: 'load' }); await pr.waitForTimeout(2000);
  await pr.evaluate(() => sessionStorage.setItem('loop-interaction-v1', JSON.stringify({ tour: { id: 'upload-course', step: 0 }, spot: null })));
  await pr.reload({ waitUntil: 'load' }); await pr.waitForTimeout(2000);
  const rmInfo = await pr.locator('.guide-beam').evaluate((e) => ({ a: getComputedStyle(e).animationName, d: getComputedStyle(e, '::before').display, shadow: getComputedStyle(e).boxShadow.slice(0, 60) }));
  log(rmInfo.a === 'none' && rmInfo.d === 'none', 'reduced motion: a still, high-contrast outline with no animation ' + JSON.stringify(rmInfo));
  await pr.screenshot({ path: '/tmp/guide-reduced.png' });

  // ---- phone: item is behind More
  const t = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const pt = await t.newPage(); pt.setDefaultTimeout(15000); pt.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  await pt.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await pt.waitForTimeout(2500);
  await openChat(pt); await say(pt, 'Where are my certificates?');
  await pt.getByRole('button', { name: 'Show me' }).click(); await pt.waitForTimeout(1500);
  log(await pt.locator('#loop-panel').count() === 0, 'phone: chat gets out of the way');
  log(await over(pt, '[data-guide-target="more"]'), 'phone: the item is not on the bottom bar, so More glows');
  log(/More/.test(await card(pt).innerText()), 'phone: the card says it is under More: "' + (await card(pt).innerText()).replace(/\n/g, ' ').slice(0, 80) + '"');
  await pt.screenshot({ path: '/tmp/guide-phone-more.png' });
  await pt.locator('[data-guide-target="more"]').click(); await pt.waitForTimeout(1200);
  log(await over(pt, '[data-guide-target="nav:/trainee/certificates"]'), 'phone: once More is open, the real Certificates item glows');
  await pt.screenshot({ path: '/tmp/guide-phone-sheet.png' });
  const box = await card(pt).boundingBox(); const bb = await pt.locator('.guide-beam').boundingBox();
  log(!(box.y < bb.y + bb.height && box.y + box.height > bb.y && box.x < bb.x + bb.width && box.x + box.width > bb.x), 'phone: the card does not cover the highlighted item');
  await pt.locator('[data-guide-target="nav:/trainee/certificates"]').last().click(); await pt.waitForTimeout(1200);
  log(/certificates/.test(pt.url()) && await pt.locator('.guide-beam').count() === 0, 'phone: tapping it goes there and clears the highlight');
  console.log('page errors:', errs.length ? errs : 'none');
  await br.close();
})().catch((e) => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
