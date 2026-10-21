// Event Manager in a real browser (dark, the default): every screen on a desktop and on a phone, signed in as each kind of person.
// Seeds sample events through the API, takes screenshots to /tmp/dev/ev, checks for page errors and sideways scrolling, and cleans up.
const { B, launch, device, signedIn, clearThrottle, cookiesFor } = require('./lib.cjs');
const { execSync } = require('child_process');
const sql = (q) => execSync(`/usr/lib/postgresql/16/bin/psql -h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev -At -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const OUT = process.env.OUT || '/tmp/dev/ev';
const DESK = { colorScheme: 'dark', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { colorScheme: 'dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const local = (d) => new Date(d.getTime() + 3600e3).toISOString().slice(0, 16);
const at = (h, len = 2) => ({ startLocal: local(new Date(Date.now() + h * 3600e3)), endLocal: local(new Date(Date.now() + (h + len) * 3600e3)) });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const who = { super: ['/api/auth/login', 'super@dev.test'], org: ['/api/auth/training-org-login', 'org@dev.test'], t11: ['/api/auth/trainee-login', 't11@dev.test'] };
async function api(k, method, path, body) {
  const ck = (await cookiesFor(...who[k])).map((c) => `${c.name}=${c.value}`).join('; ');
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: ck }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
}
(async () => {
  clearThrottle();
  sql(`delete from "Event" where title like 'Demo %'`);
  const base = { timeZone: 'Africa/Lagos', registrationMode: 'OPEN' };
  const mk = async (k, path, data, extra = {}) => (await api(k, 'POST', path, { action: 'schedule', data: { ...base, ...data }, ...extra })).j.event?.id;
  const s1 = await mk('super', '/api/admin/events', { title: 'Demo AI Capacity Summit 2027', summary: 'A full-day public summit on building AI skills across Africa.', description: 'Keynotes, workshops and a demo showcase.\n\nBring a laptop.', eventType: 'COMMUNITY', delivery: 'HYBRID', venueName: 'Landmark Centre', address: 'Water Corporation Rd, Victoria Island', city: 'Lagos', state: 'Lagos', meetingUrl: 'https://meet.google.com/abc-defg-hij', passcode: 'summit-2027', joinInstructions: 'Use your real name.', audience: 'PUBLIC', registrationMode: 'REGISTRATION', capacity: 200, categoryId: 'evcat_community', ...at(72, 8) });
  await api('super', 'POST', `/api/admin/events/${s1}/promotion`, { action: 'publish' });
  const s2 = await mk('super', '/api/admin/events', { title: 'Demo Live: Prompt Engineering Basics', summary: 'A one-hour webinar open to everyone.', eventType: 'WEBINAR', delivery: 'ONLINE', meetingUrl: 'https://us02web.zoom.us/j/123456789', passcode: 'zoom-1', audience: 'PUBLIC', registrationMode: 'OPEN', categoryId: 'evcat_webinar', ...at(0.1, 1) });
  await api('super', 'POST', `/api/admin/events/${s2}/promotion`, { action: 'publish' });
  const o1 = await mk('org', '/api/org/events', { title: 'Demo Northwind Open Day', summary: 'Meet our trainers and tour the lab.', description: 'Free entry. Light refreshments.', eventType: 'COMMUNITY', delivery: 'PHYSICAL', venueName: 'Northwind Campus', address: '12 Allen Avenue', city: 'Ikeja', audience: 'PUBLIC', ...at(120, 3) });
  await api('org', 'POST', `/api/org/events/${o1}/promotion`, { action: 'submit' });
  const o2 = await mk('org', '/api/org/events', { title: 'Demo Staff weekly meeting', summary: 'Weekly planning.', eventType: 'STAFF_MEETING', delivery: 'ONLINE', meetingUrl: 'https://teams.microsoft.com/l/meetup-join/xyz', audience: 'ORG_STAFF', ...at(30, 1) });
  const o3 = await mk('org', '/api/org/events', { title: 'Demo Live class: Data cleaning', summary: 'Hands-on session for the SQL cohort.', eventType: 'LIVE_TRAINING', delivery: 'ONLINE', meetingUrl: 'https://meet.google.com/xyz-abcd-efg', audience: 'ORG_MEMBERS', registrationMode: 'REGISTRATION', capacity: 30, ...at(26, 2) });
  const o4 = (await api('org', 'POST', '/api/org/events', { action: 'save', data: { ...base, title: 'Demo Draft workshop', ...at(200, 2) } })).j.event?.id;
  ok(s1 && s2 && o1 && o2 && o3 && o4, 'sample events created');
  await api('t11', 'POST', `/api/events/${s1}/register`, {});

  const br = await launch();
  const shots = [];
  const page = async (who2, kind, path, name, fn) => {
    const ctx = who2 ? await signedIn(br, kind === 'm' ? PHONE : DESK, ...who[who2]) : await br.newContext(kind === 'm' ? PHONE : DESK);
    if (!who2) await ctx.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|vitals|sw\.js|manifest/.test(m.text())) errs.push(m.text()); });
    await p.goto(B + path, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await p.waitForTimeout(1800);
    await p.locator('button:has-text("Not now")').first().click({ timeout: 600 }).catch(() => {});
    if (fn) await fn(p);
    await p.waitForTimeout(300);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await p.screenshot({ path: `${OUT}/${name}-${kind === 'm' ? 'mobile' : 'desktop'}.png`, fullPage: false });
    ok(errs.length === 0, `${name} (${kind}) has no page errors${errs.length ? ': ' + errs[0].slice(0, 120) : ''}`);
    if (kind === 'm') ok(overflow <= 1, `${name} does not scroll sideways on a phone (${overflow}px)`);
    await ctx.close();
  };
  const big = async (p) => { await p.screenshot({ path: `${OUT}/x.png` }); };
  for (const kind of ['d', 'm']) {
    await page('super', kind, '/admin/events', 'admin-overview');
    await page('super', kind, '/admin/events?section=promotions', 'admin-promotions');
    await page('super', kind, '/admin/events?section=calendar', 'admin-calendar');
    await page('super', kind, '/admin/events?section=all', 'admin-all');
    await page('super', kind, `/admin/events/${s1}`, 'admin-detail');
    await page('super', kind, '/admin/events/new', 'admin-new', async (p) => { await p.fill('input[type=text]:visible >> nth=0', 'Demo form title').catch(() => {}); });
    await page('super', kind, '/admin/events?section=settings', 'admin-settings');
    await page('org', kind, '/admin/organization/events', 'org-events');
    await page('org', kind, '/admin/organization/events?section=promotions', 'org-promotions');
    await page('org', kind, `/admin/organization/events/${o1}`, 'org-detail');
    await page('org', kind, `/admin/organization/events/${o3}?tab=registrations`, 'org-registrations');
    await page('org', kind, '/admin/organization/events/new', 'org-new');
    await page('org', kind, '/admin/organization', 'org-dashboard');
    await page(null, kind, '/events', 'public-events');
    await page('t11', kind, '/events', 'trainee-events');
    await page('t11', kind, `/events/${s1}`, 'event-detail');
    await page('t11', kind, `/events/${s2}`, 'event-detail-live', async (p) => { await p.locator('button:has-text("Join live session")').click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(800); });
    await page(null, kind, `/events/${s1}`, 'event-detail-visitor');
    await page(null, kind, '/', 'feed-visitor');
    await page('t11', kind, '/trainee/dashboard', 'trainee-dashboard');
  }
  await br.close();
  sql(`delete from "Event" where title like 'Demo %'`);
  console.log(fail ? `\n${fail} failed` : '\nall passed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
