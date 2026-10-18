const { B, log, launch, device, signedIn, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  clearThrottle();
  psql(`update "ArenaConfig" set "chatEnabled"=true where "scopeType"='PLATFORM'`);
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
  psql(`delete from "ArenaChatMessage" where "courseId"='arena_play'`);
  psql(`delete from "ArenaSuspension" where "courseId"='arena_play'`);
  const br = await launch();
  const dev = device('iPhone 7', { viewport: { width: 375, height: 553 } });
  const ca = await signedIn(br, dev, '/api/auth/trainee-login', 't0@dev.test'); const cb = await signedIn(br, dev, '/api/auth/trainee-login', 't1@dev.test');
  const pa = await ca.newPage(); const pb = await cb.newPage(); pa.setDefaultTimeout(8000); pb.setDefaultTimeout(8000);
  await pa.goto(`${B}/trainee/arena/arena_play`, { waitUntil: 'load' });
  await pb.goto(`${B}/trainee/arena/arena_play`, { waitUntil: 'load' });
  await pa.getByText('Course chat').first().waitFor();
  await pa.locator('.ar-chatin').fill('Hello team, ready for a game?');
  await pa.getByRole('button', { name: 'Send' }).click();
  await pa.locator('.ar-mine', { hasText: 'ready for a game' }).waitFor();
  log(true, 'a trainee posts a message and sees it as their own');
  await pb.locator('.ar-msg', { hasText: 'ready for a game' }).waitFor({ timeout: 6000 });
  log(true, 'a coursemate sees it without refreshing');
  // staff removes it
  const id = psql(`select id from "ArenaChatMessage" where "courseId"='arena_play' limit 1`);
  psql(`update "ArenaChatMessage" set "deletedAt"=now() where id='${id}'`);
  await pb.locator('.ar-msg', { hasText: 'ready for a game' }).waitFor({ state: 'detached', timeout: 6000 });
  log(true, 'a removed message disappears for everyone');
  // suspension blocks chat and challenges
  const tid = psql(`select id from "Trainee" where email='t0@dev.test'`);
  psql(`insert into "ArenaSuspension"(id,"courseId","traineeId",reason,"suspendedById","createdAt") values ('sus_dev','arena_play','${tid}','Be kind',(select id from "User" limit 1),now())`);
  await pa.reload({ waitUntil: 'load' });
  await pa.getByText(/You're suspended/).first().waitFor();
  const r = await pa.evaluate(async (c) => (await fetch(`/api/arena/courses/${c}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'hi' }) })).status, 'arena_play');
  log(r === 403, 'a suspended trainee cannot post (' + r + ')');
  await pa.screenshot({ path: '/tmp/dev/arena-chat-phone.png' });
  psql(`delete from "ArenaSuspension" where id='sus_dev'`);
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
