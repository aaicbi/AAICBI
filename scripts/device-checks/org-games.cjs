// The organization Games section: an organization sees and moderates only its own courses and trainees, only what the Super Admin allows,
// every decision carries a reason, other organizations' data answers "not found" and is recorded, escalations reach the Super Admin.
const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = async (email, path = '/api/auth/login') => (await cookiesFor(path, email)).map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
(async () => {
  clearThrottle();
  const ORG_ID = 'cmuznki2x0004p61x1xbxqwex', OWN = 'cmuznki56000np61xp469dmpa', OTHER = 'cmuznkiy30008nwm287j3g2hi';
  psql(`delete from "OrgGamingPolicy"`); psql(`delete from "GameModerationAction"`); psql(`delete from "AuditEvent"`); psql(`delete from "ArenaMatch" where id like 'ogchk%'`);
  const S = await jar('super@dev.test'), ORG = await jar('org@dev.test', '/api/auth/training-org-login');
  const mine = psql(`select "traineeId" from "CourseEnrollment" where "courseId"='${OWN}' order by "traineeId" limit 2`).split('\n');
  const theirs = psql(`select "traineeId" from "CourseEnrollment" where "courseId"='${OTHER}' order by "traineeId" limit 2`).split('\n');
  const mk = (id, course, a, b) => psql(`insert into "ArenaMatch" (id,"courseId","challengerId","opponentId",status,"expiresAt",rules) values ('${id}','${course}','${a}','${b}','ACTIVE',now()+interval '1 day','{}')`);
  try { mk('ogchkmine', OWN, mine[0], mine[1]); mk('ogchktheirs', OTHER, theirs[0], theirs[1]); } catch (e) { log(false, 'could not seed matches: ' + e.message); process.exit(1); }

  let r = await call(ORG, 'GET', '/api/org/games/overview');
  log(r.s === 200, 'an organization opens its Games overview');
  r = await call(ORG, 'GET', '/api/org/games/live');
  const ids = JSON.stringify(r.j);
  log(r.s === 200 && ids.includes('ogchkmine') && !ids.includes('ogchktheirs'), 'live games show its own match and never another organization\'s');
  r = await call(ORG, 'GET', '/api/org/games/results?courseId=' + OTHER);
  log(r.s === 404 || (r.s === 200 && !JSON.stringify(r.j).includes(theirs[0])), 'results of another organization\'s course are not available');

  // isolation
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'endSession', courseId: OTHER, matchId: 'ogchktheirs', reason: 'Trying someone else\'s game' });
  log(r.s === 404, 'ending another organization\'s game is "not found"');
  log(psql(`select status from "ArenaMatch" where id='ogchktheirs'`) === 'ACTIVE', 'and that game is untouched');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'warn', courseId: OWN, traineeId: theirs[0], reason: 'Wrong organization trainee' });
  log(r.s === 404, 'warning a trainee who is not in its course is "not found"');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'restrict', courseId: OTHER, traineeId: theirs[0], hours: 5, reason: 'Cross organization restrict' });
  log(r.s === 404, 'restricting a trainee in another organization\'s course is "not found"');
  log(Number(psql(`select count(*) from "AuditEvent" where action='CROSS_ORG_ATTEMPT' and outcome='DENIED'`)) >= 3, 'and every cross-organization attempt is recorded');

  // reasons
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'warn', courseId: OWN, traineeId: mine[0], reason: '' });
  log(r.s === 400, 'a decision without a reason is refused');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'warn', courseId: OWN, traineeId: mine[0], reason: 'Rude messages in the arena chat' });
  log(r.s === 200 && Number(psql(`select count(*) from "GameModerationAction" where kind='WARNING' and reason like 'Rude%'`)) === 1, 'a warning with a reason is kept with who gave it');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'restrict', courseId: OWN, traineeId: mine[0], hours: 2, reason: 'Repeated rude messages' });
  log(r.s === 200 && Number(psql(`select count(*) from "ArenaSuspension" where "courseId"='${OWN}' and "traineeId"='${mine[0]}' and "liftedAt" is null`)) === 1, 'restricting its own trainee works');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'endSession', courseId: OWN, matchId: 'ogchkmine', reason: 'Players asked to stop' });
  log(r.s === 200 && psql(`select status from "ArenaMatch" where id='ogchkmine'`) !== 'ACTIVE', 'ending its own game works');

  // escalation
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'escalate', courseId: OWN, traineeId: mine[1], reason: 'Possible cheating we cannot confirm' });
  log(r.s === 200, 'it can escalate to AAICBI');
  r = await call(S, 'GET', '/api/admin/game-ops/escalations');
  const inc = (r.j.items || []).find((i) => /cheating we cannot/.test(i.reason));
  log(!!inc && !inc.resolved, 'the Super Admin sees the escalation');
  r = await call(ORG, 'GET', '/api/admin/game-ops/escalations');
  log([401, 403].includes(r.s), 'an organization cannot read the platform escalation list');
  r = await call(S, 'POST', '/api/admin/game-ops/escalations', { id: inc.id, note: '' });
  log(r.s === 400, 'closing an incident needs a note');
  r = await call(S, 'POST', '/api/admin/game-ops/escalations', { id: inc.id, note: 'Checked the answers, no cheating found' });
  log(r.s === 200, 'the Super Admin closes it with a note');

  // policy switches
  const setPolicy = (patch) => call(S, 'PUT', `/api/admin/orgs/${ORG_ID}/gaming-policy`, patch);
  r = await setPolicy({ restrictTrainees: false });
  log(r.s === 200, 'the Super Admin can switch a capability off for one organization');
  r = await call(ORG, 'POST', '/api/org/games/moderation', { action: 'restrict', courseId: OWN, traineeId: mine[1], hours: 1, reason: 'Switched off should refuse' });
  log([403].includes(r.s), 'and the organization is then refused that action');
  r = await setPolicy({ restrictTrainees: true, liveMonitor: false });
  r = await call(ORG, 'GET', '/api/org/games/live');
  log(r.s === 403, 'live monitoring off is honoured');
  await setPolicy({ liveMonitor: true });
  r = await call(ORG, 'GET', '/api/org/games/results/export');
  log(r.s === 403, 'results export is off by default');
  await setPolicy({ resultsExport: true });
  r = await call(ORG, 'GET', '/api/org/games/results/export');
  log(r.s === 200 && /Name,Email/.test(r.t), 'and works once the Super Admin allows it');
  log(Number(psql(`select count(*) from "AuditEvent" where action='ORG_GAMING_POLICY_CHANGED'`)) >= 3, 'policy changes are recorded');
  r = await call(ORG, 'PUT', `/api/admin/orgs/${ORG_ID}/gaming-policy`, { resultsExport: true });
  log([401, 403].includes(r.s), 'an organization cannot change its own policy');

  // settings
  r = await call(ORG, 'PUT', '/api/org/games/settings', { courseId: OTHER, switches: { gameEnabled: false } });
  log(r.s === 404, 'settings of another organization\'s course are "not found"');
  r = await call(ORG, 'PUT', '/api/org/games/settings', { courseId: OWN, switches: { gameEnabled: true } });
  log([200, 400, 403].includes(r.s), 'turning a game on follows what the platform allows (' + r.s + ')');

  psql(`delete from "ArenaMatch" where id like 'ogchk%'`); psql(`delete from "ArenaSuspension" where "courseId"='${OWN}'`); psql(`delete from "OrgGamingPolicy"`);
})();
