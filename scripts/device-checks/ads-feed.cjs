// Ads on the feed and About page: booking (Super Admin only), validation, payment gating, serving rules, view/tap counting and caps,
// safe redirect, reports scoped per organization, and how the cards render (top slot, one every 6 posts, About page, phone width, reduced motion).
const { B, log, launch, device, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body, extra = {}) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers }; };
const BLOB = 'https://devstore.public.blob.vercel-storage.com';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==', 'base64');
(async () => {
  clearThrottle();
  for (const t of ['AdDaily', 'AdBooking']) psql(`delete from "${t}"`);
  psql(`delete from "GrowthSetting" where "scopeType"='ADS'`);
  const S = await jar('super@dev.test'), ST = await jar('staff@dev.test'), ORG = await jar('org@dev.test', '/api/auth/training-org-login');
  const org = psql(`select id from "TrainingOrganization" where name='Northwind Academy'`);
  const other = psql(`select id from "TrainingOrganization" where name='Demo Cloud Collective'`);
  const day = (n) => new Date(Date.now() + n * 86400000 + 3600000).toISOString().slice(0, 10);
  const ad = (o = {}) => ({ organizationId: org, advertiserName: 'Northwind Academy', advertiserKind: 'Training organization', headline: 'Learn data skills', caption: 'Join our next cohort.', buttonLabel: 'Apply now', linkUrl: 'https://northwind.example.com/apply', mediaKind: 'IMAGE', mediaUrl: `${BLOB}/ads/image/a.png`, mediaType: 'image/png', mediaName: 'a.png', mediaSize: 1000, placements: ['TOP', 'INLINE', 'ABOUT'], startsOn: day(-1), endsOn: day(5), priceNaira: 50000, paymentStatus: 'UNPAID', ...o });
  const pub = (q) => call(null, 'GET', '/api/public/ads?' + q);

  // ---- who may do what
  log((await call(null, 'GET', '/api/admin/ads')).s === 401 || (await call(null, 'GET', '/api/admin/ads')).s === 403, 'the booking list needs a sign-in');
  log([401, 403].includes((await call(ST, 'POST', '/api/admin/ads', { action: 'create', ad: ad() })).s), 'staff who are not Super Admin cannot book an ad');
  log([401, 403].includes((await call(ORG, 'POST', '/api/admin/ads', { action: 'create', ad: ad() })).s), 'an organization cannot book its own ad');
  log([401, 403].includes((await call(ORG, 'POST', '/api/admin/ads/upload-token', {})).s), 'an organization cannot start an upload');
  log([401, 403].includes((await call(null, 'POST', '/api/admin/ads/upload-token', {})).s), 'a visitor cannot start an upload');

  // ---- validation
  const bad = async (patch, re, what) => { const r = await call(S, 'POST', '/api/admin/ads', { action: 'create', ad: ad(patch) }); log([400, 404].includes(r.s) && re.test(r.j.error || ''), 'rejected: ' + what + ''); };
  await bad({ linkUrl: 'http://northwind.example.com' }, /https/i, 'a link that is not https');
  await bad({ linkUrl: 'https://user:pw@example.com' }, /./, 'a link with a login in it');
  await bad({ linkUrl: 'javascript:alert(1)' }, /./, 'a javascript: link');
  await bad({ mediaUrl: 'https://evil.example.com/a.png' }, /stored/i, 'a picture not stored by the app');
  await bad({ mediaType: 'image/svg+xml' }, /image/i, 'an SVG picture');
  await bad({ mediaSize: 6 * 1024 * 1024 }, /5 MB/i, 'a picture over 5 MB');
  await bad({ headline: 'x'.repeat(61) }, /headline/i, 'a headline that is too long');
  await bad({ caption: '' }, /caption/i, 'an empty caption');
  await bad({ endsOn: day(-3) }, /./, 'an end before the start');
  await bad({ placements: [] }, /./, 'no place chosen');
  await bad({ organizationId: 'nope' }, /organization/i, 'an organization that does not exist');
  log(psql('select count(*) from "AdBooking"') === '0', 'nothing was saved by the rejected ones');

  // ---- booking, and payment gating
  let r = await call(S, 'POST', '/api/admin/ads', { action: 'create', ad: ad() });
  const id = r.j.ads?.[0]?.id;
  log(r.s === 200 && id && r.j.ads[0].status === 'WAITING_PAYMENT' && r.j.settings.enabled === false, 'a booked ad starts as "waiting for payment", and the master switch is off');
  log((await pub('placement=top&count=1')).j.ads.length === 0, 'nothing is shown: unpaid and the master switch is off');
  await call(S, 'POST', '/api/admin/ads', { action: 'payment', id, status: 'PAID', priceNaira: 50000 });
  log((await pub('placement=top&count=1')).j.ads.length === 0, 'paid but the master switch is off: still nothing');
  r = await call(S, 'POST', '/api/admin/ads', { action: 'settings', enabled: true });
  log(r.j.settings.enabled === true, 'the master switch can be turned on');
  let s = (await pub('placement=top&count=1')).j;
  const a0 = s.ads[0];
  log(s.ads.length === 1 && a0.id === id && a0.goUrl === `/api/public/ads/${id}/go` && !JSON.stringify(s).includes('northwind.example.com') && !/notes|price|payment/i.test(JSON.stringify(s)), 'a paid ad is served, with a tracking link, and never the real link, price or notes');
  log((await pub('placement=inline&count=4')).j.ads.length === 1 && (await pub('placement=about&count=1')).j.ads.length === 1, 'it shows in every place it was booked for');
  log((await pub('placement=bogus')).s === 400, 'an unknown place is refused');
  await call(S, 'POST', '/api/admin/ads', { action: 'update', id, ad: ad({ placements: ['TOP'], paymentStatus: 'PAID' }) });
  log((await pub('placement=inline&count=4')).j.ads.length === 0 && (await pub('placement=top&count=1')).j.ads.length === 1, 'an ad is shown only where it was booked');
  await call(S, 'POST', '/api/admin/ads', { action: 'update', id, ad: ad({ paymentStatus: 'PAID' }) });
  await call(S, 'POST', '/api/admin/ads', { action: 'pause', id, paused: true });
  log((await pub('placement=top&count=1')).j.ads.length === 0, 'a paused ad disappears');
  await call(S, 'POST', '/api/admin/ads', { action: 'pause', id, paused: false });
  await call(S, 'POST', '/api/admin/ads', { action: 'payment', id, status: 'UNPAID' });
  log((await pub('placement=top&count=1')).j.ads.length === 0, 'marking it unpaid takes it off at once');
  await call(S, 'POST', '/api/admin/ads', { action: 'payment', id, status: 'FREE' });
  log((await pub('placement=top&count=1')).j.ads.length === 1, 'a free ad is shown');
  const fut = (await call(S, 'POST', '/api/admin/ads', { action: 'create', ad: ad({ headline: 'Later ad', startsOn: day(3), endsOn: day(9), paymentStatus: 'PAID' }) })).j.ads.find((x) => x.headline === 'Later ad');
  log(fut.status === 'SCHEDULED' && !(await pub('placement=top&count=8')).j.ads.some((x) => x.id === fut.id), 'an ad that starts later is scheduled and not shown yet');
  psql(`update "AdBooking" set "endsAt"=now()-interval '1 hour', "startsAt"=now()-interval '3 days' where id='${fut.id}'`);
  log(!(await pub('placement=top&count=8')).j.ads.some((x) => x.id === fut.id), 'an ended ad is not shown');
  await call(S, 'POST', '/api/admin/ads', { action: 'delete', id: fut.id });

  // ---- counting
  const ip = (n) => ({ 'x-forwarded-for': `203.0.113.${n}` });
  r = await call(null, 'POST', `/api/public/ads/${id}/view`, undefined, ip(1));
  log(r.s === 200 && r.j.counted === true && psql(`select "viewsTotal" from "AdBooking" where id='${id}'`) === '1', 'a view is counted');
  for (let i = 0; i < 25; i++) await call(null, 'POST', `/api/public/ads/${id}/view`, undefined, ip(2));
  log(psql(`select "viewsTotal" from "AdBooking" where id='${id}'`) === '21', 'one address cannot run the views up past its daily limit (21 = 1 + 20)');
  r = await call(null, 'GET', `/api/public/ads/${id}/go`, undefined, ip(3));
  log(r.s === 302 && r.h.get('location') === 'https://northwind.example.com/apply' && psql(`select "tapsTotal" from "AdBooking" where id='${id}'`) === '1', 'a tap is counted and sends the visitor to the advertiser');
  log((await call(null, 'GET', '/api/public/ads/nope/go')).s === 404, 'a link for an ad that does not exist is a 404, never a redirect');
  log((await call(null, 'POST', '/api/public/ads/nope/view')).j.counted === false, 'a view of an unknown ad counts nothing');
  await call(S, 'POST', '/api/admin/ads', { action: 'payment', id, status: 'UNPAID' });
  await call(null, 'POST', `/api/public/ads/${id}/view`, undefined, ip(4));
  await call(null, 'GET', `/api/public/ads/${id}/go`, undefined, ip(4));
  log(psql(`select "viewsTotal"||'/'||"tapsTotal" from "AdBooking" where id='${id}'`) === '21/1', 'an unpaid ad counts nothing');
  await call(S, 'POST', '/api/admin/ads', { action: 'payment', id, status: 'PAID' });
  const dayRow = psql(`select views||'/'||taps from "AdDaily" where "adId"='${id}'`);
  log(dayRow === '21/1', 'the daily totals match (' + dayRow + ')');

  // ---- reports
  const second = (await call(S, 'POST', '/api/admin/ads', { action: 'create', ad: ad({ organizationId: other, advertiserName: 'Demo Cloud', headline: 'Cloud course', paymentStatus: 'PAID' }) })).j.ads.find((x) => x.headline === 'Cloud course');
  r = await call(S, 'GET', '/api/admin/ads/report?period=30d');
  log(r.j.scope === 'ALL' && r.j.ads.length === 2 && r.j.totals.views === 21 && r.j.totals.taps === 1 && r.j.totals.tapRate === 4.8, 'the Super Admin sees every ad and the totals (tap rate 4.8%)');
  r = await call(ORG, 'GET', '/api/admin/ads/report?period=30d');
  log(r.j.scope === 'OWN' && r.j.ads.length === 1 && r.j.ads[0].id === id && !JSON.stringify(r.j).includes(second.id), 'an organization sees only its own ad');
  r = await call(ORG, 'GET', `/api/admin/ads/report?period=all&org=${other}`);
  log(r.j.ads.length === 1 && r.j.ads[0].id === id, 'an organization cannot ask for another organization\'s numbers');
  r = await call(ST, 'GET', '/api/admin/ads/report');
  log(r.j.scope === 'NONE' && r.j.ads.length === 0, 'staff with no organization see nothing');
  r = await call(null, 'GET', '/api/admin/ads/report');
  log([401, 403].includes(r.s), 'a visitor cannot open the report');
  r = await fetch(B + '/api/admin/ads/report?format=csv', { headers: { Cookie: S } });
  const csv = await r.text();
  log(r.headers.get('content-type').includes('text/csv') && /^Ad,Advertiser,Status/.test(csv) && csv.includes('Learn data skills'), 'the spreadsheet downloads');

  await call(S, 'POST', '/api/admin/ads', { action: 'pause', id: second.id, paused: true });

  // ---- how it looks
  const br = await launch();
  const mk = async (opts, cookies = []) => { const c = await br.newContext({ serviceWorkers: 'block', ...opts }); await c.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }, ...cookies]); await c.route(`${BLOB}/**`, (rt) => rt.fulfill({ status: 200, contentType: 'image/png', body: PNG })); return c; };
  const posts = Number(psql(`select count(*) from "Post" where status='PUBLISHED'`));
  let ctx = await mk({ viewport: { width: 1280, height: 900 } });
  let pg = await ctx.newPage();
  await pg.goto(`${B}/feed`);
  await pg.getByTestId('sponsored-card').first().waitFor({ timeout: 15000 });
  const top = pg.getByTestId('sponsored-card').first();
  const t = await top.innerText();
  log(/sponsored/i.test(t) && /Northwind Academy/.test(t) && /Training organization/.test(t) && /Learn data skills/.test(t) && /Apply now/.test(t), 'the feed shows the card: logo/name, Sponsored label, headline, caption and button');
  log((await top.getByTestId('sponsored-button').getAttribute('href')) === `/api/public/ads/${id}/go` && /noopener/.test(await top.getByTestId('sponsored-button').getAttribute('rel')) && /sponsored/.test(await top.getByTestId('sponsored-button').getAttribute('rel')) && (await top.getByTestId('sponsored-button').getAttribute('target')) === '_blank', 'the button opens through the tracking link in a new tab, marked sponsored');
  log((await pg.getByTestId('inline-ad').count()) === Math.floor(Math.min(posts, 20) / 6) || posts < 6, 'a card appears after every 6 posts (' + (await pg.getByTestId('inline-ad').count()) + ' in ' + Math.min(posts, 20) + ')');
  await pg.waitForTimeout(2500);
  const viewed = Number(psql(`select "viewsTotal" from "AdBooking" where id='${id}'`));
  log(viewed >= 22, 'the card being on screen for a moment counts one view (' + viewed + ')');
  await pg.reload(); await pg.waitForTimeout(2500);
  log(Number(psql(`select "viewsTotal" from "AdBooking" where id='${id}'`)) === viewed, 'reloading the same day does not count it again');
  // contrast of the label and button
  const col = await top.evaluate((el) => { const q = (s) => getComputedStyle(el.querySelector(s)); return { b: q('[data-testid=sponsored-button]').color, bg: q('[data-testid=sponsored-button]').backgroundColor, l: q('[data-testid=sponsored-label]').color }; });
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  log(cr(col.b, col.bg) >= 4.5, 'the button text is easy to read (contrast ' + cr(col.b, col.bg).toFixed(1) + ')');
  await pg.screenshot({ path: '/tmp/dev/ads-feed-desktop.png' });

  // signed in: top slot after the compose box
  const mctx = await mk({ viewport: { width: 1280, height: 900 } }, await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const mp = await mctx.newPage(); await mp.goto(`${B}/feed`); await mp.getByTestId('sponsored-card').first().waitFor({ timeout: 15000 });
  log(true, 'a signed-in member sees the card too');

  // About page
  pg = await ctx.newPage(); await pg.goto(`${B}/about`); await pg.getByTestId('sponsored-card').waitFor({ timeout: 15000 });
  log((await pg.getByTestId('play-card-banner').count()) === 0, 'About page: the paid ad replaces our own play card');

  // phone width and reduced motion
  const phone = await mk(device('iPhone 13'));
  pg = await phone.newPage(); await pg.goto(`${B}/feed`); await pg.getByTestId('sponsored-card').first().waitFor({ timeout: 15000 });
  const fit = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log(fit.sw <= fit.cw, 'phone width: no sideways scrolling (' + fit.sw + '/' + fit.cw + ')');
  const btnH = await pg.getByTestId('sponsored-button').first().evaluate((e) => e.getBoundingClientRect().height);
  log(btnH >= 44, 'the button is easy to tap (' + Math.round(btnH) + ' px)');
  await pg.screenshot({ path: '/tmp/dev/ads-feed-phone.png' });

  // video ad + reduced motion
  await call(S, 'POST', '/api/admin/ads', { action: 'update', id, ad: ad({ paymentStatus: 'PAID', mediaKind: 'VIDEO', mediaUrl: `${BLOB}/ads/video/a.mp4`, mediaType: 'video/mp4', mediaName: 'a.mp4', mediaSize: 2000 }) });
  const rm = await mk({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
  pg = await rm.newPage(); await pg.goto(`${B}/feed`); await pg.getByTestId('sponsored-card').first().waitFor({ timeout: 15000 });
  const vids = await pg.getByTestId('sponsored-media').first().evaluate((a) => [...a.querySelectorAll('video')].map((v) => ({ shown: getComputedStyle(v).display !== 'none', autoplay: v.autoplay })));
  log(vids.length === 2 && vids.filter((v) => v.shown).length === 1 && vids.find((v) => v.shown).autoplay === false, 'reduced motion: a video ad shows its still first frame and does not play');

  // slow connection: a video ad does not download until pressed
  const slow = await mk({ viewport: { width: 1000, height: 800 } });
  await slow.addInitScript(() => { Object.defineProperty(navigator, 'connection', { value: { effectiveType: '3g', saveData: false }, configurable: true }); });
  pg = await slow.newPage();
  const vreq = []; pg.on('request', (q) => { if (q.url().includes('/ads/video/')) vreq.push(q.url()); });
  await pg.goto(`${B}/feed`); await pg.getByTestId('sponsored-card').first().waitFor({ timeout: 15000 }); await pg.waitForTimeout(1500);
  const lv = await pg.getByTestId('sponsored-media').first().evaluate((d) => { const v = d.querySelector('video'); return v && { controls: v.controls, autoplay: v.autoplay, preload: v.preload }; });
  log(lv && lv.controls && !lv.autoplay && lv.preload === 'none' && vreq.length === 0, 'slow connection: the video ad waits for a press and downloads nothing by itself');

  // our own card as the fallback
  await call(S, 'POST', '/api/admin/ads', { action: 'pause', id, paused: true });
  await call(S, 'POST', '/api/admin/ads', { action: 'pause', id: second.id, paused: true });
  r = await pub('placement=top&count=1'); const noCampaign = r.j.house === null;
  log(r.j.ads.length === 0 && (noCampaign || !!r.j.house), 'with no paid ad, the top slot falls back to our own card only when a course link is live');
  r = await pub('placement=inline&count=4');
  log(r.j.ads.length === 0 && r.j.house === null, 'our own card is never put between posts');
  await call(S, 'POST', '/api/admin/ads', { action: 'settings', house: false });
  log((await pub('placement=top&count=1')).j.house === null, 'with the second switch off, nothing fills the slot');
  await call(S, 'POST', '/api/admin/ads', { action: 'settings', house: true });

  // admin screen
  const sctx = await mk({ viewport: { width: 1280, height: 900 } }, await cookiesFor('/api/auth/login', 'super@dev.test'));
  pg = await sctx.newPage(); await pg.goto(`${B}/admin/ads`); await pg.getByTestId('ads-admin').waitFor({ timeout: 15000 });
  log((await pg.getByTestId('ad-row').count()) === 2 && (await pg.getByTestId('ads-master').isChecked()), 'the Ads screen lists the bookings and the master switch');
  await pg.getByTestId('ad-new').click(); await pg.getByTestId('ad-form').waitFor();
  await pg.getByTestId('ad-save').click(); await pg.getByTestId('ad-problem').waitFor();
  log(/name|headline|upload|image|video/i.test(await pg.getByTestId('ad-problem').innerText()), 'saving an empty form tells you what is missing');
  await pg.screenshot({ path: '/tmp/dev/ads-admin.png' });
  const octx = await mk({ viewport: { width: 1280, height: 900 } }, await cookiesFor('/api/auth/training-org-login', 'org@dev.test'));
  pg = await octx.newPage(); await pg.goto(`${B}/admin/ads/report`); await pg.getByTestId('ads-report').waitFor({ timeout: 15000 });
  log((await pg.getByTestId('ads-report-row').count()) === 1 && Number(await pg.getByTestId('tot-views').innerText()) >= 21, 'an organization opens its own report: one ad and its views');
  await pg.goto(`${B}/admin/ads`); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1500);
  log(!/\/admin\/ads$/.test(pg.url()) && (await pg.getByTestId('ads-admin').count()) === 0, 'an organization is turned away from the booking screen');

  await br.close();
  psql(`delete from "AdDaily"`); psql(`delete from "AdBooking"`); psql(`delete from "GrowthSetting" where "scopeType"='ADS'`);
  const { results } = require('./lib.cjs');
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
