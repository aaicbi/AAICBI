const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  let ctx = await signedIn(br, device('Galaxy S9+'), '/api/auth/training-org-login', 'org@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(B + '/admin/organization', { waitUntil: 'load' }); await p.waitForTimeout(2000);
  const tabs = (await p.getByRole('navigation', { name: 'Main' }).locator('a, button').allInnerTexts()).map(t => t.trim());
  log(JSON.stringify(tabs) === JSON.stringify(['Overview', 'Messages', 'Events', 'Alerts', 'More']), 'Galaxy S9+ organization tabs: ' + JSON.stringify(tabs));
  const heads = await p.evaluate(() => [...document.querySelectorAll('main h2')].map(e => e.textContent.trim()));
  console.log('   org phone home:', JSON.stringify(heads));
  log(heads[0]?.startsWith('Alerts') && heads.includes('Trainees') && heads.indexOf('Trainees') < heads.indexOf('Messages'), 'org home: Alerts, Trainees, then Messages');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/org-phone-home.png' });
  await p.evaluate(() => window.scrollTo(0, 0));
  // full dashboard on a phone: tables become cards
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Show full dashboard' }).click({ force: true });
  await p.waitForTimeout(800);
  const cards = await p.evaluate(() => [...document.querySelectorAll('table')].map(t => [t.dataset.cards, t.rows.length]));
  console.log('   tables:', JSON.stringify(cards));
  log(cards.some(c => c[0] === 'true'), 'org full dashboard on a phone: tables become cards');
  log(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'org full dashboard: no horizontal scroll');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/org-phone-full.png', fullPage: false });

  // Messages for organizations
  await p.goto(B + '/admin/messages', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  log(await p.getByRole('heading', { name: 'Messages' }).isVisible(), 'organization can open Messages');
  const list = await (await ctx.request.get(B + '/api/conversations')).json();
  console.log('   org conversations:', JSON.stringify(list.map(c => c.title)));
  const contacts = await (await ctx.request.get(B + '/api/conversations/contacts')).json();
  log(contacts.every(c => c.type === 'TRAINEE'), 'organization contacts are trainees only: ' + JSON.stringify(contacts.map(c => c.name)));
  // only cohort trainees (t0..t5 are in the cohort; t6+ are not)
  log(!contacts.some(c => ['Halima Sani', 'Emeka Udo', 'Folake Ade'].includes(c.name)), 'organization cannot reach trainees outside its cohorts');

  // Public profile + preview
  await p.goto(B + '/admin/organization/profile', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.getByLabel('Tagline').fill('Practical data skills for everyone');
  await p.waitForTimeout(300);
  log(await p.getByRole('heading', { name: 'Preview' }).isVisible(), 'profile preview is shown');
  log(await p.getByText('Practical data skills for everyone').first().isVisible(), 'preview updates as you type');
  await p.getByRole('button', { name: 'Phone' }).click();
  const w = await p.evaluate(() => Math.round(document.querySelector('#profile-preview-heading').closest('section').querySelector('.mx-auto').getBoundingClientRect().width));
  console.log('   preview width (phone toggle):', w);
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/org-profile-phone.png' });
  const sticky = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Save'); const r = b.getBoundingClientRect(); return [Math.round(r.bottom), innerHeight]; });
  log(sticky[0] <= sticky[1], 'profile Save button is on screen without scrolling to it (' + sticky.join('/') + ')');

  // Loop guide for the organization
  await p.goto(B + '/admin/courses', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const fab = p.getByRole('button', { name: /Ask Loop/ });
  log(await fab.isVisible(), 'Loop is available in the organization workspace on a phone');
  await fab.click();
  await p.getByRole('button', { name: /Upload a course/ }).first().click();
  const card = p.getByRole('region', { name: /Guide: Upload and publish a course/ });
  await card.waitFor();
  log(await card.getByText('Step 1 of 10').isVisible(), 'Loop starts the upload-a-course guide');
  await card.getByRole('button', { name: /Next/ }).click();
  log(await card.getByText('Step 2 of 10').isVisible(), 'guide moves to step 2');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/org-loop-guide-phone.png' });
  const panel = await p.locator('#loop-panel').boundingBox(); const nav = await p.getByRole('navigation', { name: 'Main' }).boundingBox();
  log(panel && nav && panel.y + panel.height <= nav.y + 1, `Loop chat sits above the bottom bar (${panel && Math.round(panel.y + panel.height)} <= ${nav && Math.round(nav.y)})`);
  console.log('page errors:', errors.length ? errors : 'none');
  await ctx.close(); await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 600)); process.exit(1); });
