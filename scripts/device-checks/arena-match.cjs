const { B, log, clearThrottle, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (login, email) => (await cookiesFor(login, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const pastDeadline = (id) => psql(`update "ArenaMatch" set "phaseEndsAt"=now()-interval '1 second' where id='${id}'`);
(async () => {
  clearThrottle();
  psql(`delete from "ArenaMatch" where "courseId"='arena_play'`);
  psql(`delete from "ArenaConfig"`);
  const sa = await jar('/api/auth/login', 'super@dev.test');
  const a = await jar('/api/auth/trainee-login', 't0@dev.test');
  const b = await jar('/api/auth/trainee-login', 't1@dev.test');
  const outsider = await jar('/api/auth/trainee-login', 't10@dev.test');
  const ids = { a: psql(`select id from "Trainee" where email='t0@dev.test'`), b: psql(`select id from "Trainee" where email='t1@dev.test'`), o: psql(`select id from "Trainee" where email='t10@dev.test'`) };
  const superId = psql(`select id from "User" where email='super@dev.test'`);

  // seed a course with enough approved practice questions
  psql(`delete from "Course" where id='arena_play'`);
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt") values ('arena_play','Arena Play Course','x','${superId}',now())`);
  psql(`insert into "Module"(id,"courseId",title,"order") values ('arena_play_m','arena_play','Topic One',0)`);
  psql(`insert into "Exam"(id,code,title,"moduleId","courseId","durationMinutes","passMarkPercent","createdById","updatedAt") values ('arena_play_e','ARENA-PLAY','Arena exam','arena_play_m','arena_play',30,50,'${superId}',now()) on conflict do nothing`);
  for (let i = 0; i < 10; i++) {
    psql(`insert into "ModuleLearningObjective"(id,"moduleId",text,"order","confirmedById","isCritical") values ('obj${i}','arena_play_m','Objective ${i}',${i},'${superId}',false)`);
    psql(`insert into "Question"(id,"examId",text,type,topic,difficulty,"order","bankObjectiveId","bankStatus","bankPool") values ('arena_q${i}','arena_play_e','Arena question ${i}?','SINGLE_CHOICE','Topic One','BEGINNER',${i},'obj${i}','APPROVED','PRACTICE')`);
    const right = 'ABCD'[i % 4];
    for (const [k, key] of ['A','B','C','D'].entries()) psql(`insert into "Option"(id,"questionId",text,key,"isCorrect","order") values ('arena_o${i}${key}','arena_q${i}','Option ${key} of ${i}','${key}',${key === right},${k})`);
  }
  for (const t of [ids.a, ids.b]) psql(`insert into "CourseEnrollment"(id,"traineeId","courseId",source,"unlockedAt") values ('arena_en_${t}','${t}','arena_play','FREE',now()) on conflict do nothing`);
  psql(`delete from "CourseEnrollment" where "traineeId"='${ids.o}' and "courseId"='arena_play'`);
  const correctFor = (text) => psql(`select o.key from "Option" o join "Question" q on q.id=o."questionId" where q.text='${text.replace(/'/g, "''")}' and o."isCorrect"`);
  const wrongFor = (text) => { const c = correctFor(text); return c === 'A' ? 'B' : 'A'; };

  // switches
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: false, gameEnabled: false } });
  let r = await call(a, 'GET', '/api/arena/courses/arena_play');
  log(r.s === 403, 'with the arena off nobody can open it (' + r.s + ')');
  await call(sa, 'PUT', '/api/admin/arena', { scopeType: 'PLATFORM', scopeId: '', patch: { enabled: true, gameEnabled: true, questionsPerMatch: 4, tickingSound: true } });
  r = await call(null, 'GET', '/api/arena/courses/arena_play');
  log(r.s === 401, 'signed out: refused');
  r = await call(outsider, 'GET', '/api/arena/courses/arena_play');
  log(r.s === 403, 'a trainee who is not enrolled is refused');
  r = await call(a, 'GET', '/api/arena/courses/arena_play');
  log(r.s === 200 && r.j.rules.questionsPerMatch === 4 && r.j.topics.length === 1, 'enrolled trainee opens the course arena; one topic has enough questions');
  await call(b, 'GET', '/api/arena/courses/arena_play');
  r = await call(a, 'GET', '/api/arena/courses/arena_play');
  log(r.j.online.some((p) => p.id === ids.b), 'the coursemate shows as online');

  // challenge
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.a });
  log(r.s === 400, 'cannot challenge yourself');
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.o });
  log(r.s === 404, 'cannot challenge someone outside the course');
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b, moduleId: 'arena_play_m' });
  log(r.s === 200 && r.j.id, 'a challenge is sent');
  const mid = r.j.id;
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b });
  log(r.s === 409, 'only one match at a time (' + r.s + ')');
  r = await call(b, 'GET', '/api/arena/courses/arena_play');
  log(r.j.incoming.length === 1 && r.j.incoming[0].id === mid, 'the coursemate sees the invitation');
  r = await call(outsider, 'GET', '/api/arena/matches/' + mid);
  log(r.s === 404 || r.s === 401, 'a stranger cannot read the match (' + r.s + ')');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/accept`);
  log(r.s === 403, 'the challenger cannot accept their own challenge');
  r = await call(b, 'POST', `/api/arena/matches/${mid}/accept`);
  log(r.s === 200 && r.j.status === 'LOBBY', 'accepting opens the lobby');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/message`, { body: 'Good luck <b>friend</b>' });
  log(r.s === 200 && r.j.messages.length === 1, 'players can chat in the lobby');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
  log(r.j.status === 'LOBBY' && r.j.ready.me === true && r.j.ready.opponent === false, 'one ready player is not enough');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/pick`, { number: 1 });
  log(r.s >= 400, 'cannot pick before the game starts');
  r = await call(b, 'POST', `/api/arena/matches/${mid}/ready`, { ready: true });
  log(r.j.status === 'ACTIVE' && r.j.phase === 'PICK', 'both ready: the match starts at the pick screen');
  const first = r.j.turn === 'me' ? { me: b, other: a, name: 'b' } : { me: a, other: b, name: 'a' };

  // pick
  let v = (await call(first.me, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.turn === 'me' && v.rules.questionSeconds === 60 && v.rules.pickSeconds >= 120, 'a minute per question, and a long safety limit (not a visible timer) for picking');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/pick`, { number: 3 });
  log(r.s === 403, 'the other player cannot pick');
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/pick`, { number: 99 });
  log(r.s === 400, 'a number off the board is refused');
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/react`, { kind: 'wow' });
  log(r.s === 200, 'reactions are open while picking (between questions)');
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/pick`, { number: 3 });
  log(r.s === 200 && r.j.phase === 'ANSWER' && r.j.round.served && r.j.round.iCanAnswer, 'picking opens the question for the picker');
  let q = r.j.round.served;
  log(r.j.reactionsOpen === false, 'the view says reactions are locked during a question');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/react`, { kind: 'fire' });
  log(r.s === 409, 'reactions are refused while a question is being answered');
  log(!JSON.stringify(r.j).includes('isCorrect') && !('correctKey' in (r.j.reveal || {})), 'the answer key is not in the view');
  v = (await call(first.other, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.round.iCanAnswer === false && v.round.answerer === 'opponent', 'the other player waits');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/answer`, { response: { choice: 'A' } });
  log(r.s === 403, 'the other player cannot answer the first question');

  // pause hides the question and allows chat
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/pause`);
  log(r.s === 200 && r.j.paused && r.j.round.served === null, 'pausing hides the question');
  r = await call(first.me, 'GET', '/api/arena/matches/' + mid);
  log(r.j.round.served === null && r.j.paused.by === 'opponent', 'the picker cannot see it either while paused');
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/answer`, { response: { choice: 'A' } });
  log(r.s >= 400, 'no answering while paused');
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/message`, { body: 'brb' });
  log(r.s === 200, 'chat works while paused');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/resume`);
  log(r.s === 200 && !r.j.paused && r.j.round.served, 'resume brings the question back with time left');

  // wrong first answer -> steal
  const wrong = wrongFor(q.question);
  r = await call(first.me, 'POST', `/api/arena/matches/${mid}/answer`, { response: { choice: wrong } });
  log(r.s === 200 && r.j.phase === 'STEAL' && r.j.round.answerer === 'opponent', 'a wrong answer passes the question on');
  v = (await call(first.other, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.phase === 'STEAL' && v.round.iCanAnswer && v.round.points + 0 > 0 && v.round.bonusPoints === Math.round(v.round.points * 1.5), 'the other player gets the bonus chance (+50%)');
  log(!JSON.stringify(v).includes(`"choice":"${wrong}"`), "the first player's wrong pick is never shown");
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/answer`, { response: { choice: correctFor(q.question) } });
  log(r.s === 200 && r.j.phase === 'REVEAL' && r.j.reveal.outcome === 'STOLEN' && r.j.reveal.points === r.j.round.bonusPoints, 'the bonus answer scores the bonus points');
  log(r.j.me.score === r.j.reveal.points && r.j.reveal.answer.correctKey, 'score and the revealed answer are in the view');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/react`, { kind: 'fire' });
  log(r.s === 200 && r.j.reactions.some((x) => x.kind === 'fire'), 'reactions open at the reveal');
  r = await call(first.other, 'POST', `/api/arena/matches/${mid}/react`, { kind: 'not-real' });
  log(r.s === 400, 'only listed reactions are accepted');

  // next round starts after the reveal; the turn switches
  pastDeadline(mid);
  v = (await call(first.me, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.phase === 'PICK' && v.turn === 'opponent' && v.board.used.length === 1, 'after the reveal the other player picks (turn switches)');

  // timeout when picking: the system picks
  pastDeadline(mid);
  v = (await call(first.me, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.phase === 'ANSWER' && v.board.used.length === 2, 'if nobody picks in time the system picks a number');
  // timeout on the first answer: steal; timeout on steal: nobody scores
  pastDeadline(mid);
  v = (await call(first.me, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.phase === 'STEAL', 'running out of time passes the question on');
  pastDeadline(mid);
  v = (await call(first.me, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.phase === 'REVEAL' && v.reveal.outcome === 'NONE' && v.reveal.awardedTo === null, 'a question nobody answers scores nothing');

  // play the rest, answering right as the picker, until the match ends
  let guard = 0;
  v = (await call(a, 'GET', '/api/arena/matches/' + mid)).j;
  while (v.status === 'ACTIVE' && guard++ < 30) {
    const mine = v.turn === 'me' ? a : b;
    if (v.phase === 'REVEAL') pastDeadline(mid);
    else if (v.phase === 'PICK') {
      const n = Array.from({ length: v.board.size }, (_, i) => i + 1).find((x) => !v.board.used.includes(x));
      await call(mine, 'POST', `/api/arena/matches/${mid}/pick`, { number: n });
    } else if (v.phase === 'ANSWER' || v.phase === 'STEAL') {
      const av = (await call(a, 'GET', '/api/arena/matches/' + mid)).j; const bv = (await call(b, 'GET', '/api/arena/matches/' + mid)).j;
      const who = av.round.iCanAnswer ? a : b; const sv = av.round.iCanAnswer ? av : bv;
      await call(who, 'POST', `/api/arena/matches/${mid}/answer`, { response: { choice: correctFor(sv.round.served.question) } });
    }
    v = (await call(a, 'GET', '/api/arena/matches/' + mid)).j;
  }
  log(v.status === 'COMPLETED', 'the match completes after all questions (' + v.status + ')');
  const bv = (await call(b, 'GET', '/api/arena/matches/' + mid)).j;
  log(v.result && bv.result && v.result.myScore === bv.result.opponentScore && v.result.opponentScore === bv.result.myScore, 'both players see the same final score from their side');
  log(v.result.winner === 'draw' ? bv.result.winner === 'draw' : v.result.winner !== bv.result.winner, 'one winner (or a draw) agreed by both');
  log(v.result.topics.length >= 1, 'the result has a per-topic breakdown');
  log(v.result.recap.length >= 3 && v.result.recap.every((x) => x.answer && x.prompt) && [1, 2, 3].includes(v.result.stars), 'the result has a recap with the answer to every question, and a star rating');
  log(v.result.record.wins + v.result.record.losses + v.result.record.draws >= 1, 'the result shows the head-to-head record');

  // play again: new questions, one lobby
  const usedBefore = psql(`select string_agg("itemId", ',') from "ArenaRound" where "matchId"='${mid}'`).split(',');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/rematch`);
  log(r.s === 200 && r.j.rematch && r.j.rematch.status === 'PENDING' && r.j.rematch.from === 'me', 'play again sends a rematch request');
  const rid = r.j.rematch.id;
  r = await call(b, 'GET', '/api/arena/matches/' + mid);
  log(r.j.rematch && r.j.rematch.from === 'opponent' && r.j.rematch.id === rid, 'the other player sees the request on their result screen');
  r = await call(a, 'POST', `/api/arena/matches/${mid}/rematch`);
  log(r.j.rematch.id === rid, 'asking twice does not make a second match');
  r = await call(b, 'POST', `/api/arena/matches/${mid}/rematch`);
  log(r.s === 200 && r.j.rematch.id === rid && r.j.rematch.status === 'LOBBY', 'both pressing play again lands in one lobby');
  r = await call(a, 'POST', `/api/arena/matches/${rid}/ready`, { ready: true }); r = await call(b, 'POST', `/api/arena/matches/${rid}/ready`, { ready: true });
  log(r.j.status === 'ACTIVE' && r.j.totalRounds === 4, 'the rematch starts');
  for (let n = 1; n <= 3; n++) {
    let rv = (await call(a, 'GET', '/api/arena/matches/' + rid)).j;
    const pk = rv.turn === 'me' ? a : b;
    await call(pk, 'POST', `/api/arena/matches/${rid}/pick`, { number: n });
    for (let k = 0; k < 3; k++) { pastDeadline(rid); await call(a, 'GET', '/api/arena/matches/' + rid); } // question, bonus and reveal time out
  }
  const usedAfter = psql(`select string_agg("itemId", ',') from "ArenaRound" where "matchId"='${rid}'`).split(',');
  log(usedAfter.length >= 3 && usedAfter.every((x) => !usedBefore.includes(x)), 'the rematch asks new questions (none repeated while the course has fresh ones)');
  await call(a, 'POST', `/api/arena/matches/${rid}/leave`);

  r = await call(a, 'POST', `/api/arena/matches/${mid}/pick`, { number: 1 });
  log(r.s >= 400, 'nothing can be played after the match ends');

  // decline, forfeit, expiry
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b }); const m2 = r.j.id;
  r = await call(b, 'POST', `/api/arena/matches/${m2}/decline`);
  log(r.j.status === 'DECLINED', 'a challenge can be declined');
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b }); const m3 = r.j.id;
  psql(`update "ArenaMatch" set "expiresAt"=now()-interval '1 minute' where id='${m3}'`);
  r = await call(a, 'GET', '/api/arena/matches/' + m3);
  log(r.j.status === 'EXPIRED', 'an unanswered challenge expires');
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b });
  log(r.s === 429, 'sending too many challenges is slowed down');
  clearThrottle();
  r = await call(a, 'POST', '/api/arena/courses/arena_play/challenge', { opponentId: ids.b }); const m4 = r.j.id;
  await call(b, 'POST', `/api/arena/matches/${m4}/accept`);
  await call(a, 'POST', `/api/arena/matches/${m4}/ready`, { ready: true }); await call(b, 'POST', `/api/arena/matches/${m4}/ready`, { ready: true });
  r = await call(a, 'POST', `/api/arena/matches/${m4}/leave`);
  log(r.j.status === 'FORFEITED' && r.j.result.winner === 'opponent', 'leaving an active match forfeits it to the other player');

  const bad = results();
  function results() { return require('./lib.cjs').results.filter((x) => !x[0]); }
  console.log(bad.length ? `\n${bad.length} FAILED` : '\nALL PASSED');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
