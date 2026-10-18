const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  clearThrottle();
  psql(`update "Course" set published=true, status='PUBLISHED' where id='arena_play'`);
  psql(`update "ArenaConfig" set enabled=true,"gameEnabled"=true,"ladderEnabled"=true,spectators='ENROLLED' where "scopeType"='PLATFORM'`);
  psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
  for (const t of ['ArenaReport','ArenaRatingChange','ArenaRating','ArenaSuspension']) psql(`delete from "${t}" where "courseId"='arena_play'`);
  psql(`delete from "UserNotification" where type in ('ARENA_REPORT','ARENA_MODERATION')`);
  psql(`delete from "ArenaMessage" where id='mm1'`);
  const id = (e) => psql(`select id from "Trainee" where email='${e}'`);
  const ids = { a: id('t0@dev.test'), b: id('t1@dev.test') };
  for (const x of Object.values(ids)) psql(`insert into "ArenaRating"("traineeId","courseId",rating,matches,wins,losses,draws,hidden,"updatedAt") values ('${x}','arena_play',1000,5,3,2,0,false,now())`);
  psql(`insert into "CourseEnrollment"(id,"traineeId","courseId",source,"enrolledAt","unlockedAt") select 'ce_t2', id, 'arena_play', 'ADMIN_GRANTED', now(), now() from "Trainee" where email='t2@dev.test' on conflict do nothing`);
  const A = await jar('/api/auth/trainee-login', 't0@dev.test'); const Bk = await jar('/api/auth/trainee-login', 't1@dev.test'); const C = await jar('/api/auth/trainee-login', 't2@dev.test'); const S = await jar('/api/auth/login', 'super@dev.test');
  const play = async (quit) => {
    psql(`update "ArenaMatch" set status='CANCELLED' where status in ('PENDING','LOBBY','ACTIVE')`);
    await call(Bk, 'GET', '/api/arena/courses/arena_play');
    let r = await call(A, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b }); const mid = r.j.id;
    await call(Bk, 'POST', `/api/arena/matches/${mid}/accept`);
    await call(A, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true }); r = await call(Bk, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
    const picker = r.j.turn === 'me' ? Bk : A; await call(picker, 'POST', `/api/arena/matches/${mid}/pick`, { number: 2 });
    if (quit) { await call(A, 'POST', `/api/arena/matches/${mid}/leave`); await new Promise((x) => setTimeout(x, 2000)); }
    return mid;
  };
  // a finished match moves the ladder; a player reports it
  const m1 = await play(true);
  const before = psql(`select string_agg(rating::text, ',' order by rating) from "ArenaRating" where "courseId"='arena_play'`);
  log(before === '984,1016', 'the finished match moved the ladder (' + before + ')');
  let rep = await call(A, 'POST', `/api/arena/matches/${m1}/report`, { reason: 'CHEATING', note: 'They had the answers' });
  log(rep.s === 200, 'a player can report the match (' + rep.s + ')');
  const again = await call(A, 'POST', `/api/arena/matches/${m1}/report`, { reason: 'CHEATING' });
  log(again.s === 409, 'the same match cannot be reported twice while open (' + again.s + ')');
  const noReason = await call(Bk, 'POST', `/api/arena/matches/${m1}/report`, { reason: 'OTHER' });
  log(noReason.s === 429 || noReason.s === 400, 'a report that says nothing is refused (' + noReason.s + ')');
  const outsider = await call(C, 'POST', `/api/arena/matches/${m1}/report`, { reason: 'ABUSE' });
  log(outsider.s === 403, 'someone who neither played nor watched cannot report it (' + outsider.s + ')');
  psql(`insert into "ArenaSpectator"("matchId","traineeId","lastSeenAt") select '${m1}', id, now() from "Trainee" where email='t2@dev.test' on conflict do nothing`);
  const watcher = await call(C, 'POST', `/api/arena/matches/${m1}/report`, { reason: 'ABUSE', reportedId: ids.a });
  log(watcher.s === 200, 'a spectator can report one of the players (' + watcher.s + ')');
  const staffNote = psql(`select count(*) from "UserNotification" where type='ARENA_REPORT'`);
  log(Number(staffNote) >= 1, 'the course moderator is notified (' + staffNote + ')');
  // moderator view
  let ov = await call(S, 'GET', '/api/admin/courses/arena_play/arena/moderation');
  log(ov.s === 200 && ov.j.reports.filter((r) => r.status === 'OPEN').length === 2 && ov.j.matches.some((m) => m.id === m1), 'the moderator sees the open reports and the match');
  // match chat: log and remove
  psql(`insert into "ArenaMessage"(id,"matchId","senderId",body) values ('mm1','${m1}','${ids.a}','a rude message')`);
  let lg = await call(S, 'GET', `/api/admin/courses/arena_play/arena/moderation/matches/${m1}`);
  log(lg.j.messages.some((x) => x.body === 'a rude message'), 'the moderator can read the match chat');
  await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'removeMessage', matchId: m1, messageId: 'mm1' });
  const pv = await call(A, 'GET', `/api/arena/matches/${m1}`);
  log(!pv.j.messages.some((x) => x.body === 'a rude message'), 'a removed message disappears for the players');
  // take the result off the ladder
  let v = await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'void', matchId: m1 });
  const after = psql(`select string_agg(rating::text || ':' || matches::text, ',' order by rating) from "ArenaRating" where "courseId"='arena_play'`);
  log(v.s === 200 && after === '1000:5,1000:5', 'taking the match off the ladder puts both ratings back (' + after + ')');
  await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'void', matchId: m1 });
  const after2 = psql(`select string_agg(rating::text, ',' order by rating) from "ArenaRating" where "courseId"='arena_play'`);
  log(after2 === '1000,1000', 'doing it twice does not move anything again');
  const wk = await call(A, 'GET', '/api/arena/courses/arena_play/ladder?period=week');
  log(wk.j.entries.every((e) => e.change === 0), 'the weekly board no longer counts it');
  // resolve with a suspension
  const openId = ov.j.reports.find((r) => r.status === 'OPEN' && r.reportedId === ids.b).id;
  v = await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'resolve', reportId: openId, suspendHours: 24, note: 'Warned' });
  const sus = psql(`select count(*) from "ArenaSuspension" where "courseId"='arena_play' and "traineeId"='${ids.b}' and "liftedAt" is null`);
  log(v.s === 200 && sus === '1', 'resolving a report can suspend the player (' + sus + ')');
  const dis = ov.j.reports.find((r) => r.status === 'OPEN' && r.id !== openId).id;
  v = await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'dismiss', reportId: dis });
  log(v.j.reports.every((r) => r.status !== 'OPEN'), 'dismissing closes the other report');
  const told = psql(`select count(*) from "UserNotification" where type='ARENA_MODERATION' and title like '%reviewed your report%'`);
  log(Number(told) === 2, 'both reporters are told it was reviewed (' + told + ')');
  const again2 = await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'dismiss', reportId: dis });
  log(again2.s === 409, 'a handled report cannot be handled again (' + again2.s + ')');
  psql(`delete from "ArenaSuspension" where "courseId"='arena_play'`);
  // end a live match
  const m2 = await play(false);
  const live = await call(S, 'GET', '/api/admin/courses/arena_play/arena/moderation');
  log(live.j.matches.find((m) => m.id === m2).status === 'ACTIVE', 'a live match shows as live to the moderator');
  v = await call(S, 'POST', '/api/admin/courses/arena_play/arena/moderation', { action: 'end', matchId: m2 });
  const st = psql(`select status || ':' || coalesce("endReason",'') from "ArenaMatch" where id='${m2}'`);
  const rows = psql(`select count(*) from "ArenaRatingChange" where "matchId"='${m2}'`);
  log(st === 'CANCELLED:staff-ended' && rows === '0', 'a moderator can end a live match, and it does not count (' + st + ', ' + rows + ' ladder rows)');
  // the report button on the result screen
  const br = await launch();
  const cb = await signedIn(br, device('iPhone 7', { viewport: { width: 375, height: 667 } }), '/api/auth/trainee-login', 't1@dev.test'); const pb = await cb.newPage(); pb.setDefaultTimeout(10000);
  const m3 = await play(true);
  await pb.goto(`${B}/trainee/arena/match/${m3}`, { waitUntil: 'load' });
  await pb.getByRole('button', { name: /Report this match/ }).click();
  await pb.getByLabel('Rude or abusive messages').check();
  await pb.getByRole('button', { name: 'Send report' }).click();
  await pb.getByTestId('report-done').waitFor();
  log(true, 'the result screen has a report button that works');
  await br.close();
  const bad = require('./lib.cjs').results.filter((x) => !x[0]);
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
