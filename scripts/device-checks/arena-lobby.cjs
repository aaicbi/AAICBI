const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  clearThrottle();
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
  psql(`delete from "ArenaPresence" where "courseId"='arena_play'`);
  const br = await launch();
  const dev = device('iPhone 7', { viewport: { width: 375, height: 553 } });
  const cb = await signedIn(br, dev, '/api/auth/trainee-login', 't1@dev.test'); const ca = await signedIn(br, dev, '/api/auth/trainee-login', 't0@dev.test');
  const pb = await cb.newPage(); const pa = await ca.newPage(); pa.setDefaultTimeout(8000); pb.setDefaultTimeout(8000);
  await pb.goto(`${B}/trainee/arena/arena_play`, { waitUntil: 'load' });
  await pb.getByText('Online now').waitFor();
  await pb.waitForTimeout(1500);
  // A arrives: the list shows B straight away, and B's list shows A without waiting for a refresh
  const t0 = Date.now();
  await pa.goto(`${B}/trainee/arena/arena_play`, { waitUntil: 'load' });
  await pa.locator('.ar-row', { hasText: 'Available' }).first().waitFor();
  log(true, 'a player arriving sees who is already there (' + (Date.now() - t0) + ' ms)');
  const t1 = Date.now();
  await pb.locator('.ar-row', { hasText: 'Available' }).first().waitFor({ timeout: 4000 });
  log(Date.now() - t1 < 4000, 'the player already there sees the newcomer within seconds (' + (Date.now() - t1) + ' ms)');
  const topics = await pa.locator('select[aria-label="Topic"] option').allInnerTexts();
  log(topics.some((t) => /Topic One/.test(t)), 'the topic list offers topics with enough questions for a short match: ' + topics.join(' | '));
  // leaving takes a player off the other list at once
  await pa.close();
  await pb.locator('.ar-row', { hasText: 'Available' }).first().waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
  const gone = await pb.locator('.ar-row', { hasText: 'Available' }).count();
  log(gone === 0, 'closing the page removes the player from the others\' list');
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
