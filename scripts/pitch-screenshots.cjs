// Takes clean phone screenshots of the live product for the pitch deck. Read-only: it only signs in and looks.
//   BASE_URL=https://aaicbi.org TRAINEE_EMAIL=you@example.com TRAINEE_PASSWORD='...' node scripts/pitch-screenshots.cjs [outDir]
// Use a real or demo trainee account that has some progress, so the screens are not empty. Pop-ups are dismissed first.
const { chromium, devices } = require('playwright-core');
const fs = require('fs');
const BASE = (process.env.BASE_URL || 'http://localhost:3113').replace(/\/$/, '');
const EMAIL = process.env.TRAINEE_EMAIL, PW = process.env.TRAINEE_PASSWORD;
const OUT = process.argv[2] || './pitch-screenshots';
const SCREENS = [
  ['01-dashboard', '/trainee/dashboard'],
  ['02-arena', '/trainee/arena'],
  ['03-performance-report', '/trainee/performance'],
  ['04-certificates', '/trainee/certificates'],
  ['05-feed', '/'],
];
(async () => {
  if (!EMAIL || !PW) { console.error('Set TRAINEE_EMAIL and TRAINEE_PASSWORD.'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const login = await fetch(BASE + '/api/auth/trainee-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PW }) });
  if (!login.ok) { console.error('Sign-in failed (' + login.status + '). Check the email and password.'); process.exit(1); }
  const cookies = login.headers.getSetCookie().map((c) => { const [nv] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), url: BASE }; });
  const exe = process.env.CHROMIUM_PATH || undefined;
  const br = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const d = { ...devices['iPhone 14'] }; delete d.defaultBrowserType;
  const ctx = await br.newContext({ ...d, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: BASE }, ...cookies]);
  const p = await ctx.newPage();
  async function clear() {
    for (const sel of ['button:has-text("Skip")', 'button[aria-label="Remind me later"]', 'button[aria-label="Dismiss this hint"]', 'button:has-text("Keep it public")']) {
      const b = p.locator(sel).first();
      if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 2000 }).catch(() => undefined); await p.waitForTimeout(300); }
    }
  }
  for (const [name, path] of SCREENS) {
    await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => undefined);
    await p.waitForTimeout(1200);
    await clear(); await clear();
    await p.screenshot({ path: `${OUT}/${name}.png` });
    console.log('saved', `${OUT}/${name}.png`);
  }
  await br.close();
})();
