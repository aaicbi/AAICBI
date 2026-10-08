const { B, log, launch, device, signedIn } = require('./lib.cjs');
const openChat = async (p) => { await p.getByRole('button', { name: /Ask Loop, the ecosystem guide/ }).click(); await p.locator('#loop-panel').waitFor(); };
const say = async (p, text) => { await p.locator('#loop-input').fill(text); await p.locator('#loop-input').press('Enter'); await p.waitForTimeout(1800); };
const beam = (p) => p.locator('.guide-beam');
const beamOver = async (p, sel) => p.evaluate((s) => { const b = document.querySelector('.guide-beam'); const t = [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0); if (!b || !t) return false; const br = b.getBoundingClientRect(), tr = t.getBoundingClientRect(); return br.left <= tr.left && br.top <= tr.top && br.right >= tr.right && br.bottom >= tr.bottom && br.width < tr.width + 30; }, sel);
(async () => {
  const br = await launch(); const errs = [];
  // ---- trainee on a laptop
  let ctx = await signedIn(br, { viewport: { width: 1366, height: 800 } }, '/api/auth/trainee-login', 't0@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(2000);
  await openChat(p);
  await say(p, 'Where is analytics?');
  let last = await p.locator('#loop-panel [role="log"] > div').last().innerText();
  log(/Analytics & Reports is here/.test(last), 'navigate intent: names the right place for a trainee');
  log(await p.getByRole('button', { name: /Open Analytics & Reports/ }).isVisible() && await p.getByRole('button', { name: 'Show me' }).isVisible(), 'offers Take me there and Show me buttons');
  await p.getByRole('button', { name: 'Show me' }).click(); await p.waitForTimeout(1200);
  log(await beam(p).count() === 1 && await beamOver(p, '[data-guide-target="nav:/trainee/my-activity"]'), 'Show me lights the menu item with the beam, hugging it');
  const anim = await beam(p).evaluate((e) => getComputedStyle(e).animationName + '|' + getComputedStyle(e, '::before').animationName);
  log(/guide-halo/.test(anim) && /guide-sweep/.test(anim), 'beam animates softly (' + anim + ')');
  await p.screenshot({ path: '/tmp/guide-beam-laptop.png' });
  await p.locator('[data-guide-target="nav:/trainee/my-activity"]').first().click(); await p.waitForTimeout(900);
  log(/my-activity/.test(p.url()) && await beam(p).count() === 0, 'using the highlighted item clears the highlight and goes there');

  // action intent navigates by itself
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await openChat(p);
  await say(p, 'Open messages');
  await p.waitForURL(/trainee\/messages/, { timeout: 6000 }).catch(() => {});
  log(/trainee\/messages/.test(p.url()), 'Open messages goes straight there');
  // not-allowed
  await p.goto(B + '/trainee/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await openChat(p);
  await say(p, 'Where is the staff analytics page for command center?');
  await say(p, 'How do I message an employer?');
  last = await p.locator('#loop-panel [role="log"] > div').last().innerText();
  console.log('   (approved answer shown as:', last.replace(/\n/g, ' | ').slice(0, 150), ')');

  // ---- employer: cannot be sent to a trainee page
  const e = await signedIn(br, { viewport: { width: 1366, height: 800 } }, '/api/auth/employer-login', 'employer@dev.test');
  const pe = await e.newPage(); pe.setDefaultTimeout(15000); pe.on('pageerror', (x) => errs.push(x.message.slice(0, 90)));
  await pe.goto(B + '/employer/dashboard', { waitUntil: 'load' }); await pe.waitForTimeout(2000);
  await openChat(pe);
  await say(pe, 'Where can I see my assessment results?');
  last = await pe.locator('#loop-panel [role="log"] > div').last().innerText();
  log(/available to trainees/.test(last) && /doesn't have access/.test(last), 'employer is told the feature belongs to trainees');
  log(await pe.locator('#loop-panel').getByRole('button', { name: /Open |Take me|Show me/ }).count() === 0 && await pe.locator('.guide-beam').count() === 0, 'employer gets no button and no highlight for it');
  await say(pe, 'Where are my messages?');
  last = await pe.locator('#loop-panel [role="log"] > div').last().innerText();
  await pe.getByRole('button', { name: 'Show me' }).click(); await pe.waitForTimeout(1000);
  log(await beamOver(pe, '[data-guide-target="nav:/employer/messages"]'), 'same question for an employer points at the employer Messages');

  // ---- visitor
  const v = await br.newContext({ viewport: { width: 1366, height: 800 } });
  const pv = await v.newPage(); pv.setDefaultTimeout(15000);
  await pv.goto(B + '/', { waitUntil: 'load' }); await pv.waitForTimeout(2000);
  await openChat(pv);
  await say(pv, 'Where are my messages?');
  last = await pv.locator('#loop-panel [role="log"] > div').last().innerText();
  log(/Sign in/.test(last), 'a visitor asking for a signed-in feature is told to sign in');
  await say(pv, 'zzz quantum blockchain llamas');
  last = await pv.locator('#loop-panel [role="log"] > div').last().innerText();
  log(/don't have a reliable answer/.test(last) && /recorded your question/.test(last), 'unknown question: honest, and says it was recorded');
  await pv.waitForTimeout(800);
  const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
  log(/llamas/.test(psql(`select text from "GuideUnanswered" where text like '%llamas%'`)), 'the unknown question reached the review queue');
  console.log('page errors:', errs.length ? errs : 'none');
  await br.close();
})().catch((e) => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
