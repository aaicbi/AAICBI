// While a game is on, anywhere else in the app a small round button leads back to it. It can be dragged out of the way, stays where it was put, and tapping it (not dragging) returns to the game.
const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  clearThrottle();
  psql(`update "Course" set published=true, status='PUBLISHED' where id='arena_play'`);
  psql(`update "ArenaConfig" set enabled=true,"gameEnabled"=true where "scopeType"='PLATFORM'`);
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
  const br = await launch();
  const dev = device('iPhone 13');
  const ca = await signedIn(br, dev, '/api/auth/trainee-login', 't0@dev.test'); const cb = await signedIn(br, dev, '/api/auth/trainee-login', 't1@dev.test');
  const pa = await ca.newPage(); const pb = await cb.newPage(); pa.setDefaultTimeout(30000);
  await pa.goto(`${B}/trainee/arena/arena_play`, { waitUntil: 'load' });
  await pb.goto(`${B}/trainee/dashboard`, { waitUntil: 'load' });
  const bId = psql(`select id from "Trainee" where email='t1@dev.test'`);
  await pa.evaluate((id) => fetch('/api/arena/courses/arena_play/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opponentId: id, moduleId: null }) }), bId);
  const mid = psql(`select id from "ArenaMatch" where status='PENDING' order by "createdAt" desc limit 1`);
  const acc = await pb.evaluate((id) => fetch(`/api/arena/matches/${id}/accept`, { method: 'POST' }).then((r) => r.status), mid);
  log(acc === 200, 'the game is on (' + acc + ')');
  await pa.goto(`${B}/trainee/dashboard`, { waitUntil: 'load' });
  const btn = pa.getByTestId('game-return');
  await btn.waitFor();
  const look = await btn.evaluate((a) => { const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderTopLeftRadius, text: a.innerText.trim(), label: a.getAttribute('aria-label'), onScreen: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 0 }; });
  log(look.w === 52 && look.h === 52 && parseFloat(look.radius) >= 26, 'it is a small round button (' + look.w + 'x' + look.h + ')');
  log(/Your game with .* is on/.test(look.label) && /drag/i.test(look.label), 'it is still named for screen readers: ' + look.label);
  log(!/Return/.test(look.text), 'the long "Return" bar is gone');
  await pa.screenshot({ path: '/tmp/dev/game-return-default.png' });
  // drag it up and to the right
  const box = await btn.boundingBox();
  await pa.mouse.move(box.x + 26, box.y + 26); await pa.mouse.down(); await pa.mouse.move(box.x + 120, box.y - 140, { steps: 8 }); await pa.mouse.up();
  const moved = await btn.boundingBox();
  log(moved.x > box.x + 60 && moved.y < box.y - 90, 'it can be dragged out of the way (' + Math.round(box.x) + ',' + Math.round(box.y) + ' to ' + Math.round(moved.x) + ',' + Math.round(moved.y) + ')');
  await pa.waitForTimeout(400);
  log(pa.url().includes('/trainee/dashboard'), 'dragging does not open the game');
  await pa.reload({ waitUntil: 'load' }); await btn.waitFor();
  const again = await btn.boundingBox();
  log(Math.abs(again.x - moved.x) < 3 && Math.abs(again.y - moved.y) < 3, 'it stays where it was put after a reload');
  await pa.screenshot({ path: '/tmp/dev/game-return-moved.png' });
  // a plain tap returns to the game
  await btn.click();
  await pa.waitForURL(/\/trainee\/arena\/match\//);
  log(true, 'tapping it returns to the game');
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
