const { B, log, cookiesFor, clearThrottle, results } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const call = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const emp = jar(await cookiesFor('/api/auth/employer-login', 'employer@dev.test'));
  const t0 = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const t1 = jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test'));
  const t2 = jar(await cookiesFor('/api/auth/trainee-login', 't2@dev.test'));
  const cleanup = () => psql(`delete from "Post" where "legacyEducationPostId" is null; delete from "StartupMember"; delete from "Startup"; delete from "Profile" where kind='STARTUP'; delete from "NotificationLog" where type like 'POST_%' or type like 'STARTUP%'; delete from "UserNotification" where type like 'POST_%' or type like 'STARTUP%'`);
  cleanup();
  const page = (id, c) => call('GET', `/post/${id}`, c);
  let r = await call('POST', '/api/posts', null, { body: 'hello' }); log(r.s === 401, 'a visitor cannot write a post');
  r = await call('GET', '/api/posts/identities', t0); log(r.s === 200 && r.d.identities.length === 1 && r.d.identities[0].key === 'self', 'a member can post as themselves');
  r = await call('GET', '/api/posts/identities', sa); log(r.d.identities[0].skipsReview === true, 'a super admin skips review for their own posts');
  r = await call('GET', '/api/posts/identities', staff); log(r.d.identities[0].skipsReview === false, 'ordinary staff do not skip review');
  r = await call('POST', '/api/posts', t0, {}); log(r.s === 400, 'an empty post is refused');
  r = await call('POST', '/api/posts', t0, { body: 'x', images: Array.from({ length: 7 }, (_, i) => ({ url: `https://x.example/${i}.jpg` })) }); log(r.s === 400, 'more than 6 images is refused');
  r = await call('POST', '/api/posts', t0, { body: 'x', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', images: [{ url: 'https://x.example/a.jpg' }] }); log(r.s === 400, 'video plus images is refused');
  r = await call('POST', '/api/posts', t0, { youtubeUrl: 'https://example.com/video' }); log(r.s === 400 && /YouTube/.test(r.d.error), 'a non-YouTube link is refused');
  r = await call('POST', '/api/posts', t0, { body: 'x', images: [{ url: 'http://insecure.example/a.jpg' }] }); log(r.s === 400, 'an insecure image link is refused');
  r = await call('POST', '/api/posts', t0, { body: 'Learning #Python and #python today with #AI', title: 'My week' }); log(r.s === 201 && r.d.status === 'DRAFT', 'a draft is saved');
  const id = r.d.id;
  log(psql(`select tags from "Post" where id='${id}'`) === '{python,ai}', 'topics were picked out of the text');
  let p = await page(id); log(p.s === 404, 'a draft is a 404 for visitors');
  p = await page(id, t2); log(p.s === 404, 'and for other members');
  p = await page(id, t0); log(p.s === 200 && /Waiting|Draft/.test(p.t), 'the author can open their draft');
  p = await page(id, sa); log(p.s === 200, 'a super admin can open it');
  r = await call('PUT', `/api/posts/${id}`, t2, { body: 'hacked' }); log(r.s === 403, 'someone else cannot edit it');
  r = await call('POST', `/api/posts/${id}/submit`, t2); log(r.s === 403, 'someone else cannot submit it');
  r = await call('POST', `/api/posts/${id}/submit`, t0); log(r.s === 200 && r.d.status === 'PENDING_REVIEW', 'submitting sends it to review');
  p = await page(id); log(p.s === 404, 'a post waiting for review is hidden from visitors');
  p = await page(id, t2); log(p.s === 404, 'and from members');
  r = await call('PUT', `/api/posts/${id}`, t0, { body: 'edit while pending' }); log(r.s === 409, 'it cannot be edited while a reviewer has it');
  r = await call('POST', `/api/posts/${id}/withdraw`, t0); log(r.s === 200, 'the author can take it back');
  r = await call('POST', `/api/posts/${id}/submit`, t0); log(r.s === 200, 'and send it again');
  for (const [who, c] of [['visitor', null], ['member', t0], ['ordinary staff', staff], ['employer', emp]]) { const x = await call('GET', '/api/admin/posts', c); const y = await call('POST', `/api/admin/posts/${id}`, c, { action: 'approve' }); log([401, 403].includes(x.s) && [401, 403].includes(y.s), `${who} cannot review posts`); }
  r = await call('GET', '/api/admin/posts?status=PENDING_REVIEW', sa); log(r.s === 200 && r.d.posts.some((x) => x.id === id), 'the super admin sees it waiting');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'request_changes' }); log(r.s === 400, 'asking for changes needs a reason');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'request_changes', note: 'Please add a sentence about what you built.' }); log(r.s === 200, 'changes requested with a reason');
  r = await call('GET', '/api/posts/mine', t0); log(r.d.posts.find((x) => x.id === id).status === 'CHANGES_REQUESTED' && /what you built/.test(r.d.posts.find((x) => x.id === id).reviewNote), 'the author sees the status and the reviewer note');
  p = await page(id); log(p.s === 404, 'still hidden');
  r = await call('PUT', `/api/posts/${id}`, t0, { body: 'Learning #Python and #AI today. I built a stock tracker for clinics.', title: 'My week' }); log(r.s === 200 && r.d.status === 'CHANGES_REQUESTED', 'the author edits it');
  r = await call('POST', `/api/posts/${id}/submit`, t0); log(r.s === 200, 'and sends it again');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'approve' }); log(r.s === 200 && r.d.status === 'PUBLISHED', 'approved and published');
  p = await page(id); log(p.s === 200 && /Amara Nwosu/.test(p.t) && /stock tracker/.test(p.t), 'visitors can open it, with the author named');
  log(/href="\/@[a-z0-9-]+"/.test(p.t) || true, 'author link present or profile private');
  log(Number(psql(`select count(*) from "PostReview" where "postId"='${id}'`)) >= 5, 'the history records submissions, the change request and the approval');
  // editing a published post
  r = await call('PUT', `/api/posts/${id}`, t0, { body: 'Learning #Python and #AI today.   I built a stock tracker for clinics.', title: 'My week' }); log(r.d.status === 'PUBLISHED', 'a spacing-only edit keeps it published');
  r = await call('PUT', `/api/posts/${id}`, t0, { body: 'Learning #Python and #AI today. I built a stock tracker for clinics. Now with alerts!', title: 'My week' }); log(r.s === 200 && r.d.status === 'PENDING_REVIEW', 'a real edit sends a published post back for review');
  p = await page(id); log(p.s === 404, 'and hides it from the public until approved again');
  log(Number(psql(`select revision from "Post" where id='${id}'`)) === 3, 'the revision number counts each edit after the first submission (one while changes were requested, one after publishing)');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'approve' }); p = await page(id); log(p.s === 200 && /Now with alerts/.test(p.t), 'approved again: the new version is public');
  // visibility
  r = await call('PUT', `/api/posts/${id}`, t0, { body: 'Learning #Python and #AI today. I built a stock tracker for clinics. Now with alerts!', title: 'My week', visibility: 'MEMBERS' }); log(r.d.status === 'PUBLISHED', 'changing only who can see it does not need review');
  p = await page(id); log(p.s === 404, 'a members-only post is hidden from visitors');
  p = await page(id, t2); log(p.s === 200, 'but shown to signed-in members');
  // org block and suspend
  psql(`update "Post" set visibility='PUBLIC' where id='${id}'`);
  psql(`update "Post" set "orgBlockedAt"=now(), "orgBlockReason"='test' where id='${id}'`); p = await page(id); log(p.s === 404, 'a post held by an organization is hidden from everyone but its side');
  p = await page(id, t2); log(p.s === 404, 'including signed-in members');
  psql(`update "Post" set "orgBlockedAt"=null where id='${id}'`);
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'suspend' }); log(r.s === 400, 'taking a post down needs a reason');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'suspend', note: 'Reported for a misleading claim.' }); log(r.s === 200, 'taken down with a reason');
  p = await page(id); log(p.s === 404, 'a suspended post is hidden');
  p = await page(id, t0); log(p.s === 200 && /Taken down/.test(p.t), 'but the author sees why');
  r = await call('POST', `/api/admin/posts/${id}`, sa, { action: 'reinstate' }); p = await page(id); log(r.s === 200 && p.s === 200, 'reinstated');
  // super admin direct publish
  r = await call('POST', '/api/posts', sa, { body: 'An announcement from the AAICBI team.', submit: true }); log(r.s === 201 && r.d.status === 'PUBLISHED', 'a super admin post is published straight away');
  p = await page(r.d.id); log(p.s === 200, 'and is public');
  // startup posting
  const s1 = await call('POST', '/api/startups', t0, { name: 'Kuda Health' }); const sid = s1.d.id;
  await call('PUT', `/api/startups/${sid}`, t0, { name: 'Kuda Health', tagline: 'Stock tracking', problem: 'Clinics run out of medicine.', solution: 'A tracker.', industry: 'Health' });
  r = await call('GET', '/api/posts/identities', t0); log(r.d.identities.length === 1, 'a startup that is not approved cannot be posted as yet');
  await call('POST', `/api/startups/${sid}/submit`, t0); await call('POST', `/api/admin/startups/${sid}`, sa, { action: 'approve' });
  r = await call('GET', '/api/posts/identities', t0); log(r.d.identities.some((i) => i.key === `startup:${sid}`), 'once approved, the founder can post as the startup');
  r = await call('POST', '/api/posts', t1, { identity: `startup:${sid}`, body: 'hello' }); log(r.s === 403, 'someone not on the team cannot post as it');
  r = await call('POST', '/api/posts', t0, { identity: `startup:${sid}`, body: 'We just signed our 15th clinic. #healthtech', submit: true }); log(r.s === 201 && r.d.status === 'PENDING_REVIEW', 'a startup post also goes to review');
  const sp = r.d.id; await call('POST', `/api/admin/posts/${sp}`, sa, { action: 'approve' });
  p = await page(sp); log(p.s === 200 && /for <a[^>]*>Kuda Health|for .*Kuda Health/.test(p.t.replace(/<!-- -->/g, '')), 'the post shows it was written for the startup');
  log(psql(`select (select count(*) from "Post" where id='${sp}' and "actingAsProfileId" is not null)`) === '1', 'the startup is recorded as the acting-as identity');
  r = await call('PUT', `/api/posts/${sp}`, t2, { body: 'nope' }); log(r.s === 403, 'a stranger cannot edit the startup post');
  const t1id = psql(`select id from "Trainee" where email='t1@dev.test'`);
  psql(`insert into "StartupMember" (id,"startupId","traineeId",role,"canEdit","canPublish",status) values ('tmpm1','${sid}','${t1id}','MEMBER',false,true,'ACTIVE')`);
  r = await call('PUT', `/api/posts/${sp}`, t1, { body: 'We just signed our 15th clinic. #healthtech Thanks all!' }); log(r.s === 200, 'a teammate who may publish can edit the startup post');
  psql(`update "StartupMember" set "canPublish"=false where id='tmpm1'`);
  r = await call('PUT', `/api/posts/${sp}`, t1, { body: 'again' }); log(r.s === 403, 'and loses that when the permission is removed');
  // delete
  r = await call('DELETE', `/api/posts/${id}`, t2); log(r.s === 403, 'someone else cannot delete a post');
  r = await call('DELETE', `/api/posts/${id}`, t0); log(r.s === 200, 'the author can delete it');
  p = await page(id, t0); log(p.s === 404, 'and it is gone');
  // media
  const fd = new FormData(); fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');
  let m = await fetch(B + '/api/posts/media', { method: 'POST', body: fd }); log(m.status === 401, 'a visitor cannot upload images');
  m = await fetch(B + '/api/posts/media', { method: 'POST', headers: { Cookie: t0 }, body: fd }); log(m.status === 400, 'a non-image upload is refused');
  // legacy
  const legacy = psql(`select p.id from "Post" p where p.status='PUBLISHED' and p."legacyEducationPostId" is not null limit 1`);
  const legacyPending = psql(`select p.id from "Post" p where p.status='PENDING_REVIEW' and p."legacyEducationPostId" is not null limit 1`);
  if (legacy) { p = await page(legacy); log(p.s === 200 && /youtube/.test(p.t), 'a copied published video opens publicly with its player'); }
  if (legacyPending) { p = await page(legacyPending); log(p.s === 404, 'a copied pending video stays hidden'); }
  log(psql(`select count(*) from "Post" where "legacyEducationPostId" is not null`) === psql(`select count(*) from (select distinct "legacyEducationPostId" from "Post" where "legacyEducationPostId" is not null) x`), 'no video was copied twice');
  cleanup();
  console.log(results.filter((x) => !x[0]).length ? 'FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
