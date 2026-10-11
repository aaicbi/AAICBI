const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const call = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const t0 = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const t1 = jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test'));
  const cleanup = () => psql(`delete from "Post" where "legacyEducationPostId" is null; update "Trainee" set "profileVisibility"='PRIVATE' where email='t0@dev.test'`);
  cleanup();
  let pv = await call('POST', '/api/follow', jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test')), { profileId: psql(`select p.id from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t0@dev.test'`) }); log(pv.s === 404, 'a private profile cannot be followed (hidden = missing)');
  psql(`update "Trainee" set "profileVisibility"='PUBLIC' where email='t0@dev.test'`);
  const h0 = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t0@dev.test'`);
  const p1 = psql(`select p.id from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t1@dev.test'`);
  const p0 = psql(`select p.id from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t0@dev.test'`);
  psql(`delete from "Follow" where "followerProfileId" in ('${p0}','${p1}')`);
  let r = await call('POST', '/api/posts', t0, { body: 'Hello #lms community, see https://example.com <b>x</b>', submit: true }); const A = r.d.id;
  await call('POST', `/api/admin/review/posts/${A}`, sa, { action: 'approve' });
  r = await call('POST', '/api/posts', t1, { body: 'Draft only', submit: false });
  // reading without an account
  r = await call('GET', '/api/feed', null); log(r.s === 200 && r.d.posts.some((p) => p.id === A), 'a visitor can read the feed');
  r = await call('GET', '/feed', null); log(r.s === 200 && /Create an account/.test(r.t), 'the feed page loads for a visitor with a join prompt');
  log(!r.t.includes('<b>x</b>'), 'post text never inserts raw HTML');
  // the gate
  for (const [m, p, b] of [['POST', `/api/posts/${A}/react`, { kind: 'LIKE' }], ['POST', `/api/posts/${A}/comments`, { body: 'hi' }], ['PUT', `/api/posts/${A}/bookmark`], ['POST', `/api/posts/${A}/report`, { reason: 'SPAM' }], ['POST', '/api/follow', { profileId: p0 }]]) { const x = await call(m, p, null, b); log(x.s === 401, `a visitor is asked to sign in for ${m} ${p.replace(A, ':id')}`); }
  r = await call('GET', '/api/feed?tab=following', null); log(r.s === 401, 'following tab asks a visitor to sign in');
  // reactions: one per profile
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: 'LIKE' }); log(r.s === 200, 'react');
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: 'INSIGHTFUL' });
  log(Number(psql(`select count(*) from "PostReaction" where "postId"='${A}'`)) === 1, 'a profile has only one reaction per post');
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: 'BAD' }); log(r.s === 400, 'unknown reaction rejected');
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: null }); log(Number(psql(`select count(*) from "PostReaction" where "postId"='${A}'`)) === 0, 'reaction can be removed');
  // comments
  r = await call('POST', `/api/posts/${A}/comments`, t1, { body: 'Great post' }); const C = r.d.id || r.d.comment?.id; log(r.s === 201 || r.s === 200, 'comment');
  r = await call('POST', `/api/posts/${A}/comments`, t0, { body: 'Thanks!', parentId: C }); const C2 = r.d.id || r.d.comment?.id; log(r.s < 300, 'reply');
  r = await call('POST', `/api/posts/${A}/comments`, t1, { body: 'nested', parentId: C2 }); log(r.s === 201 && psql(`select count(*) from "PostComment" where "parentId" is not null and "parentId" not in (select id from "PostComment" where "parentId" is null)`) === '0', 'a reply to a reply attaches to the top comment (one level)');
  r = await call('POST', `/api/posts/${A}/comments`, t1, { body: 'a http://a.com http://b.com http://c.com' }); log(r.s === 400, 'more than two links in a comment rejected');
  r = await call('GET', `/api/posts/${A}/comments`, null); log(r.s === 200, 'comments are readable by a visitor');
  r = await call('DELETE', `/api/comments/${C}`, t0); log(r.s === 200 || r.s === 204, 'the post author can remove a comment on their post');
  // follows
  r = await call('POST', '/api/follow', t1, { profileId: p0 }); log(r.s < 300, 'follow');
  r = await call('POST', '/api/follow', t1, { profileId: p0 });
  log(Number(psql(`select count(*) from "Follow" where "followerProfileId"='${p1}' and "followedProfileId"='${p0}'`)) === 1, 'following twice is one follow');
  r = await call('POST', '/api/follow', t1, { profileId: p1 }); log(r.s === 400, 'cannot follow yourself');
  r = await call('GET', '/api/feed?tab=following', t1); log(r.d.posts.some((p) => p.id === A), 'following tab shows followed posts');
  r = await call('GET', `/api/profiles/followers?handle=${h0}`, null); log(r.s === 401, 'follower list is signed-in only');
  r = await call('GET', `/api/profiles/followers?handle=${h0}`, t1); log(r.s === 200 && r.d.people.length === 1, 'signed in sees followers');
  r = await call('GET', `/@${h0}`, null); log(r.s === 200 && />1<\/span> follower/.test(r.t), 'follower count is public');
  // bookmarks, reports
  r = await call('PUT', `/api/posts/${A}/bookmark`, t1); log(r.s < 300, 'save');
  r = await call('GET', '/saved', t1); log(r.s === 200 && /Hello/.test(r.t), 'saved page lists it');
  r = await call('POST', `/api/posts/${A}/report`, t1, { reason: 'SPAM', details: 'looks like spam' }); log(r.s < 300, 'report');
  r = await call('GET', '/api/admin/review?filter=reports', sa); const rep = (r.d.items || []).find((i) => i.kind === 'REPORT'); log(!!rep, 'the report reaches the review inbox');
  if (rep) { r = await call('POST', `/api/admin/review/reports/${rep.id}`, sa, { action: 'dismiss', note: 'Not a violation.' }); log(r.s === 200, 'a reviewer dismisses a report'); }
  // tags, search
  r = await call('GET', '/api/feed?tag=lms', null); log(r.d.posts.some((p) => p.id === A), 'tag filter');
  r = await call('GET', '/tags/lms', null); log(r.s === 200, 'tag page');
  r = await call('GET', '/search?q=Hello', null); log(r.s === 200 && /Hello/.test(r.t), 'search finds posts');
  // hidden = missing
  psql(`update "Post" set status='SUSPENDED' where id='${A}'`);
  r = await call('GET', '/api/feed', null); log(!r.d.posts.some((p) => p.id === A), 'suspended post leaves the feed');
  r = await call('GET', '/search?q=Hello', null); log(!/Hello #lms/.test(r.t), 'and search');
  cleanup();
})().catch((e) => { console.error(e); process.exit(1); });
