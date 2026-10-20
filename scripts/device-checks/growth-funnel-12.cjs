// Growth funnel: the animated play card on the public About page. It must appear only while a course link is live, offer that course's funnel link
// tagged "about", play as a muted looping video (the still card for people who want less motion), open the funnel when tapped, and fit a phone.
const { B, log, launch, device, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers }; };
(async () => {
  clearThrottle();
  const own = psql(`select id from "Course" where id like 'cmv9pcwjh%'`);
  for (const t of ['GrowthScholarship', 'GrowthSquad', 'GrowthLead', 'GrowthGrant', 'GrowthGuestPlay', 'GrowthTasterQuestion', 'GrowthCampaign', 'GrowthSetting', 'GrowthAudit']) psql(`delete from "${t}"`);
  psql(`update "Course" set published=true, status='PUBLISHED' where id='${own}'`);
  const S = await jar('/api/auth/login', 'super@dev.test');
  const featured = (q = '') => call(null, 'GET', '/api/public/growth/featured' + q);

  // ---- nothing live
  let r = await featured('?src=about');
  log(r.s === 200 && r.j.live === false, 'with no link live the answer is "not live", and needs no sign-in');
  const br = await launch();
  const mk = async (opts) => { const c = await br.newContext({ serviceWorkers: 'block', ...opts }); await c.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]); return c.newPage(); };
  let pg = await mk({ viewport: { width: 1280, height: 900 } });
  await pg.goto(`${B}/about`); await pg.waitForLoadState('networkidle');
  log((await pg.getByTestId('play-card-banner').count()) === 0, 'the About page shows no card');

  // ---- make the link live
  await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'propose' });
  for (const q of (await call(S, 'GET', `/api/admin/courses/${own}/growth`)).j.taster.questions) await call(S, 'POST', `/api/admin/courses/${own}/growth`, { action: 'approve', questionId: q.questionId });
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: true });
  r = await featured('?src=about');
  log(r.j.live === false, 'a course switched on but blocked by the master switch is still not offered');
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'PLATFORM', enabled: true });
  await call(S, 'POST', '/api/admin/growth', { action: 'global', scope: 'OWN', enabled: true });
  const slug = psql(`select slug from "GrowthCampaign" where "courseId"='${own}'`);
  r = await featured('?src=about');
  log(r.j.live === true && r.j.link.endsWith(`/play/${slug}?src=about`) && /\w/.test(r.j.title), 'the moment every switch is on it is offered at once, with the funnel link tagged "about"');
  log((await featured('?src=Lagos%20Group!')).j.link.endsWith('?src=lagos-group') && !(await featured()).j.link.includes('?src='), 'the label is cleaned, and left off when not given');
  log(/s-maxage=60/.test((await featured('?src=about')).h.get('cache-control') || '') && !/token|email|phone/i.test(JSON.stringify(r.j)), 'it can be cached for a minute and carries nothing private');

  // ---- the card on the page (desktop)
  pg = await mk({ viewport: { width: 1280, height: 900 } });
  await pg.goto(`${B}/about`);
  await pg.getByTestId('play-card-banner').waitFor();
  const link = await pg.getByTestId('play-card-link').getAttribute('href');
  log(link.endsWith(`/play/${slug}?src=about`), 'the About page shows the card, linking to the funnel (' + link.replace(/^https?:\/\/[^/]+/, '') + ')');
  const vid = await pg.getByTestId('play-card-video').evaluate((v) => ({ autoplay: v.autoplay, muted: v.muted, loop: v.loop, inline: v.playsInline, src: [...v.querySelectorAll('source')].map((x) => x.getAttribute('src')).join(','), poster: v.getAttribute('poster') }));
  log(vid.autoplay && vid.muted && vid.loop && vid.inline && vid.src === '/growth/play-card.mp4,/growth/play-card.webm' && vid.poster === '/growth/play-card-still.webp', 'it is a muted, looping, auto-playing video (MP4, with WebM for browsers that cannot decode it) with the still card as its poster');
  log((await pg.getByTestId('play-card-still').evaluate((i) => i.complete && i.naturalWidth)) === 1200, 'the still card loads');
  const ratio = await pg.getByTestId('play-card-link').evaluate((a) => { const b = a.getBoundingClientRect(); return b.width / b.height; });
  log(Math.abs(ratio - 1200 / 630) < 0.02, 'the card keeps its shape (' + ratio.toFixed(2) + ')');
  const txt = await pg.getByTestId('play-card-banner').innerText();
  log(/beat|builder/i.test(txt) && /Tap the card to play/.test(txt) && /Play now/.test(txt), 'a caption tells people to tap, and there is a Play now button');
  await pg.getByTestId('play-card-banner').scrollIntoViewIfNeeded();
  await pg.waitForTimeout(1500);
  const playing = await pg.getByTestId('play-card-video').evaluate((v) => ({ paused: v.paused, t: v.currentTime }));
  log(playing.paused === false && playing.t > 0, 'the video is really playing (at ' + playing.t.toFixed(1) + 's)');
  await pg.getByTestId('play-card-banner').screenshot({ path: '/tmp/dev/growth12-about-desktop.png' });
  // tapping the card opens the funnel
  await pg.getByTestId('play-card-link').click();
  await pg.getByTestId('growth-start').waitFor();
  log(pg.url().includes(`/play/${slug}`) && pg.url().includes('src=about'), 'tapping the card opens the free challenge');
  await pg.getByTestId('growth-start').click();
  await pg.getByTestId('growth-question').waitFor();
  log(psql(`select source from "GrowthGuestPlay" order by "startedAt" desc limit 1`) === 'about', 'and the player is counted as coming from the About page');
  // the Play now button goes to the same place
  pg = await mk({ viewport: { width: 1280, height: 900 } });
  await pg.goto(`${B}/about`); await pg.getByTestId('play-card-button').waitFor();
  log((await pg.getByTestId('play-card-button').getAttribute('href')) === link, 'the Play now button goes to the same link');

  // ---- less motion: the still card instead of the video
  const rm = await mk({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await rm.goto(`${B}/about`); await rm.getByTestId('play-card-banner').waitFor();
  log((await rm.getByTestId('play-card-video').evaluate((v) => getComputedStyle(v).display)) === 'none' && (await rm.getByTestId('play-card-still').isVisible()), 'for people who ask for less motion the video is hidden and the still card shows');

  // ---- phone
  const pm = await mk({ ...device('iPhone 13') });
  await pm.goto(`${B}/about`); await pm.getByTestId('play-card-banner').waitFor();
  log(await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone');
  const small = await pm.getByTestId('play-card-link').evaluate((a) => a.getBoundingClientRect().width);
  log(small > 300, 'and the card fills the phone width (' + Math.round(small) + 'px)');
  await pm.getByTestId('play-card-banner').scrollIntoViewIfNeeded(); await pm.waitForTimeout(800);
  await pm.getByTestId('play-card-banner').screenshot({ path: '/tmp/dev/growth12-about-phone.png' });
  log((await pm.getByTestId('play-card-button').boundingBox()).height >= 44, 'the Play now button is a comfortable tap target');

  // ---- switched off: gone again
  await call(S, 'POST', '/api/admin/growth', { action: 'course', courseId: own, enabled: false });
  r = await featured('?src=about');
  log(r.j.live === false, 'switch the course off and it is not offered at once');
  pg = await mk({ viewport: { width: 1280, height: 900 } });
  await pg.goto(`${B}/about`); await pg.waitForLoadState('networkidle');
  log((await pg.getByTestId('play-card-banner').count()) === 0, 'and the card is gone from the About page');
  await br.close();
  const failed = results.filter((x) => !x[0]);
  console.log(failed.length ? `\n${failed.length} FAILED` : '\nALL PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
