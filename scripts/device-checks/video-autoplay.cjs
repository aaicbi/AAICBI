const { B, log, launch, device, cookiesFor, signedIn } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
// A stand-in for YouTube's player interface: it records what the platform asks the player to do.
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
  const ids = [];
  ids.push(await post(ck, { title: 'Video two', body: 'second', youtubeUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }));
  for (let i = 0; i < 5; i++) ids.push(await post(ck, { body: `${filler} (${i})` }));
  const first = await post(ck, { title: 'Video one', body: 'first', youtubeUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' });
  const br = await launch();
  const ctx = await signedIn(br, device('iPhone 13'), '/api/auth/trainee-login', 't0@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000); await route(p);
  await p.goto(B + '/feed', { waitUntil: 'load' });
  const frames = p.getByTestId('video-frame');
  await frames.first().waitFor();
  const st = () => p.evaluate(() => window.__players.map((x) => ({ id: x.id, state: x.state, muted: x.muted, calls: x.calls.slice(), vars: x.vars, host: x.host })));
  const centre = async (i) => { await frames.nth(i).evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(900); };

  // 1. the first video on screen starts by itself, muted, with the platform's own controls
  await centre(0);
  let s = await st();
  log(s.length >= 1 && s[0].id === 'aaaaaaaaaaa' && s[0].state === 1, 'the first video on screen plays by itself');
  log(s[0].muted === true && s[0].vars.mute === 1, 'it starts muted');
  log(s[0].vars.controls === 0 && s[0].vars.fs === 0 && s[0].vars.playsinline === 1 && s[0].vars.iv_load_policy === 3 && s[0].host.includes('nocookie'), "YouTube's own controls are switched off (controls 0, no full-screen button, inline, no annotations)");
  log(s.filter((x) => x.state === 1).length === 1, 'only one video plays at a time');
  const iframePointer = await frames.first().locator('iframe').evaluate((e) => getComputedStyle(e).pointerEvents);
  log(iframePointer === 'none', "the player's frame cannot be clicked, so none of YouTube's buttons can be reached");
  const snd = frames.first().getByTestId('yt-sound');
  log((await snd.getAttribute('aria-label')) === 'Turn sound on', 'the speaker button is there, saying sound is off');
  const sb = await snd.boundingBox(), fb = await frames.first().boundingBox();
  log(sb && sb.x > fb.x + fb.width / 2 && sb.y > fb.y + fb.height / 2, 'the speaker sits in the bottom-right corner of the video');
  const shadow = await snd.evaluate((e) => getComputedStyle(e).boxShadow);
  log(/inset/.test(shadow) && shadow !== 'none', 'the speaker button is raised (embossed)');
  log((await frames.first().getAttribute('data-active')) === 'true', 'the playing video expands');
  const w1 = (await frames.first().boundingBox()).width;

  // 2. turn the sound on
  await snd.click(); s = await st();
  log(s[0].muted === false && (await snd.getAttribute('aria-label')) === 'Turn sound off', 'the speaker turns the sound on');

  // 3. scroll on to the second video: the first pauses, the second plays (with sound, as chosen)
  await centre(1); s = await st();
  const a = s.find((x) => x.id === 'aaaaaaaaaaa'), b = s.find((x) => x.id === 'bbbbbbbbbbb');
  log(a && a.state === 2, 'moving past the first video pauses it');
  log(b && b.state === 1, 'the next video plays');
  log(b && b.muted === false, 'it starts with sound, because the person turned the sound on');
  log((await frames.nth(0).getAttribute('data-active')) === 'false', 'the first video settles back to its smaller size');
  const w0 = (await frames.nth(0).boundingBox()).width;
  log(w1 > w0 + 20, `the playing video is wider than one that is not (${Math.round(w1)} px against ${Math.round(w0)} px)`);

  // 4. back to the first: it carries on
  await centre(0); s = await st();
  log(s.find((x) => x.id === 'aaaaaaaaaaa').state === 1 && s.find((x) => x.id === 'bbbbbbbbbbb').state === 2, 'scrolling back resumes the first and pauses the second');

  // 5. tap to pause stays paused, until you leave and come back
  await frames.first().getByRole('button', { name: /Pause video/ }).click(); s = await st();
  log(s.find((x) => x.id === 'aaaaaaaaaaa').state === 2, 'tapping the video pauses it');
  await p.waitForTimeout(600); s = await st();
  log(s.find((x) => x.id === 'aaaaaaaaaaa').state === 2, 'and it stays paused while it is on screen');
  await centre(1); await centre(0); s = await st();
  log(s.find((x) => x.id === 'aaaaaaaaaaa').state === 1, 'leaving and coming back plays it again');

  // 6. progress bar
  await p.waitForTimeout(700);
  const prog = await frames.first().getByTestId('yt-progress').evaluate((e) => parseFloat(e.style.width));
  log(prog > 0, `the progress bar moves (${prog.toFixed(2)}%)`);

  // 7. full screen opens the large view and pauses the one underneath
  await frames.first().getByRole('button', { name: /Full screen/ }).click();
  await p.getByRole('dialog').waitFor(); await p.waitForTimeout(600); s = await st();
  log(s.length >= 3 && s[s.length - 1].state === 1, 'full screen opens a large player that plays');
  log(s.find((x) => x.id === 'aaaaaaaaaaa').state === 2 || s.filter((x) => x.id === 'aaaaaaaaaaa').every((x) => x.state !== 1 || x === s[s.length - 1]), 'the video underneath pauses');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // 8. a single post page autoplays too
  await p.goto(B + `/post/${first}`, { waitUntil: 'load' }); await p.getByTestId('video-frame').waitFor(); await p.waitForTimeout(1000); s = await st();
  log(s.length === 1 && s[0].state === 1 && s[0].muted === false || (s.length === 1 && s[0].state === 1), 'the post page plays its video by itself');

  // 9. people who ask for less motion, and low-data mode, are not autoplayed
  const calm = await br.newContext({ ...device('iPhone 13'), reducedMotion: 'reduce' });
  await calm.addCookies(await cookiesFor('/api/auth/trainee-login', 't0@dev.test')); await calm.addCookies([{ name: 'aaicbi_cookie_consent', value: 'declined', url: B }]);
  const cp = await calm.newPage(); await route(cp);
  await cp.goto(B + '/feed', { waitUntil: 'load' }); await cp.getByTestId('video-frame').first().waitFor(); await cp.getByTestId('video-frame').first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await cp.waitForTimeout(1200);
  log((await cp.evaluate(() => (window.__players || []).length)) === 0, 'with reduced motion switched on, nothing plays by itself');
  await cp.getByTestId('video-frame').first().getByRole('button', { name: /Play video/ }).click(); await cp.waitForTimeout(800);
  const cs = await cp.evaluate(() => (window.__players || []).map((x) => x.state));
  log(cs.length === 1 && cs[0] === 1, 'but tapping play still works');

  await br.close();
  psql(`delete from "Post" where id in (${[first, ...ids].map((i) => `'${i}'`).join(',')})`);
})().catch((e) => { console.error(e); process.exit(1); });
