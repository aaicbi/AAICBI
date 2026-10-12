const { B, log, launch, device, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const resend = (email) => fetch(B + '/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
(async () => {
  clearThrottle();
  const m = 'newmember@dev.test', f = 'newfounder@dev.test';
  psql(`delete from "Trainee" where email in ('${m}','${f}')`);
  const br = await launch();
  for (const [vName, desc] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['phone', device('iPhone 13')]]) {
    clearThrottle(); psql(`delete from "Trainee" where email='${m}'`);
    const ctx = await br.newContext(desc); await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
    const p = await ctx.newPage(); p.setDefaultTimeout(25000);
    await p.goto(B + '/trainee/register?next=%2Fcourses', { waitUntil: 'load' });
    await p.getByLabel('Full name').fill('Nia Newmember'); await p.locator('input[type=email]').fill(m); await p.locator('input[type=password]').first().fill('Passw0rd!dev');
    await p.locator('#privacyConsent').check();
    await p.getByRole('button', { name: 'Create account' }).click();
    await p.waitForURL(/\/trainee\/login\?/);
    const url = new URL(p.url());
    log(url.searchParams.get('registered') === '1' && url.searchParams.get('email') === m, `${vName}: after creating an account they land on the sign-in form`);
    log(url.searchParams.get('next') === '/courses', `${vName}: where they were going is kept`);
    const notice = p.getByTestId('signup-notice'); await notice.waitFor();
    const text = await notice.innerText();
    log(/verify your email/i.test(text) && text.includes(m) && /open it, then sign in/i.test(text), `${vName}: it tells them to verify their email and names the address`);
    log((await p.locator('input[type=email]').inputValue()) === m, `${vName}: their email is already filled in`);
    log(await p.locator('input[type=password]').first().evaluate((e) => e === document.activeElement), `${vName}: the cursor is in the password box`);
    if (vName === 'desktop') {
      const before = psql(`select "verifyToken" from "Trainee" where email='${m}'`);
      await p.getByRole('button', { name: 'Send the link again' }).click();
      await p.getByText('Sent again. Check your inbox.').waitFor();
      const after = psql(`select "verifyToken" from "Trainee" where email='${m}'`);
      log(before && after && before !== after, 'pressing "Send the link again" issues a fresh verification link');
    }
    await ctx.close();
  }
  const c2 = await br.newContext({ viewport: { width: 1280, height: 900 } }); const p2 = await c2.newPage();
  await p2.goto(B + '/trainee/login', { waitUntil: 'load' });
  log((await p2.getByTestId('signup-notice').count()) === 0, 'a normal visit to sign in shows no notice');
  await p2.goto(B + '/trainee/login?registered=1&email=%3Cscript%3E', { waitUntil: 'load' });
  log((await p2.getByTestId('signup-notice').innerText()).includes('your email address') && (await p2.locator('input[type=email]').inputValue()) === '', 'a made-up address in the link is ignored');
  await c2.close();

  clearThrottle();
  let r = await resend('nobody-here@dev.test'); log(r.status === 200, 'resend answers the same for an address with no account');
  psql(`update "Trainee" set "emailVerified"=true, "verifyToken"=null where email='${m}'`);
  r = await resend(m); log(r.status === 200 && psql(`select "verifyToken" is null from "Trainee" where email='${m}'`) === 't', 'resend does nothing for an account that is already verified');
  r = await resend('not-an-email'); log(r.status === 400, 'resend refuses something that is not an email address');
  clearThrottle(); const codes = []; for (let i = 0; i < 5; i++) codes.push((await resend('spammer@dev.test')).status);
  log(codes.slice(0, 3).every((c) => c === 200) && codes[3] === 429, `resend is limited to 3 an hour (${codes.join(',')})`);

  clearThrottle();
  const fc = await br.newContext({ viewport: { width: 1280, height: 900 } }); await fc.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const fp = await fc.newPage(); fp.setDefaultTimeout(25000);
  await fp.goto(B + '/startup/register', { waitUntil: 'load' });
  await fp.getByLabel('Your full name').fill('Femi Founder'); await fp.locator('input[type=email]').fill(f);
  await fp.locator('input[type=password]').first().fill('Passw0rd!dev'); await fp.getByLabel('Confirm password').fill('Passw0rd!dev');
  await fp.getByRole('checkbox').check(); await fp.getByRole('button', { name: 'Continue' }).click();
  await fp.getByLabel('Startup name').fill('Zeta Labs'); await fp.getByRole('button', { name: 'Continue' }).click();
  await fp.getByRole('button', { name: /Create Startup account/ }).click();
  await fp.waitForURL(/\/trainee\/login\?/);
  const fu = new URL(fp.url());
  log(fu.searchParams.get('registered') === '1' && fu.searchParams.get('email') === f && /^\/trainee\/startups\//.test(fu.searchParams.get('next') || ''), 'a founder also lands on the sign-in form, with their startup page as the next stop');
  log(/verify your email/i.test(await fp.getByTestId('signup-notice').innerText()), 'and is told to verify their email');
  await br.close();
  psql(`delete from "Startup" where name='Zeta Labs'`); psql(`delete from "Trainee" where email in ('${m}','${f}','spammer@dev.test')`);
})().catch((e) => { console.error(e); process.exit(1); });
