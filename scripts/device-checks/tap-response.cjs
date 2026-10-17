const { B, log, launch, device, cookiesFor, signedIn } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const FAKE_YT = `
(function(){
  window.__players = [];
  window.YT = { Player: function(el, opts){
    var self = this, iframe = document.createElement('iframe'); iframe.src = 'about:blank'; iframe.setAttribute('data-fake','1');
    el.replaceWith(iframe);
    var rec = { id: opts.videoId, vars: opts.playerVars, host: opts.host, state: -1, muted: !!opts.playerVars.mute, calls: [], t: 0 };
    window.__players.push(rec);
    function set(s){ rec.state = s; opts.events && opts.events.onStateChange && opts.events.onStateChange({ data: s }); }
    this.playVideo = function(){ rec.calls.push('play'); set(1); };
    this.pauseVideo = function(){ rec.calls.push('pause'); set(2); };
    this.mute = function(){ rec.calls.push('mute'); rec.muted = true; };
    this.unMute = function(){ rec.calls.push('unmute'); rec.muted = false; };
    this.isMuted = function(){ return rec.muted; };
    this.seekTo = function(s){ rec.calls.push('seek:' + Math.round(s)); rec.t = s; };
    this.getCurrentTime = function(){ if (rec.state === 1) rec.t += 0.25; return rec.t; };
    this.getDuration = function(){ return 100; };
    this.getPlayerState = function(){ return rec.state; };
    this.destroy = function(){ rec.destroyed = true; };
    setTimeout(function(){ opts.events && opts.events.onReady && opts.events.onReady(); if (opts.playerVars.autoplay) { rec.state = 1; } }, 30);
  } };
  setTimeout(function(){ window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 10);
})();`;
const route = (p) => p.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_YT }));
const post = async (cookie, body) => (await (await fetch(B + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...body, submit: true }) })).json()).id;
(async () => {
  const ck = (await cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  psql(`delete from "Post" where "legacyEducationPostId" is null`);
  const filler = 'Filler post text that takes some room in the feed so the two videos are never both on screen. '.repeat(5);
  await post(ck, { title: 'Video two', body: 'second', youtubeUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' });
  for (let i = 0; i < 4; i++) await post(ck, { body: `${filler} (${i})` });
  await post(ck, { title: 'Video one', body: 'first', youtubeUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  const br = await launch();
  const ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000); await route(p);
  await p.goto(B + '/feed', { waitUntil: 'load' });
  const frames = p.getByTestId('video-frame'); await frames.first().waitFor(); await p.waitForTimeout(900);
  const st = () => p.evaluate(() => window.__players.map((x) => ({ id: x.id, state: x.state, calls: x.calls.slice() })));
  // 1. the second video, still below the screen, already has its player ready but is not playing
  let s = await st(); const top = (await frames.nth(1).boundingBox()).y;
  log(top > 844, 'the second video starts below the screen (y ' + Math.round(top) + ')');
  // scroll so it is within one screen but not yet visible
  await p.evaluate((y) => window.scrollBy(0, y - 844 - 200), top); await p.waitForTimeout(900);
  const vis = await frames.nth(1).evaluate((e) => e.getBoundingClientRect().top < window.innerHeight);
  s = await st(); const b = s.find((x) => x.id === 'bbbbbbbbbbb');
  log(!vis, 'it is still off screen');
  log(!!b && b.state !== 1, 'its player is already loaded and waiting, not playing');
  await frames.nth(1).evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  s = await st();
  log(s.find((x) => x.id === 'bbbbbbbbbbb').state === 1 && s.filter((x) => x.id === 'bbbbbbbbbbb').length === 1, 'when it reaches the screen it starts at once, with no second player created');
  // 2. pressing a link shows progress immediately, even while the next page is slow
  await p.route('**/jobs*', async (r) => { await new Promise((z) => setTimeout(z, 2500)); r.continue(); });
  await p.goto(B + '/feed', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const a = document.querySelector('a[href="/jobs"]'); if (!a) throw new Error('no jobs link'); a.click(); });
  const bar = p.getByRole('progressbar', { name: 'Loading page' });
  await bar.waitFor({ timeout: 800 });
  log(true, 'a progress bar shows within a moment of pressing a link');
  await p.waitForURL('**/jobs*'); await p.waitForTimeout(800);
  log((await bar.count()) === 0, 'and it goes away when the page arrives');
  await br.close();
  process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
