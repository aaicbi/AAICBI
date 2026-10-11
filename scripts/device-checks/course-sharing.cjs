const fs = require('fs');
const { B, log, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const PW = 'Passw0rd!dev';
async function login(path, email) {
  clearThrottle();
  const r = await fetch(B + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  if (!r.ok) throw new Error('login failed ' + email + ' ' + r.status);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const call = async (m, p, c, b) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
(async () => {
  clearThrottle();
  const cleanup = () => {
    psql(`delete from "Course" where id like 'cs_%' or title like 'CSCHECK%'`);
    psql(`delete from "Exam" where code like 'CSCHECK%' or title like 'CSCHECK%'`);
    psql(`delete from "TrainingOrganizationMember" where email like '%@cscheck.test'`);
    psql(`delete from "ContentShareLink" where "createdByName" like '%' and "resourceType" in ('COURSE','EXAM','ASSIGNMENT') and "resourceId" like 'cs_%'`);
    psql(`delete from "ContentCollaborator" where "resourceId" like 'cs_%'`);
    psql(`delete from "OrgActivity" where "actorName" like 'CSCHECK%'`);
  };
  cleanup();
  const superId = psql(`select id from "User" where email='super@dev.test'`);
  const staffId = psql(`select id from "User" where email='staff@dev.test'`);
  const orgId = psql(`select id from "TrainingOrganization" where email='org@dev.test'`);
  const orgUser = psql(`select "staffUserId" from "TrainingOrganization" where email='org@dev.test'`);
  const hash = psql(`select "passwordHash" from "TrainingOrganization" where email='org@dev.test'`);
  // a course owned by the super admin, with a module, lesson, material, module assessment (1 question) and an assignment
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt","isFree") values ('cs_c1','CSCHECK Course','About','${superId}',now(),true)`);
  psql(`insert into "Module"(id,"courseId",title,"order") values ('cs_m1','cs_c1','Module one',0)`);
  psql(`insert into "Lesson"(id,"moduleId",title,"order") values ('cs_l1','cs_m1','Lesson one',0)`);
  psql(`insert into "Material"(id,"lessonId",type,title,url,"order","updatedAt") values ('cs_x1','cs_l1','PDF','Notes','https://example.com/n.pdf',0,now())`);
  psql(`insert into "Exam"(id,code,title,"moduleId","createdById","updatedAt") values ('cs_e1','CSCHECK-E1','CSCHECK Assessment','cs_m1','${superId}',now())`);
  psql(`insert into "Question"(id,"examId",text,"order") values ('cs_q1','cs_e1','What is 2+2?',0)`);
  psql(`insert into "Option"(id,"questionId",text,key,"isCorrect","order") values ('cs_o1','cs_q1','4','A',true,0),('cs_o2','cs_q1','5','B',false,1)`);
  psql(`insert into "Assignment"(id,title,"courseId","createdById","updatedAt") values ('cs_a1','CSCHECK Assignment','cs_c1','${superId}',now())`);

  const sup = await login('/api/auth/login', 'super@dev.test');
  const staff = await login('/api/auth/login', 'staff@dev.test');
  const owner = await login('/api/auth/training-org-login', 'org@dev.test');

  // ---- A. the super admin moves the course to the organization
  let r = await call('PUT', '/api/courses/cs_c1', owner, { title: 'CSCHECK hijack' });
  log(r.s === 404, `before the move, the organization cannot touch the course (${r.s})`);
  r = await call('POST', '/api/admin/courses/cs_c1/transfer', staff, { organizationId: orgId });
  log(r.s === 403, `a staff admin cannot move a course (${r.s})`);
  r = await call('POST', '/api/admin/courses/cs_c1/transfer', sup, { organizationId: orgId });
  log(r.s === 200 && r.d.exams === 1 && r.d.assignments === 1, `a super admin moves it, and its exam and assignment go with it (${r.s} ${JSON.stringify(r.d && { exams: r.d.exams, assignments: r.d.assignments })})`);
  log(psql(`select "createdById" from "Course" where id='cs_c1'`) === orgUser && psql(`select "createdById" from "Exam" where id='cs_e1'`) === orgUser && psql(`select "createdById" from "Assignment" where id='cs_a1'`) === orgUser, 'the organization now owns the course, assessment and assignment');
  r = await call('PUT', '/api/courses/cs_c1', owner, { title: 'CSCHECK Course' });
  log(r.s === 200, `the organization can now edit it (${r.s})`);
  r = await call('POST', '/api/admin/courses/cs_c1/transfer', sup, { organizationId: orgId });
  log(r.s === 409, `moving it to the same owner again is refused (${r.s})`);

  // ---- people in the organization have their own roles
  for (const [n, role] of [['view', 'VIEWER'], ['edit', 'EDITOR'], ['mgr', 'MANAGER']]) {
    psql(`insert into "TrainingOrganizationMember"(id,"trainingOrganizationId",name,email,"passwordHash",role) values ('cs_mem_${n}','${orgId}','CSCHECK ${n}','${n}@cscheck.test','${hash}','${role}')`);
  }
  const viewer = await login('/api/auth/training-org-login', 'view@cscheck.test');
  const editor = await login('/api/auth/training-org-login', 'edit@cscheck.test');
  const manager = await login('/api/auth/training-org-login', 'mgr@cscheck.test');
  r = await call('GET', '/api/courses/cs_c1', viewer); log(r.s === 200, `a viewer can look at the course (${r.s})`);
  r = await call('PUT', '/api/courses/cs_c1', viewer, { title: 'CSCHECK viewer edit' }); log(r.s === 403, `a viewer cannot change it (${r.s}: ${r.d && r.d.error})`);
  r = await call('PUT', '/api/courses/cs_c1', editor, { title: 'CSCHECK Course edited' }); log(r.s === 200, `an editor can edit it (${r.s})`);
  r = await call('PUT', '/api/courses/cs_c1', editor, { status: 'PUBLISHED' }); log(r.s === 403, `an editor cannot publish the course (${r.s})`);
  r = await call('DELETE', '/api/courses/cs_c1', editor); log(r.s === 403, `an editor cannot delete it (${r.s})`);
  r = await call('POST', '/api/exams/cs_e1/publish', editor); log(r.s === 403, `an editor cannot publish an examination (${r.s})`);
  r = await call('POST', '/api/org/members', editor, { name: 'X', email: 'x@cscheck.test' }); log(r.s === 403, `an editor cannot change the team (${r.s})`);
  r = await call('PUT', '/api/courses/cs_c1', manager, { title: 'CSCHECK Course' }); log(r.s === 200, `a manager can edit (${r.s})`);
  r = await call('GET', '/api/org/members', manager); log(r.s === 200 && r.d.members.some((m) => m.role === 'VIEWER'), 'the team list shows each person\'s role');
  r = await call('GET', '/api/org/activity', manager);
  log(r.s === 200 && r.d.activity.some((a) => a.actorName === 'CSCHECK edit') && r.d.activity.some((a) => a.actorName === 'CSCHECK mgr'), `the activity list names who did what (${(r.d && r.d.activity || []).slice(0, 3).map((a) => `${a.actorName}: ${a.action}`).join('; ')})`);
  r = await call('GET', '/api/org/activity', editor); log(r.s === 403, `an editor cannot read the activity (${r.s})`);
  r = await call('GET', '/api/courses/cs_c1', owner); log(r.s === 200 && r.d.ownerName === 'Northwind Academy', 'the owner still works as before');
  psql(`update "TrainingOrganizationMember" set "disabledAt"=now() where id='cs_mem_view'`);
  r = await call('GET', '/api/courses/cs_c1', viewer); log(r.s === 401, `disabling someone ends their open session at once (${r.s})`);
  psql(`update "TrainingOrganizationMember" set role='VIEWER' where id='cs_mem_edit'`);
  r = await call('PUT', '/api/courses/cs_c1', editor, { title: 'CSCHECK after demotion' }); log(r.s === 403, `demoting someone takes effect on their next request (${r.s})`);

  // ---- B. a share link lets another staff member edit
  r = await call('POST', '/api/collab/links', owner, { type: 'COURSE', id: 'cs_c1', role: 'EDITOR' });
  log(r.s === 201 && /\/collaborate\//.test(r.d.url), `the organization makes an invite link (${r.s})`);
  const token = r.d.url.split('/collaborate/')[1];
  r = await call('GET', '/api/collab/preview?token=' + token); log(r.s === 200 && r.d.state === 'ok' && r.d.title === 'CSCHECK Course', 'the link preview says what is shared and by whom without signing in');
  r = await call('GET', '/api/collab/preview?token=nonsense-nonsense-nonsense'); log(r.s === 404, 'a made-up link is not valid');
  log(!psql(`select "tokenHash" from "ContentShareLink" order by "createdAt" desc limit 1`).includes(token), 'only a hash of the link is stored');
  r = await call('PUT', '/api/courses/cs_c1', staff, { title: 'CSCHECK staff before' }); log(r.s === 404, `before joining, staff cannot edit (${r.s})`);
  r = await call('POST', '/api/collab/accept', null, { token }); log(r.s === 401, `signing in is needed to join (${r.s})`);
  const trainee = await login('/api/auth/trainee-login', 't0@dev.test');
  r = await call('POST', '/api/collab/accept', trainee, { token }); log(r.s === 403, `a trainee cannot join (${r.s})`);
  r = await call('POST', '/api/collab/accept', staff, { token }); log(r.s === 200 && r.d.kind === 'joined', `staff joins as an editor (${r.s} ${r.d && r.d.kind})`);
  r = await call('POST', '/api/collab/accept', staff, { token }); log(r.s === 200 && r.d.kind === 'already', 'opening the link again changes nothing');
  r = await call('PUT', '/api/courses/cs_c1', staff, { title: 'CSCHECK Course by staff' }); log(r.s === 200, `the editor can edit the course (${r.s})`);
  r = await call('PUT', '/api/courses/cs_c1', staff, { isFree: false, priceKobo: 100000 }); log(r.s === 403, `but not change pricing (${r.s})`);
  r = await call('DELETE', '/api/courses/cs_c1', staff); log(r.s === 403, `or delete the course (${r.s})`);
  r = await call('GET', '/api/exams/cs_e1', staff); log(r.s === 200, `the course's assessment opens for the editor (${r.s})`);
  r = await call('POST', '/api/exams/cs_e1/publish', staff); log(r.s === 403, `but publishing it stays with the owner (${r.s})`);
  r = await call('GET', '/api/courses', staff); log(r.s === 200 && r.d.some((c) => c.id === 'cs_c1'), 'the shared course is in the editor\'s own list');
  r = await call('GET', '/api/exams', staff); log(r.s === 200 && r.d.some((e) => e.id === 'cs_e1'), 'and so is its assessment');
  r = await call('GET', '/api/collab/links?type=COURSE&id=cs_c1', staff); log(r.s === 200 && r.d.youAre === 'editor' && r.d.collaborators.length === 1, 'the editor sees who can edit');
  const collab = r.d.collaborators[0];
  r = await call('POST', '/api/collab/links', staff, { type: 'COURSE', id: 'cs_c1', role: 'COPY' }); log(r.s === 403, `an editor cannot hand out copies (${r.s})`);
  r = await call('DELETE', `/api/collab/collaborators/${collab.id}`, owner); log(r.s === 200, 'the owner removes the editor');
  r = await call('PUT', '/api/courses/cs_c1', staff, { title: 'CSCHECK removed' }); log(r.s === 404, `a removed editor has no access (${r.s})`);
  // expiry and cancelling
  psql(`update "ContentShareLink" set "expiresAt"=now() - interval '1 hour' where "resourceId"='cs_c1'`);
  r = await call('POST', '/api/collab/accept', staff, { token }); log(r.s === 410, `an expired link no longer works (${r.s})`);
  r = await call('POST', '/api/collab/links', owner, { type: 'COURSE', id: 'cs_c1', role: 'EDITOR' });
  const t2 = r.d.url.split('/collaborate/')[1];
  r = await call('GET', '/api/collab/links?type=COURSE&id=cs_c1', owner);
  const lid = r.d.links[0].id;
  r = await call('DELETE', `/api/collab/links/${lid}`, owner); log(r.s === 200, 'the owner cancels a link');
  r = await call('POST', '/api/collab/accept', staff, { token: t2 }); log(r.s === 410, `a cancelled link no longer works (${r.s})`);

  // ---- C. a copy link gives another account its own copy
  r = await call('POST', '/api/collab/links', owner, { type: 'COURSE', id: 'cs_c1', role: 'COPY' });
  log(r.s === 201, `the owner makes a copy link (${r.s})`);
  const t3 = r.d.url.split('/collaborate/')[1];
  r = await call('POST', '/api/collab/accept', staff, { token: t3 });
  log(r.s === 200 && r.d.kind === 'copied', `staff takes a copy (${r.s} ${r.d && r.d.kind})`);
  const copyId = r.d && r.d.id;
  log(psql(`select "createdById" from "Course" where id='${copyId}'`) === staffId && psql(`select status from "Course" where id='${copyId}'`) === 'DRAFT', 'the copy belongs to the new owner and starts as a draft');
  log(psql(`select count(*) from "Module" where "courseId"='${copyId}'`) === '1' && psql(`select count(*) from "Lesson" l join "Module" m on m.id=l."moduleId" where m."courseId"='${copyId}'`) === '1' && psql(`select count(*) from "Material" x join "Lesson" l on l.id=x."lessonId" join "Module" m on m.id=l."moduleId" where m."courseId"='${copyId}'`) === '1', 'its module, lesson and material came across');
  log(psql(`select count(*) from "Exam" e join "Module" m on m.id=e."moduleId" where m."courseId"='${copyId}' and e."createdById"='${staffId}' and e.published=false`) === '1' && psql(`select count(*) from "Question" q join "Exam" e on e.id=q."examId" join "Module" m on m.id=e."moduleId" where m."courseId"='${copyId}'`) === '1', 'the assessment and its question came across, unpublished');
  log(psql(`select title from "Course" where id='cs_c1'`).startsWith('CSCHECK Course') && psql(`select "createdById" from "Course" where id='cs_c1'`) === orgUser, 'the original is untouched');
  psql(`delete from "Course" where id='${copyId}'`);

  // ---- bring it back to the platform
  r = await call('POST', '/api/admin/courses/cs_c1/transfer', sup, { toPlatform: true });
  log(r.s === 200 && psql(`select "createdById" from "Course" where id='cs_c1'`) === superId, `the super admin can bring it back (${r.s})`);
  cleanup();
})().catch((e) => { console.error(e); process.exit(1); });
