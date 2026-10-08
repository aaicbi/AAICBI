const { chromium, devices } = require('/home/user/AAICBI/node_modules/playwright-core');
const fs = require('fs');
const { execSync } = require('child_process');
exports.B = 'http://localhost:3113';
exports.results = [];
exports.log = (ok, m) => { exports.results.push([ok, m]); console.log((ok ? 'PASS ' : 'FAIL ') + m); };
exports.launch = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
exports.device = (name, extra = {}) => { const d = { ...devices[name] }; delete d.defaultBrowserType; return { ...d, ...extra }; };
// The private test database only: clears login throttling so repeated runs are not locked out.
exports.clearThrottle = () => execSync(`/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev -c 'delete from "RateLimitBucket"'`, { stdio: 'ignore' });
// Log in once per account and reuse the session cookie.
exports.cookiesFor = async (loginPath, email, pw = 'Passw0rd!dev') => {
  const file = `/tmp/dev/cookies-${email}.json`;
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  exports.clearThrottle();
  const res = await fetch(exports.B + loginPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
  if (!res.ok) throw new Error('login failed ' + loginPath + ' ' + res.status);
  const raw = res.headers.getSetCookie();
  const cookies = raw.map((c) => { const [nv, ...attrs] = c.split(';'); const i = nv.indexOf('='); return { name: nv.slice(0, i), value: nv.slice(i + 1), url: exports.B }; });
  fs.writeFileSync(file, JSON.stringify(cookies));
  return cookies;
};
exports.signedIn = async (br, descriptor, loginPath, email, pw) => {
  const ctx = await br.newContext({ ...descriptor, serviceWorkers: 'allow' });
  await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: exports.B }, ...(await exports.cookiesFor(loginPath, email, pw))]);
  return ctx;
};
