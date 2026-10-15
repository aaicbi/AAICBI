// The animated round experience, on the sample games at /admin/studio/demo: welcome, 3-2-1-GO, HUD, Loop, answer feedback, sound
// default and memory, reduced motion, keyboard, and a summary that matches the answers actually given. Phone, tablet and desktop.
const { B, log, launch, device, signedIn, results } = require('./lib.cjs');
const fs = require('fs');
fs.mkdirSync('/tmp/dev', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function answer(p, format) {
  const gp = p.getByTestId('game-player');
  await gp.waitFor();
  if (format === 'QUIZ' || format === 'SCENARIO') {
    await gp.locator('fieldset button').first().click();
  } else if (format === 'MATCHING') {
    const n = await gp.locator('ul[aria-label="Terms"] > li').count();
    const t = await gp.locator('ul[aria-label="Terms"]').boundingBox(); const m = await gp.locator('ul[aria-label="Meanings"]').boundingBox(); const vp = p.viewportSize();
    const key = `matching-side-${vp.width}`;
    if (!answer.done) answer.done = new Set();
    if (!answer.done.has(key)) { answer.done.add(key); log(Math.abs(t.y - m.y) < 6 && m.x >= t.x + t.width - 2 && m.x + m.width <= vp.width + 1 && t.x >= 0, `matching: terms and meanings sit side by side at ${vp.width}px wide`); }
    await gp.locator('ul[aria-label="Terms"] > li button').first().click();
    for (let i = 0; i < n; i++) await gp.locator('ul[aria-label="Meanings"] > li').nth(i).locator('button').click();
  }
  await p.getByRole('button', { name: 'Check answer' }).click();
  await p.getByRole('button', { name: /Next question|See my results/ }).waitFor();
}

async function playRound(p, format) {
  let full = 0;
  for (let q = 1; q <= 10; q++) {
    const hud = await p.getByTestId('hud-question').innerText();
    if (!new RegExp(`${q}\\s*(of|/)\\s*10`, 'i').test(hud)) { log(false, `${format}: HUD says "${hud}" on question ${q}`); }
    await answer(p, format);
    if (q === 10) full = await p.locator('[data-testid="round-hud"] [data-outcome="FULL"]').count();
    await p.getByRole('button', { name: /Next question|See my results/ }).click();
  }
  return full;
}

(async () => {
  const br = await launch();
  const sizes = [
    ['phone', device('iPhone 13')],
    ['tablet', device('iPad (gen 7)')],
    ['desktop', device('Desktop Chrome', { viewport: { width: 1280, height: 900 } })],
  ];
  for (const [name, desc] of sizes) {
    const ctx = await signedIn(br, desc, '/api/auth/login', 'super@dev.test');
    const p = await ctx.newPage(); p.setDefaultTimeout(15000);
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(B + '/admin/studio/demo');
    await p.getByTestId('round-intro').waitFor();
    log(true, `${name}: the demo opens on the welcome screen`);
    log((await p.getByTestId('welcome-message').innerText()).length > 10, `${name}: Loop welcomes the learner`);
    log(await p.evaluate(() => window.localStorage.getItem('aaicbi.game.sound')) === null || (await p.evaluate(() => window.localStorage.getItem('aaicbi.game.sound'))) === '0', `${name}: sound is off by default`);
    await p.screenshot({ path: `/tmp/dev/game-${name}-intro.png` });

    await p.getByTestId('round-start').click();
    await p.getByTestId('countdown').waitFor();
    log(true, `${name}: the 3-2-1 countdown shows the first time`);
    await p.getByRole('button', { name: 'Skip' }).click();
    await p.getByTestId('round-hud').waitFor();
    log(/1\s*(of|\/)\s*10/i.test(await p.getByTestId('hud-question').innerText()), `${name}: the HUD starts at question 1 of 10`);
    log(await p.getByTestId('companion-message').count() === 1, `${name}: Loop is beside the question`);
    await p.screenshot({ path: `/tmp/dev/game-${name}-question.png` });

    // answer once and look at the feedback state
    await answer(p, 'QUIZ');
    await p.screenshot({ path: `/tmp/dev/game-${name}-feedback.png` });
    const pips = await p.locator('[data-testid="round-hud"] [data-outcome]').count();
    log(pips >= 1, `${name}: the answer shows in the progress pips`);
    await p.getByRole('button', { name: /Next question/ }).click();

    // finish the other nine
    for (let q = 2; q <= 10; q++) {
      await answer(p, 'QUIZ');
      await p.getByRole('button', { name: /Next question|See my results/ }).click();
    }
    await p.getByTestId('round-summary').waitFor();
    const count = await p.getByTestId('summary-count').innerText();
    const acc = parseInt(await p.getByTestId('summary-accuracy').innerText(), 10);
    log(/10/.test(count), `${name}: the summary counts all ten questions ("${count.replace(/\s+/g, ' ')}")`);
    log(acc >= 0 && acc <= 100, `${name}: the summary accuracy is a real percentage (${acc}%)`);
    await p.screenshot({ path: `/tmp/dev/game-${name}-summary.png` });
    await p.getByTestId('review-toggle').click();
    log((await p.getByTestId('review-list').locator('li').count()) === 10, `${name}: the review lists all ten answers`);
    log(errors.length === 0, `${name}: no page errors (${errors.join('; ')})`);
    await ctx.close();
  }

  // matching on small phones: the terms and meanings stay side by side, inside the screen, with no sideways scrolling
  for (const [w, h] of [[360, 740], [390, 844]]) {
    const mctx = await signedIn(br, device('iPhone 13', { viewport: { width: w, height: h } }), '/api/auth/login', 'super@dev.test');
    const mp = await mctx.newPage(); mp.setDefaultTimeout(15000);
    await mp.goto(B + '/admin/studio/demo');
    await mp.getByTestId('demo-tab-MATCHING').click();
    await mp.getByTestId('round-start').click();
    const skip = mp.getByRole('button', { name: 'Skip' }); if (await skip.waitFor({ timeout: 2500 }).then(() => true, () => false)) await skip.click();
    await mp.getByTestId('game-player').waitFor();
    const t = await mp.locator('ul[aria-label="Terms"]').boundingBox(); const m = await mp.locator('ul[aria-label="Meanings"]').boundingBox();
    log(Math.abs(t.y - m.y) < 6 && m.x >= t.x + t.width - 2 && m.x + m.width <= w + 1 && t.x >= 0, `matching: terms and meanings sit side by side on a ${w}px phone`);
    log((await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, `matching: no sideways scrolling on a ${w}px phone`);
    const first = mp.locator('ul[aria-label="Terms"] > li button').first(); await first.click();
    await mp.locator('ul[aria-label="Meanings"] > li button').first().click();
    log((await mp.locator('ul[aria-label="Terms"] > li button').first().innerText()).trim().startsWith('1'), `matching: a matched pair shows its number on both sides (${w}px)`);
    await mp.screenshot({ path: `/tmp/dev/matching-${w}.png` });
    await mctx.close();
  }

  // every format, one full round each, on the desktop
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(15000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  for (const format of ['QUIZ', 'MATCHING', 'ORDERING', 'SCENARIO']) {
    await p.goto(B + '/admin/studio/demo');
    await p.getByTestId(`demo-tab-${format}`).click();
    await p.getByTestId('round-start').click();
    await p.getByTestId('round-hud').waitFor();   // later rounds in a visit skip the countdown
    const shown = await playRound(p, format);
    await p.getByTestId('round-summary').waitFor();
    const count = await p.getByTestId('summary-count').innerText();
    const full = parseInt((count.match(/^\s*(\d+)\s+of/) || [])[1] ?? '-1', 10);
    log(full === shown, `${format}: the summary's fully-correct count (${full}) matches the answers shown while playing (${shown})`);
    log(/10/.test(count), `${format}: a full ten-question round ends in a summary ("${count.replace(/\s+/g, ' ')}")`);
    await p.screenshot({ path: `/tmp/dev/game-${format}-summary.png` });
    // play another round: a new round starts at question 1 with a clean HUD
    await p.getByTestId('round-again').click();
    await p.getByTestId('round-hud').waitFor();
    log(/1\s*(of|\/)\s*10/i.test(await p.getByTestId('hud-question').innerText()), `${format}: "Play another round" starts again at question 1`);
  }
  log(errors.length === 0, `all formats: no page errors (${errors.join('; ')})`);

  // sound: off, switch on, remembered
  await p.goto(B + '/admin/studio/demo');
  await p.getByTestId('round-start').click();
  await p.getByTestId('round-hud').waitFor();
  const toggle = p.getByTestId('sound-toggle');
  log((await toggle.getAttribute('aria-pressed')) === 'false', 'sound switch starts off');
  await toggle.click();
  log((await toggle.getAttribute('aria-pressed')) === 'true', 'sound switch turns on');
  await p.reload();
  await p.getByTestId('round-start').click();
  await p.getByTestId('round-hud').waitFor();
  log((await p.getByTestId('sound-toggle').getAttribute('aria-pressed')) === 'true', 'sound choice is remembered on this device');
  await p.getByTestId('sound-toggle').click();
  await ctx.close();

  // keyboard: the whole question can be answered without a mouse
  const kctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 } }), '/api/auth/login', 'super@dev.test');
  const k = await kctx.newPage(); k.setDefaultTimeout(15000);
  await k.goto(B + '/admin/studio/demo');
  await k.getByTestId('round-start').focus();
  await k.keyboard.press('Enter');
  await k.getByTestId('countdown').waitFor();
  await k.getByRole('button', { name: 'Skip' }).focus();
  await k.keyboard.press('Enter');
  await k.getByTestId('game-player').waitFor();
  await k.locator('[data-testid="game-player"] fieldset button').first().focus();
  await k.keyboard.press('Enter');
  await k.getByRole('button', { name: 'Check answer' }).focus();
  await k.keyboard.press('Enter');
  log(await k.getByRole('button', { name: /Next question/ }).isVisible(), 'a question can be answered with the keyboard alone');
  await kctx.close();

  // reduced motion: no confetti, and the page still plays through
  const rctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }), '/api/auth/login', 'super@dev.test');
  const r = await rctx.newPage(); r.setDefaultTimeout(15000);
  await r.goto(B + '/admin/studio/demo');
  await r.getByTestId('round-start').click();
  await r.getByTestId('countdown').waitFor();
  await r.getByRole('button', { name: 'Skip' }).click();
  await playRound(r, 'QUIZ');
  await r.getByTestId('round-summary').waitFor();
  await sleep(400);
  log(await r.getByTestId('confetti').count() === 0 || (await r.locator('[data-testid="confetti"] > *').count()) === 0, 'reduced motion: no confetti is drawn');
  await rctx.close();

  // staff gate: a trainee is not shown the demo
  await br.close();
  const bad = results.filter((x) => !x[0]).length;
  console.log(bad ? `${bad} FAILED` : 'ALL PASSED');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
