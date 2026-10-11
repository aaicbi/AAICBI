const { B, log, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const call = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const rv = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const org = jar(await cookiesFor('/api/auth/training-org-login', 'org@dev.test'));
  const t0 = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const t1 = jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test'));
  const outsider = psql(`select t.email from "Trainee" t where t.email like 't%@dev.test' and not exists (select 1 from "CourseEnrollment" ce join "Course" c on c.id=ce."courseId" join "TrainingOrganization" o on o."staffUserId"=c."createdById" where ce."traineeId"=t.id and o.email='org@dev.test') limit 1`);
  const cleanup = () => psql(`delete from "Post" where "legacyEducationPostId" is null; delete from "ReviewLog" where kind='GUIDE_QUESTION' and "itemId" like 'tq%'; delete from "GuideUnanswered" where text like 'test-review %'; delete from "GuideEntry" where question in ('How do I add a colleague to my startup?','Can I get a refund for a course?'); update "User" set "canReview"=false where email='staff@dev.test'; delete from "NotificationLog" where type like 'POST_%'; delete from "UserNotification" where type like 'POST_%'`);
  cleanup();
  const page = (id, c) => call('GET', `/post/${id}`, c);
  // access
  let r = await call('GET', '/api/admin/review', null); log(r.s === 401, 'a visitor cannot open the review inbox');
  r = await call('GET', '/api/admin/review', t0); log(r.s === 403, 'a member cannot');
  r = await call('GET', '/api/admin/review', rv); log(r.s === 403, 'ordinary staff cannot until made a reviewer');
  r = await call('GET', '/api/admin/review', org); log(r.s === 403, 'an organization account cannot');
  r = await call('GET', '/api/admin/review', sa); log(r.s === 200 && r.d.me.isSuperAdmin === true, 'the super admin can');
  const staffId = psql(`select id from "User" where email='staff@dev.test'`);
  r = await call('PATCH', `/api/admin/staff/${staffId}`, rv, { canReview: true }); log([401, 403].includes(r.s), 'staff cannot make themselves a reviewer');
  r = await call('PATCH', `/api/admin/staff/${staffId}`, sa, { canReview: true }); log(r.s === 200 && r.d.canReview === true, 'the super admin makes a staff member a reviewer');
  r = await call('GET', '/api/admin/review', rv); log(r.s === 200 && r.d.me.isSuperAdmin === false, 'the reviewer can now open the inbox');
  // reviewers cannot reach Loop settings, the consultant or AI guidance
  for (const [m, p, b] of [['GET', '/api/admin/guide'], ['PUT', '/api/admin/guide', { consultantEnabled: true }], ['POST', '/api/admin/guide/ai-guidance', { feature: 'learning-buddy', note: 'Be warm and brief with short examples.' }], ['POST', '/api/admin/guide/consultant/report', {}], ['GET', '/api/admin/guide/consultant/suggestions']]) { const x = await call(m, p, rv, b); log([401, 403].includes(x.s), `a reviewer cannot ${m} ${p}`); }
  // posts
  r = await call('POST', '/api/posts', t0, { body: 'Post A for review', submit: true }); const A = r.d.id;
  r = await call('POST', '/api/posts', t1, { body: 'Post B for review', submit: true }); const Bp = r.d.id;
  psql(`insert into "GuideUnanswered" (id,text,asked,"tokenKey",variants,reason,"roleCounts","context","firstAskedAt","lastAskedAt") values ('tq1','test-review how do i add a colleague to my startup',5,'colleague startup','{}','NO_MATCH','{"trainee":5}','[]',now(),now()), ('tq2','test-review can i get a refund for a course',3,'refund course','{}','NO_MATCH','{"trainee":3}','[]',now(),now()), ('tq3','test-review is this question off topic',1,'topic','{}','NO_MATCH','{}','[]',now(),now())`);
  r = await call('GET', '/api/admin/review', rv); const kinds = r.d.items.map((i) => i.kind + ':' + i.id); log(kinds.includes('POST:' + A) && kinds.includes('POST:' + Bp) && kinds.includes('LOOP:tq1'), 'the inbox lists posts and Loop questions together');
  log(r.d.counts.posts >= 2 && r.d.counts.loop >= 3, `counts: ${JSON.stringify(r.d.counts)}`);
  r = await call('GET', '/api/admin/review?filter=loop', rv); log(r.d.items.every((i) => i.kind === 'LOOP'), 'the Loop filter shows only questions');
  // decisions by a reviewer
  r = await call('POST', `/api/admin/review/posts/${A}`, rv, { action: 'request_changes' }); log(r.s === 400, 'asking for changes needs a reason');
  r = await call('POST', `/api/admin/review/posts/${A}`, rv, { action: 'approve' }); log(r.s === 200, 'a reviewer approves a post');
  let p = await page(A); log(p.s === 200, 'and it is public');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'escalate' }); log(r.s === 400, 'escalating needs a reason');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'escalate', note: 'Mentions a named company; needs a legal view.' }); log(r.s === 200, 'a reviewer escalates a post with a reason');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'approve' }); log(r.s === 403, 'a reviewer can no longer approve an escalated post');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'reject', note: 'No reason is enough here.' }); log(r.s === 403, 'nor reject it');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'escalate', note: 'Escalating again to be sure.' }); log(r.s === 409, 'it cannot be escalated twice');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'return' }); log(r.s === 403, 'a reviewer cannot send it back to themselves');
  r = await call('GET', '/api/admin/review?filter=escalated', rv); const esc = r.d.items.find((i) => i.id === Bp); log(!!esc && /legal view/.test(esc.escalationNote), 'the escalation and its note are visible in the inbox');
  r = await call('GET', '/api/admin/review', sa); log(r.d.items[0].escalated === true, 'for the super admin, escalated items come first');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, sa, { action: 'return' }); log(r.s === 200, 'the super admin can send it back to the reviewers');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, rv, { action: 'escalate', note: 'Still unsure: please decide this one.' }); log(r.s === 200, 'the reviewer escalates it again');
  r = await call('POST', `/api/admin/review/posts/${Bp}`, sa, { action: 'approve' }); log(r.s === 200, 'the super admin decides it');
  log(psql(`select (escalatedAt is null)::text from "Post" where id='${Bp}'`.replace('escalatedAt', '"escalatedAt"')) === 'true', 'the escalation is cleared once decided');
  log(Number(psql(`select count(*) from "PostReview" where "postId"='${Bp}' and action in ('ESCALATED','RETURNED','APPROVED')`)) >= 4, 'every step is in the history with who and why');
  // Loop questions
  r = await call('POST', '/api/admin/review/loop/tq1', rv, { action: 'answer', question: 'How do I add a colleague to my startup?' }); log(r.s === 400, 'an answer needs its text');
  r = await call('POST', '/api/admin/review/loop/tq1', rv, { action: 'answer', question: 'How do I add a colleague to my startup?', answer: 'Open My Startups, choose your startup and invite them by handle. They join once they accept.' }); log(r.s === 201, 'a reviewer approves an answer into Loop');
  log(psql(`select status from "GuideUnanswered" where id='tq1'`) === 'ANSWERED' && psql(`select count(*) from "GuideEntry" where question like 'How do I add a colleague%'`) === '1', 'Loop now knows the answer');
  log(Number(psql(`select count(*) from "GuideEntryVersion" where "changeNote" like 'Approved by a reviewer%'`)) >= 1, 'the answer version records it was approved by a reviewer');
  log(Number(psql(`select count(*) from "ReviewLog" where "itemId"='tq1' and action='ANSWERED'`)) === 1, 'and the decision is logged');
  r = await call('POST', '/api/admin/review/loop/tq3', rv, { action: 'reject' }); log(r.s === 400, 'declining a question needs a reason');
  r = await call('POST', '/api/admin/review/loop/tq3', rv, { action: 'reject', note: 'Off topic for the guide.' }); log(r.s === 200, 'a reviewer declines a question with a reason');
  r = await call('POST', '/api/admin/review/loop/tq2', rv, { action: 'escalate', note: 'Depends on a payment policy I cannot see.' }); log(r.s === 200, 'a reviewer escalates a Loop question');
  r = await call('POST', '/api/admin/review/loop/tq2', rv, { action: 'answer', question: 'Can I get a refund for a course?', answer: 'Refunds depend on the course. Message the training organization first.' }); log(r.s === 403, 'a reviewer cannot answer an escalated question');
  r = await call('POST', '/api/admin/review/loop/tq2', sa, { action: 'answer', question: 'Can I get a refund for a course?', answer: 'Refunds depend on the course. Message the training organization first.' }); log(r.s === 201, 'the super admin answers it');
  r = await call('POST', '/api/admin/review/loop/tq2', rv, { action: 'answer', question: 'Again', answer: 'This was already dealt with so it should fail.' }); log(r.s === 409, 'a dealt-with question cannot be answered twice');
  // organization hold and appeal
  r = await call('GET', '/api/org/posts', t0); log([401, 403].includes(r.s), 'a member cannot use the organization routes');
  r = await call('GET', '/api/org/posts', org); log(r.s === 200 && r.d.posts.some((x) => x.id === A), 'the organization sees its trainees\' published posts');
  r = await call('POST', `/api/org/posts/${A}`, org, { action: 'block' }); log(r.s === 400, 'holding a post needs a reason');
  r = await call('POST', `/api/org/posts/${A}`, org, { action: 'block', reason: 'The video shows a client logo.' }); log(r.s === 200, 'the organization holds a trainee post');
  p = await page(A); log(p.s === 404, 'the post is hidden from the public');
  r = await call('GET', '/api/posts/mine', t0); const mine = r.d.posts.find((x) => x.id === A); log(!!mine.orgBlockedAt && /client logo/.test(mine.orgBlockReason), 'the trainee sees it is held and why');
  if (outsider) { const oc = jar(await cookiesFor('/api/auth/trainee-login', outsider)); const o = await call('POST', '/api/posts', oc, { body: 'A post by someone outside the organization', submit: true }); await call('POST', `/api/admin/review/posts/${o.d.id}`, sa, { action: 'approve' }); const bx = await call('POST', `/api/org/posts/${o.d.id}`, org, { action: 'block', reason: 'Trying to hide a stranger.' }); log(bx.s === 403, `the organization cannot hold a post by someone who is not its trainee (${outsider})`); }
  r = await call('POST', `/api/posts/${A}/appeal`, t1, { note: 'Not my post, but trying anyway.' }); log(r.s === 403, 'only the author side can appeal');
  r = await call('POST', `/api/posts/${A}/appeal`, t0, { note: 'no' }); log(r.s === 400, 'an appeal needs a real reason');
  r = await call('POST', `/api/posts/${A}/appeal`, t0, { note: 'The logo is blurred and the client agreed to appear.' }); log(r.s === 200, 'the trainee appeals to the central team');
  r = await call('POST', `/api/posts/${A}/appeal`, t0, { note: 'Appealing a second time at once.' }); log(r.s === 409, 'only one appeal at a time');
  r = await call('GET', '/api/admin/review?filter=appeals', rv); const ap = r.d.items.find((i) => i.id === A); log(!!ap && ap.kind === 'APPEAL' && /client logo/.test(ap.orgBlockReason) && /blurred/.test(ap.appealNote), 'the appeal shows both sides in the inbox');
  r = await call('POST', `/api/admin/review/appeals/${A}`, rv, { action: 'uphold' }); log(r.s === 400, 'deciding an appeal needs a reason');
  r = await call('POST', `/api/admin/review/appeals/${A}`, rv, { action: 'uphold', note: 'The logo is still recognisable. The organization is right.' }); log(r.s === 200, 'a reviewer keeps the hold');
  p = await page(A); log(p.s === 404, 'the post stays hidden');
  r = await call('POST', `/api/posts/${A}/appeal`, t0, { note: 'Appealing again after it was kept.' }); log(r.s === 409, 'the same hold cannot be appealed twice');
  r = await call('POST', `/api/org/posts/${A}`, org, { action: 'unblock' }); log(r.s === 200, 'the organization can change its mind');
  p = await page(A); log(p.s === 200, 'and the post is public again');
  await call('POST', `/api/org/posts/${A}`, org, { action: 'block', reason: 'Second hold for a different reason.' });
  r = await call('POST', `/api/posts/${A}/appeal`, t0, { note: 'This second hold is mistaken, see the post.' }); log(r.s === 200, 'a new hold can be appealed');
  r = await call('POST', `/api/admin/review/appeals/${A}`, rv, { action: 'lift', note: 'The organization agrees this is fine on reflection.' }); log(r.s === 200, 'a reviewer lifts the hold');
  p = await page(A); log(p.s === 200, 'the post is public again');
  log(Number(psql(`select count(*) from "PostReview" where "postId"='${A}' and action in ('ORG_BLOCKED','APPEAL_SENT','APPEAL_UPHELD','ORG_UNBLOCKED','APPEAL_LIFTED')`)) >= 7, 'the history keeps every hold, appeal and decision');
  // taking away reviewer access
  r = await call('PATCH', `/api/admin/staff/${staffId}`, sa, { canReview: false }); r = await call('GET', '/api/admin/review', rv); log(r.s === 403, 'removing reviewer access takes effect at once');
  cleanup();
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
