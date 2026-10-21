// Organization owners add admins and instructors, give them roles and (for instructors) courses. Over HTTP against the local test database.
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const { B, cookiesFor, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } };
const jar = {};
async function ck(email) { if (!jar[email]) jar[email] = (await cookiesFor('/api/auth/training-org-login', email)).map((c) => `${c.name}=${c.value}`).join('; '); return jar[email]; }
async function call(cookie, method, path, body) { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, text: t.replace(/<!-- -->/g, '') }; }

(async () => {
  clearThrottle();
  const org = await prisma.trainingOrganization.findFirstOrThrow({ where: { email: 'org@dev.test' } });
  const staff = await prisma.user.findFirstOrThrow({ where: { id: org.staffUserId } });
  const t11 = await prisma.trainee.findFirstOrThrow({ where: { email: 't11@dev.test' } });
  const mine = (await prisma.course.findMany({ where: { createdById: staff.id }, select: { id: true } })).map((c) => c.id);
  const taken = await prisma.courseEnrollment.findMany({ where: { courseId: { in: mine } }, select: { traineeId: true } });
  const other = await prisma.trainee.findFirstOrThrow({ where: { id: { notIn: [t11.id, ...taken.map((e) => e.traineeId)] } } });
  const cleanup = async () => {
    await prisma.trainingOrganizationMember.deleteMany({ where: { email: { in: ['zz-inst@dev.test', 'zz-admin@dev.test'] } } });
    await prisma.course.deleteMany({ where: { title: { startsWith: 'ZZ Team' } } });
    for (const e of ['zz-inst@dev.test', 'zz-admin@dev.test']) fs.rmSync(`/tmp/dev/cookies-${e}.json`, { force: true });
  };
  await cleanup();
  const A = await prisma.course.create({ data: { title: 'ZZ Team A', createdById: staff.id } });
  const Bc = await prisma.course.create({ data: { title: 'ZZ Team B', createdById: staff.id } });
  await prisma.courseEnrollment.create({ data: { traineeId: t11.id, courseId: A.id, source: 'FREE', unlockedAt: new Date() } });
  await prisma.courseEnrollment.create({ data: { traineeId: other.id, courseId: Bc.id, source: 'FREE', unlockedAt: new Date() } });
  const foreign = await prisma.course.findFirst({ where: { createdById: { not: staff.id } } });
  const hash = (await prisma.user.findFirstOrThrow({ where: { email: 'super@dev.test' } })).passwordHash;
  try {
    const owner = await ck('org@dev.test');
    let r = await call(owner, 'GET', '/api/org/members');
    ok(r.s === 200 && Array.isArray(r.j.courses) && r.j.courses.some((c) => c.id === A.id), 'the owner sees the team and their own courses');
    r = await call(owner, 'POST', '/api/org/members', { name: 'ZZ Instructor', email: 'zz-inst@dev.test', role: 'INSTRUCTOR', courseIds: [A.id, ...(foreign ? [foreign.id] : [])] });
    ok(r.s === 201, 'the owner invites an instructor (' + r.s + ')');
    const inst = await prisma.trainingOrganizationMember.findUniqueOrThrow({ where: { email: 'zz-inst@dev.test' }, include: { courses: true } });
    ok(inst.role === 'INSTRUCTOR' && inst.courses.length === 1 && inst.courses[0].courseId === A.id, 'the instructor is given only the owner\'s own course (another organization\'s course is ignored)');
    r = await call(owner, 'POST', '/api/org/members', { name: 'ZZ Admin', email: 'zz-admin@dev.test', role: 'MANAGER' });
    ok(r.s === 201, 'the owner invites an admin');
    r = await call(owner, 'POST', '/api/org/members', { name: 'X', email: 'zz-x@dev.test', role: 'SUPERUSER' });
    ok(r.s === 400, 'an unknown role is refused');
    await prisma.trainingOrganizationMember.updateMany({ where: { email: { in: ['zz-inst@dev.test', 'zz-admin@dev.test'] } }, data: { passwordHash: hash, setupToken: null } });

    const cInst = await ck('zz-inst@dev.test'), cAdm = await ck('zz-admin@dev.test');
    r = await call(cInst, 'GET', '/admin/organization/trainees');
    ok(r.text.includes(`/admin/organization/trainees/${t11.id}`) && !r.text.includes(`/admin/organization/trainees/${other.id}`), 'the instructor\'s trainee list shows only the assigned course\'s trainees');
    ok((await call(cInst, 'GET', `/api/reports/trainees/${t11.id}/report.pdf`)).s === 200, 'the instructor can download a report for their trainee');
    ok((await call(cInst, 'GET', `/api/reports/trainees/${other.id}/report.pdf`)).s === 404, 'but not for a trainee in a course they were not given');
    ok((await call(cInst, 'GET', `/admin/organization/trainees/${other.id}`)).text.includes('NEXT_NOT_FOUND'), 'nor open that trainee\'s page');
    r = await call(cInst, 'POST', '/api/org/members', { name: 'Y', email: 'zz-y@dev.test', role: 'EDITOR' });
    ok(r.s === 403, 'an instructor cannot manage the team');
    ok((await call(cInst, 'DELETE', `/api/courses/${A.id}`)).s === 403, 'an instructor cannot delete a course');

    // editing is limited to the instructor's courses
    r = await call(cInst, 'POST', `/api/courses/${A.id}/modules`, { title: 'ZZ new module' });
    ok(r.s === 201 || r.s === 200, 'an instructor can add a module to their own course (' + r.s + ')');
    r = await call(cInst, 'POST', `/api/courses/${Bc.id}/modules`, { title: 'ZZ sneaky' });
    ok(r.s === 403 && /not one of yours/.test(JSON.stringify(r.j)), 'but not to a course they were not given');
    const modB = await prisma.module.create({ data: { courseId: Bc.id, title: 'B module', order: 1 } });
    const lessonB = await prisma.lesson.create({ data: { moduleId: modB.id, title: 'B lesson', order: 1 } });
    ok((await call(cInst, 'PUT', `/api/modules/${modB.id}`, { title: 'x' })).s === 403, 'nor edit a module of that course');
    ok((await call(cInst, 'PUT', `/api/lessons/${lessonB.id}`, { title: 'x' })).s === 403, 'nor a lesson of that course');
    ok((await call(cInst, 'POST', `/api/courses/${Bc.id}/cohorts`, { name: 'x' })).s === 403, 'nor add a cohort to it');
    ok((await call(cInst, 'POST', '/api/courses', { title: 'ZZ Team new' })).s === 403, 'an instructor cannot create a new course');
    ok((await call(cInst, 'GET', `/api/courses/${Bc.id}`)).s === 200, 'they can still look at the organization\'s other courses');
    ok((await call(cAdm, 'PUT', `/api/modules/${modB.id}`, { title: 'B module renamed' })).s === 200, 'an admin can edit any of the organization\'s courses');

    r = await call(cAdm, 'GET', '/admin/organization/trainees');
    ok(r.text.includes(`/admin/organization/trainees/${t11.id}`) && r.text.includes(`/admin/organization/trainees/${other.id}`), 'an admin sees all the organization\'s trainees');
    r = await call(cAdm, 'POST', '/api/org/members', { name: 'ZZ Helper', email: 'zz-helper@dev.test', role: 'EDITOR' });
    ok(r.s === 201, 'an admin can add team members');
    await prisma.trainingOrganizationMember.deleteMany({ where: { email: 'zz-helper@dev.test' } });

    // owner edits the instructor's courses, and changes the role
    r = await call(owner, 'PATCH', `/api/org/members/${inst.id}`, { action: 'courses', courseIds: [A.id, Bc.id] });
    ok(r.s === 200 && r.j.courseIds.length === 2, 'the owner assigns more courses');
    ok((await call(cInst, 'GET', `/admin/organization/trainees/${other.id}`)).text.includes('Summary'), 'the instructor now sees the second course\'s trainee');
    ok((await call(owner, 'PATCH', `/api/org/members/${inst.id}`, { action: 'courses', courseIds: foreign ? [foreign.id] : [] })).j.courseIds.length === 0, 'courses of another organization cannot be assigned');
    const adm = await prisma.trainingOrganizationMember.findUniqueOrThrow({ where: { email: 'zz-admin@dev.test' } });
    ok((await call(owner, 'PATCH', `/api/org/members/${adm.id}`, { action: 'courses', courseIds: [A.id] })).s === 400, 'courses can only be given to instructors');
    ok((await call(owner, 'PATCH', `/api/org/members/${inst.id}`, { action: 'role', role: 'VIEWER' })).s === 200, 'the owner can change a role');
    r = await call(owner, 'GET', '/admin/organization/team');
    ok(r.s === 200, 'the team page renders');
  } finally {
    await cleanup();
    await prisma.courseEnrollment.deleteMany({ where: { courseId: { in: [A.id, Bc.id] } } });
    await prisma.course.deleteMany({ where: { id: { in: [A.id, Bc.id] } } });
    await prisma.$disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(2); });
