// Organization password reset, change password (trainee and organization), the organization's own Trainees page,
// the organization Dashboard without platform review tiles, and no inert AI Assistant switch.
const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const call = async (cookie, method, path, body) => { const r = await fetch(B + path, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, body: body === undefined ? undefined : JSON.stringify(body) }); const t = await r.text(); let j = t; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const login = async (path, email, password) => { const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const c = r.headers.getSetCookie().map((x) => x.split(';')[0]).join('; '); return { s: r.status, cookie: c }; };
const forget = (f) => { try { fs.unlinkSync(`/tmp/dev/cookies-${f}.json`); } catch {} };
(async () => {
  clearThrottle();
  const ORG = 'org@dev.test', OLD = 'Passw0rd!dev';
  // ---- forgot password for the organization owner
  let r = await call('', 'POST', '/api/auth/training-org-forgot-password', { email: 'nobody-here@dev.test' });
  log(r.s === 200 && /If an account exists/.test(r.j.message), 'an unknown address gets the same friendly answer (nothing is revealed)');
  r = await call('', 'POST', '/api/auth/training-org-forgot-password', { email: ORG });
  const same = r.j.message;
  const token = psql(`select "resetToken" from "TrainingOrganization" where email='${ORG}'`);
  log(r.s === 200 && token.length > 20 && same === 'If an account exists for that email, a password reset link has been sent.', 'the owner gets a reset token with the same answer');
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token, password: 'short' });
  log(r.s === 400, 'a too-short new password is refused');
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token: 'x'.repeat(30), password: 'NewPassw0rd!1' });
  log(r.s === 400, 'an unknown token is refused');
  psql(`update "TrainingOrganization" set "resetTokenExpiresAt"=now()-interval '1 minute' where email='${ORG}'`);
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token, password: 'NewPassw0rd!1' });
  log(r.s === 400, 'an expired token is refused');
  r = await call('', 'POST', '/api/auth/training-org-forgot-password', { email: ORG });
  const t2 = psql(`select "resetToken" from "TrainingOrganization" where email='${ORG}'`);
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token: t2, password: 'NewPassw0rd!1' });
  log(r.s === 200, 'a fresh token resets the owner password');
  log((await login('/api/auth/training-org-login', ORG, OLD)).s === 401, 'the old password no longer works');
  let li = await login('/api/auth/training-org-login', ORG, 'NewPassw0rd!1');
  log(li.s === 200, 'the new password signs the owner in');
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token: t2, password: 'AnotherPass!2' });
  log(r.s === 400, 'the token cannot be used twice');

  // ---- change password as the organization (owner)
  clearThrottle();
  r = await call(li.cookie, 'POST', '/api/org/password', { currentPassword: 'wrong-password', newPassword: OLD });
  log(r.s === 400 && /not right/.test(r.j.error), 'change password needs the right current password');
  r = await call(li.cookie, 'POST', '/api/org/password', { currentPassword: 'NewPassw0rd!1', newPassword: 'short' });
  log(r.s === 400, 'and a new password of at least 8 characters');
  r = await call(li.cookie, 'POST', '/api/org/password', { currentPassword: 'NewPassw0rd!1', newPassword: OLD });
  log(r.s === 200, 'the owner changes the password from Settings');
  log((await login('/api/auth/training-org-login', ORG, OLD)).s === 200, 'and signs in with it');
  r = await call('', 'POST', '/api/org/password', { currentPassword: OLD, newPassword: 'Whatever123!' });
  log([401, 403].includes(r.s), 'signed-out callers are refused');

  // ---- team member: forgot and reset, and change password
  clearThrottle();
  const orgId = psql(`select id from "TrainingOrganization" where email='${ORG}'`);
  psql(`delete from "TrainingOrganizationMember" where email='viewer-check@dev.test'`);
  psql(`insert into "TrainingOrganizationMember" (id,"trainingOrganizationId",name,email,"passwordHash",role) values ('mchk1','${orgId}','Viewer Check','viewer-check@dev.test',(select "passwordHash" from "TrainingOrganization" where id='${orgId}'),'VIEWER')`);
  r = await call('', 'POST', '/api/auth/training-org-forgot-password', { email: 'viewer-check@dev.test' });
  const mt = psql(`select "setupToken" from "TrainingOrganizationMember" where id='mchk1'`);
  log(r.s === 200 && mt.length > 20, 'a teammate also gets a reset link');
  r = await call('', 'POST', '/api/auth/training-org-reset-password', { token: mt, password: 'MemberPass!1' });
  log(r.s === 200, 'and can choose a new password with it');
  const mli = await login('/api/auth/training-org-login', 'viewer-check@dev.test', 'MemberPass!1');
  log(mli.s === 200, 'the teammate signs in');
  r = await call(mli.cookie, 'POST', '/api/org/password', { currentPassword: 'MemberPass!1', newPassword: 'MemberPass!2' });
  log(r.s === 200, 'even a Viewer can change their own password');
  log((await login('/api/auth/training-org-login', 'viewer-check@dev.test', 'MemberPass!2')).s === 200, 'and the new one works');
  psql(`update "TrainingOrganizationMember" set "disabledAt"=now() where id='mchk1'`);
  r = await call('', 'POST', '/api/auth/training-org-forgot-password', { email: 'viewer-check@dev.test' });
  const mt2 = psql(`select coalesce("setupToken",'none') from "TrainingOrganizationMember" where id='mchk1'`);
  log(r.s === 200 && mt2 === 'none', 'a disabled teammate gets no reset link');
  psql(`delete from "TrainingOrganizationMember" where id='mchk1'`);

  // ---- trainee change password
  clearThrottle();
  const tl = await login('/api/auth/trainee-login', 't11@dev.test', OLD);
  log(tl.s === 200, 'a trainee signs in');
  r = await call(tl.cookie, 'POST', '/api/trainee/password', { currentPassword: 'nope-nope', newPassword: 'TraineeNew!1' });
  log(r.s === 400, 'the trainee needs the right current password');
  r = await call(tl.cookie, 'POST', '/api/trainee/password', { currentPassword: OLD, newPassword: 'TraineeNew!1' });
  log(r.s === 200, 'the trainee changes the password');
  log((await login('/api/auth/trainee-login', 't11@dev.test', 'TraineeNew!1')).s === 200, 'and signs in with the new one');
  r = await call((await login('/api/auth/trainee-login', 't11@dev.test', 'TraineeNew!1')).cookie, 'POST', '/api/trainee/password', { currentPassword: 'TraineeNew!1', newPassword: OLD });
  log(r.s === 200, 'and can put it back');
  forget('t11@dev.test'); forget('org@dev.test');

  // ---- pages
  clearThrottle();
  const oc = (await cookiesFor('/api/auth/training-org-login', ORG)).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await call(oc, 'GET', '/admin/organization/trainees');
  const names = ['Amara Nwosu', 'Kemi Alade'];
  log(r.s === 200 && names.every((n) => r.t.includes(n)), 'the organization Trainees page lists its own trainees');
  const other = psql(`select t.name from "CourseEnrollment" e join "Trainee" t on t.id=e.\"traineeId\" join "Course" c on c.id=e.\"courseId\" where c."createdById"='cmuznkixe0000nwm2y5jx210x' limit 1`);
  log(!other || !r.t.includes(other), 'and never another organization’s trainees' + (other ? ` (checked ${other})` : ''));
  r = await call(oc, 'GET', '/admin/organization/trainees?q=Kemi');
  log(r.s === 200 && r.t.includes('Kemi Alade') && !r.t.includes('Amara Nwosu'), 'search narrows the list');
  r = await call(oc, 'GET', '/admin/dashboard');
  log(r.s === 200 && !/Reported profile|Job posting|Employer<\/p>/.test(r.t) && !/Employer accounts/.test(r.t), 'the organization Dashboard has no platform review tiles or staff links');
  log(/Trainees/.test(r.t), 'and offers Trainees as a quick action');
  r = await call(oc, 'GET', '/org/forgot-password');
  log(r.s === 200, 'the organization forgot-password page opens');
  r = await call(oc, 'GET', '/org/login');
  log(/org\/forgot-password/.test(r.t), 'the sign-in page links to it');
})();
