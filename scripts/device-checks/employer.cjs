const { B, log, launch, device, signedIn } = require('./lib.cjs');
(async () => {
  const br = await launch();
  let ctx = await signedIn(br, device('Pixel 7'), '/api/auth/employer-login', 'employer@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(B + '/employer/dashboard', { waitUntil: 'load' });
  const tabs = (await p.getByRole('navigation', { name: 'Main' }).locator('a, button').allInnerTexts()).map(t => t.replace(/\d+\s*unread\s*/i, '').trim());
  log(JSON.stringify(tabs) === JSON.stringify(['Home', 'Messages', 'Talent', 'Alerts', 'More']), 'Pixel 7 employer tabs: ' + JSON.stringify(tabs));
  const heads = await p.evaluate(() => [...document.querySelectorAll('main h2')].map(e => e.textContent.trim()));
  console.log('   employer phone home:', JSON.stringify(heads));
  log(heads[0]?.startsWith('Alerts') && heads[1] === 'Messages', 'employer home leads with Alerts then Messages');
  await p.screenshot({ path: '/tmp/dev/employer-phone-home.png' });

  // ---- messaging permissions through the real API
  const post = (path, data) => ctx.request.post(B + path, { data });
  const contacts = await (await ctx.request.get(B + '/api/conversations/contacts')).json();
  console.log('   employer contacts:', JSON.stringify(contacts.map(c => c.type + ':' + c.name)));
  const t0 = contacts.find(c => c.name === 'Amara Nwosu');
  log(!!t0, 'employer can see the trainee who accepted the introduction');
  log(!contacts.some(c => c.name === 'Ngozi Eze'), 'employer cannot see a trainee they have no relationship with');
  // find t5 id through the superadmin-free route: use prisma-free lookup by trying a known-bad id via the trainee list is not available, so use DB
  const { execFileSync } = require('child_process');
  const sql = (q) => execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
  const t5 = sql(`select id from "Trainee" where email='t5@dev.test'`);
  const denied = await post('/api/conversations/direct', { peerType: 'TRAINEE', peerId: t5 });
  log(denied.status() === 403, 'employer cannot open a chat with an unrelated trainee (' + denied.status() + ')');
  const emp2 = await post('/api/conversations/direct', { peerType: 'EMPLOYER', peerId: 'x' });
  log(emp2.status() === 403 || emp2.status() === 404, 'employer cannot message an employer (' + emp2.status() + ')');
  const ok = await post('/api/conversations/direct', { peerType: 'TRAINEE', peerId: t0.id });
  log(ok.ok(), 'employer can open a chat with the trainee who accepted');
  const convId = (await ok.json()).id;

  // ---- UI: send a message on the phone
  await p.goto(B + '/employer/messages/' + convId, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const box = p.getByPlaceholder('Write a message…');
  await box.fill('Hello Amara, we would like to talk about the analyst role.');
  // draft survives a reload
  await p.reload({ waitUntil: 'load' });
  log((await p.getByPlaceholder('Write a message…').inputValue()).startsWith('Hello Amara'), 'unsent draft survives a reload');
  await p.getByRole('button', { name: 'Send' }).click();
  await p.waitForTimeout(800);
  log(await p.getByText('we would like to talk about the analyst role').first().isVisible(), 'sent message appears in the thread');
  log((await p.getByPlaceholder('Write a message…').inputValue()) === '', 'composer is cleared after sending');
  // offline send keeps the text
  await p.getByPlaceholder('Write a message…').fill('Second message while offline');
  await ctx.setOffline(true);
  await p.getByRole('button', { name: 'Send' }).click();
  await p.waitForTimeout(600);
  log((await p.getByPlaceholder('Write a message…').inputValue()) === 'Second message while offline', 'offline send keeps the text in the box');
  log(await p.getByText(/You're offline/).first().isVisible(), 'offline notice is shown');
  await ctx.setOffline(false);
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/dev/employer-thread-phone.png' });

  // ---- the trainee is notified, without the text
  const n = sql(`select title || ' | ' || body from "UserNotification" where "recipientType"='TRAINEE' and type='NEW_MESSAGE' order by "createdAt" desc limit 1`);
  console.log('   trainee notification:', n);
  log(/New message from Kora Analytics/.test(n) && !/analyst role/.test(n), 'trainee notification names the sender and never shows the text');
  await ctx.close();

  // ---- trainee side: sees the employer, unread first, can reply
  ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  p = await ctx.newPage(); p.setDefaultTimeout(20000);
  await p.goto(B + '/trainee/messages', { waitUntil: 'load' });
  await p.getByText('Kora Analytics').first().waitFor({ timeout: 10000 }).catch(() => {});
  log(await p.getByText('Kora Analytics').first().isVisible(), 'trainee inbox lists the employer conversation');
  log(await p.getByText(/unread/).first().isVisible(), 'trainee inbox shows an unread count');
  await p.getByPlaceholder('Search people and messages').fill('kora');
  log(await p.getByText('Kora Analytics').first().isVisible(), 'inbox search finds it');
  await p.getByPlaceholder('Search people and messages').fill('zzzz');
  log(await p.getByText(/Nothing matches/).isVisible(), 'inbox search shows a message when nothing matches');
  await p.screenshot({ path: '/tmp/dev/trainee-inbox-phone.png' });
  const alerts = await (await ctx.request.get(B + '/api/notifications')).json();
  log(alerts.unreadCount > 0, 'trainee alerts count includes the new message (' + alerts.unreadCount + ')');
  console.log('page errors:', errors.length ? errors : 'none');
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 600)); process.exit(1); });
