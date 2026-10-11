const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const call = async (m, p, c, b) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...(c ? { Cookie: c } : {}) }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t }; };
(async () => {
  clearThrottle();
  psql(`delete from "Post" where body like 'ARCHECK%' or "legacyProjectId" like 'arp%'`);
  psql(`delete from "Project" where id like 'arp%'`);
  const c = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const ownerId = psql(`select id from "Trainee" where email='t0@dev.test'`);
  const profile = psql(`select id from "Profile" where "traineeId"='${ownerId}'`);
  psql(`delete from "Post" where "authorProfileId"='${profile}' and "legacyEducationPostId" is null`);
  // a new member: a clean post is checked and published at once
  let r = await call('POST', '/api/posts', c, { body: 'ARCHECK clean post about my first Python project #python', submit: true });
  log(r.s === 201 && r.d.status === 'PUBLISHED', `a clean post from a new member is published at once (${r.d && r.d.status})`);
  const by = psql(`select "actorName" from "PostReview" where "postId"='${r.d.id}' order by "createdAt" desc limit 1`);
  log(by === 'Auto-review', `its history says it was published by Auto-review (${by})`);
  // concerns go to a person
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK Guaranteed returns! Double your money, send money to me', submit: true });
  log(r.s === 201 && r.d.status === 'PENDING_REVIEW', `a scam-like post waits for a person (${r.d && r.d.status})`);
  const why = psql(`select note from "PostReview" where "postId"='${r.d.id}' and action='SUBMITTED'`);
  log(/scam/i.test(why), `the reviewer is told why (${why.slice(0, 60)}…)`);
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK Contact me on a@b.com or +234 801 234 5678 about the workshop', submit: true });
  log(r.d.status === 'PENDING_REVIEW', `a new member sharing an email and phone number waits for a person (${r.d.status})`);
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK clean post about my first Python project #python', submit: true });
  log(r.d.status === 'PENDING_REVIEW', `the same post again is held as a duplicate (${r.d.status})`);
  // a trusted author: 3 published, nothing taken down
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK second clean post about SQL joins', submit: true });
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK third clean post about data cleaning', submit: true });
  psql(`update "Post" set status='DRAFT' where "authorProfileId"='${profile}' and status in ('PENDING_REVIEW')`);
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK trusted author: reach me on kufreh@example.com to join the workshop', submit: true });
  log(r.d.status === 'PUBLISHED', `a trusted author sharing an email publishes instantly (${r.d.status})`);
  r = await call('POST', '/api/posts', c, { body: 'ARCHECK You are a stupid idiot', submit: true });
  log(r.d.status === 'PENDING_REVIEW', `even a trusted author is held for abuse (${r.d.status})`);
  // on the public home page
  r = await fetch(B + '/'); const t = await r.text();
  log(/ARCHECK clean post about my first Python project/.test(t), 'the auto-published post is on the public home page');
  log(!/send money to me/.test(t), 'the held post is not');
  // showcase: a listed project is checked, approved and mirrored into the feed
  psql(`insert into "Project"(id,"traineeId",title,description,"listedInShowcase","showcaseStatus") values ('arp1','${ownerId}','ARCHECK Showcase Alpha','A small tool that tidies spreadsheets',false,'PENDING_REVIEW')`);
  r = await call('PATCH', '/api/trainee/projects/arp1', c, { title: 'ARCHECK Showcase Alpha', description: 'A small tool that tidies spreadsheets', listedInShowcase: true });
  const st = psql(`select "showcaseStatus" from "Project" where id='arp1'`);
  log(r.s === 200 && st === 'APPROVED', `a clean showcase project is approved by Auto-review (${st})`);
  const mirror = psql(`select status from "Post" where "legacyProjectId"='arp1'`);
  log(mirror === 'PUBLISHED', `and appears as a post in the feed (${mirror})`);
  r = await fetch(B + '/'); const t2 = await r.text();
  log(/ARCHECK Showcase Alpha/.test(t2), 'the showcase project is on the home feed');
  r = await call('PATCH', '/api/trainee/projects/arp1', c, { title: 'ARCHECK Showcase Alpha', description: 'A small tool that tidies spreadsheets', listedInShowcase: false });
  const hid = psql(`select status from "Post" where "legacyProjectId"='arp1'`);
  log(hid === 'SUSPENDED', `taken out of the showcase, its post comes down (${hid})`);
  psql(`insert into "Project"(id,"traineeId",title,description,"listedInShowcase","showcaseStatus") values ('arp2','${ownerId}','ARCHECK Showcase Beta','Guaranteed returns, double your money',false,'PENDING_REVIEW')`);
  r = await call('PATCH', '/api/trainee/projects/arp2', c, { title: 'ARCHECK Showcase Beta', description: 'Guaranteed returns, double your money', listedInShowcase: true });
  log(psql(`select "showcaseStatus" from "Project" where id='arp2'`) === 'PENDING_REVIEW' && psql(`select count(*) from "Post" where "legacyProjectId"='arp2'`) === '0', 'a risky showcase project waits for a person and is not in the feed');
  psql(`delete from "Post" where body like 'ARCHECK%' or title like 'ARCHECK%'`);
  psql(`delete from "Project" where id like 'arp%'`);
})().catch((e) => { console.error(e); process.exit(1); });
