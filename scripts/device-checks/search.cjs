const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const get = async (p, cookie) => { const r = await fetch(B + p, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, t, d }; };
const text = (h) => h.replace(/<!-- -->/g, '');
const EMP = (psql(`select id from "Employer" where email='employer@dev.test'`));
const SK = 'srchskill', NOW = `now()`;
const cleanup = () => psql(`
 delete from "JobPostingSkill" where "jobPostingId" like 'srchjob%'; delete from "JobPosting" where id like 'srchjob%';
 delete from "TraineeSkill" where "skillId"='${SK}'; delete from "Skill" where id='${SK}';
 delete from "PostComment" where id like 'srchc%'; delete from "Post" where "legacyEducationPostId" is null;
 delete from "Profile" where "startupId" like 'srchst%'; delete from "StartupMember" where "startupId" like 'srchst%'; delete from "Startup" where id like 'srchst%';
 update "Trainee" set "profileVisibility"='PRIVATE', location=null where email in ('t3@dev.test','t4@dev.test');
 update "Employer" set "profileVisibility"='AUTHENTICATED' where email='employer@dev.test'`);
(async () => {
  clearThrottle(); cleanup();
  psql(`update "Investor" set "passwordHash"=(select "passwordHash" from "Trainee" where email='t0@dev.test') where email='demo-investor@demo.aaicbi.invalid'`);
  // ---- seed: skill, two trainees (one public), startups (one approved, one draft), employer, jobs, posts
  psql(`insert into "Skill" (id,name) values ('${SK}','Zorbtest')`);
  psql(`update "Trainee" set "profileVisibility"='PUBLIC', location='Lagos', "emailVerified"=true where email='t3@dev.test'; update "Trainee" set "profileVisibility"='PRIVATE', location='Lagos' where email='t4@dev.test'`);
  for (const e of ['t3@dev.test', 't4@dev.test']) psql(`insert into "TraineeSkill" (id,"traineeId","skillId") select 'srchts-'||t.id, t.id, '${SK}' from "Trainee" t where t.email='${e}'`);
  const t3name = psql(`select name from "Trainee" where email='t3@dev.test'`), t4name = psql(`select name from "Trainee" where email='t4@dev.test'`);
  const t3handle = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t3@dev.test'`);
  const founder = psql(`select id from "Trainee" where email='t0@dev.test'`);
  psql(`insert into "Startup" (id,name,tagline,industry,stage,location,status,"createdById","updatedAt") values ('srchst1','Quillfarm Labs','Grows quills','Agriculture','MVP','Kano','APPROVED','${founder}',now()), ('srchst2','Quillhidden Draft','Hidden quills','Agriculture','IDEA','Kano','DRAFT','${founder}',now())`);
  psql(`insert into "Profile" (id,handle,kind,"startupId","updatedAt") values ('srchp1','quillfarm-labs','STARTUP','srchst1',now()), ('srchp2','quillhidden','STARTUP','srchst2',now())`);
  const job = (id, title, status, days, mins) => psql(`insert into "JobPosting" (id,"employerId",title,description,"closingDate",status,"createdAt") values ('${id}','${EMP}','${title}','Work on ${title} things', ${days > 0 ? `now() + interval '${days} days'` : `now() - interval '3 days'`}, '${status}', now() - interval '${mins} minutes')`);
  job('srchjob-a', 'Zorbtest Analyst', 'APPROVED', 10, 30); job('srchjob-b', 'Senior role using zorbtest daily', 'APPROVED', 10, 5);
  job('srchjob-p', 'Zorbtest Pending Role', 'PENDING_REVIEW', 10, 5); job('srchjob-x', 'Zorbtest Expired Role', 'APPROVED', 0, 5);
  for (const j of ['srchjob-a', 'srchjob-b', 'srchjob-p']) psql(`insert into "JobPostingSkill" (id,"jobPostingId","skillId") values ('srchjs-${j}','${j}','${SK}')`);
  for (let i = 1; i <= 14; i++) job(`srchjob-pg${String(i).padStart(2, '0')}`, `Pagerjob ${i}`, 'APPROVED', 10, 100 + i);
  // posts
  const sa = (await cookiesFor('/api/auth/login', 'super@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  const t0c = (await cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  const post = async (c, body) => (await fetch(B + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: c }, body: JSON.stringify({ body, submit: true }) }).then((r) => r.json())).id;
  const pubId = await post(sa, 'A published searchmarker post about zorbtest'); const pendId = await post(t0c, 'A pending searchmarker post waiting');
  // ---- every kind answers for a visitor
  for (const k of ['all', 'people', 'organizations', 'employers', 'investors', 'startups', 'jobs', 'programs', 'posts', 'comments', 'videos', 'events']) { const r = await get(`/search?kind=${k}&q=zorbtest`); log(r.s === 200, `kind=${k} answers`); }
  // ---- people: name, skill, location, filters; the private one never appears
  let r = await get(`/search?kind=people&q=${encodeURIComponent(t3name.split(' ')[0])}`); log(text(r.t).includes(t3name), 'people: found by name');
  r = await get('/search?kind=people&q=zorbtest'); log(text(r.t).includes(t3name) && !text(r.t).includes(t4name), 'people: found by skill, and the private profile is not found');
  r = await get('/search?kind=people&skill=zorbtest'); log(text(r.t).includes(t3name) && !text(r.t).includes(t4name), 'people: a filter alone works (skill)');
  r = await get('/search?kind=people&skill=zorbtest&location=lagos'); log(text(r.t).includes(t3name), 'people: skill and location together');
  r = await get('/search?kind=people&skill=zorbtest&location=nairobi'); log(!text(r.t).includes(t3name) && /No result matches all of the filters|Nothing found|Nothing here/.test(text(r.t)), 'people: a location that does not match removes them, with guidance');
  log(/Zorbtest/.test(text((await get('/search?kind=people&q=zorbtest')).t)) && /View profile/.test(text((await get('/search?kind=people&q=zorbtest')).t)), 'people: the result shows skills and a way to the profile');
  const sig = await cookiesFor('/api/auth/trainee-login', 't1@dev.test'); r = await get('/search?kind=people&q=zorbtest', sig.map((c) => `${c.name}=${c.value}`).join('; ')); log(!text(r.t).includes(t4name), 'people: a private member is not found through their private skill, even when signed in');
  // ---- startups
  r = await get('/search?kind=startups&q=quillfarm'); log(text(r.t).includes('Quillfarm Labs'), 'startups: an approved one is found by name');
  r = await get('/search?kind=startups&q=quill'); log(text(r.t).includes('Quillfarm Labs') && !text(r.t).includes('Quillhidden'), 'startups: a draft is never found');
  r = await get('/search?kind=startups&industry=Agriculture&location=kano'); log(text(r.t).includes('Quillfarm Labs'), 'startups: industry and location filters');
  r = await get('/search?kind=startups&industry=Health'); log(!text(r.t).includes('Quillfarm Labs'), 'startups: another industry excludes it');
  r = await get('/search?q=quillfarm'); log(text(r.t).includes('Quillfarm Labs'), 'all: a startup shows in the overall results');
  // ---- employers: public/authenticated visibility
  const empName = psql(`select "companyName" from "Employer" where email='employer@dev.test'`); const empHandle = psql(`select p.handle from "Profile" p join "Employer" e on e.id=p."employerId" where e.email='employer@dev.test'`); const link = (h, handle) => new RegExp(`href="/@${handle}"`).test(h);
  r = await get(`/search?kind=employers&q=${encodeURIComponent(empName)}`); 
  const asAuth = (await get(`/search?kind=employers&q=${encodeURIComponent(empName)}`, t0c)); log(link(asAuth.t, empHandle), 'employers: a signed-in person finds an employer who chose "members only"');
  log(link(r.t, empHandle), 'employers: a visitor finds the company by name too (its page shows only the name when it keeps the rest private)');
  psql(`update "Employer" set "profileVisibility"='PUBLIC' where email='employer@dev.test'`); r = await get(`/search?kind=employers&q=${encodeURIComponent(empName)}`); log(link(r.t, empHandle), 'employers: a visitor finds one who chose public');
  psql(`update "Employer" set "profileVisibility"='PRIVATE' where email='employer@dev.test'`); r = await get(`/search?kind=employers&q=${encodeURIComponent(empName)}`, t0c); log(link(r.t, empHandle), 'employers: a private one is still found by company name, and shows nothing more');
  // ---- investors: not public yet
  const invName = psql(`select name from "Investor" where email='demo-investor@demo.aaicbi.invalid'`); const invHandle = psql(`select p.handle from "Profile" p join "Investor" i on i.id=p."investorId" where i.email='demo-investor@demo.aaicbi.invalid'`);
  r = await get(`/search?kind=investors&q=${encodeURIComponent(invName)}`); log(!link(r.t, invHandle) && /not public yet/.test(text(r.t)), 'investors: invisible to a visitor, and the page says why');
  const invc = (await cookiesFor('/api/auth/investor-login', 'demo-investor@demo.aaicbi.invalid')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await get(`/search?kind=investors&q=${encodeURIComponent(invName)}`, invc); log(link(r.t, invHandle), 'investors: the investor can find themselves');
  r = await get(`/search?kind=investors&q=${encodeURIComponent(invName)}`, t0c); log(!link(r.t, invHandle), 'investors: other members cannot find them');
  // ---- jobs
  r = await get('/search?kind=jobs&q=zorbtest'); const jt = text(r.t);
  log(jt.includes('Zorbtest Analyst') && jt.includes('Senior role using zorbtest daily'), 'jobs: open jobs found by words in the title');
  log(!jt.includes('Zorbtest Pending Role') && !jt.includes('Zorbtest Expired Role'), 'jobs: a pending and an expired posting are never found');
  r = await get('/search?kind=jobs&skill=zorbtest'); log(text(r.t).includes('Zorbtest Analyst') && !text(r.t).includes('Pending Role'), 'jobs: filter by skill');
  r = await get('/search?kind=jobs&q=zorbtest&sort=relevance'); let t = text(r.t); log(t.indexOf('Zorbtest Analyst') < t.indexOf('Senior role using zorbtest'), 'jobs: best match first (the title that starts with the word)');
  r = await get('/search?kind=jobs&q=zorbtest&sort=recent'); t = text(r.t); log(t.indexOf('Senior role using zorbtest') < t.indexOf('Zorbtest Analyst'), 'jobs: newest first when asked');
  r = await get('/search?kind=jobs&q=Pagerjob'); log(/rel="next"/.test(r.t) && !/rel="prev"/.test(r.t) && text(r.t).includes('Pagerjob 1') , 'jobs: a long list has a Next link on page 1');
  const r2 = await get('/search?kind=jobs&q=Pagerjob&page=2'); log(/rel="prev"/.test(r2.t) && !/rel="next"/.test(r2.t), 'jobs: page 2 has Previous and, being the last, no Next');
  const uniq = (h) => new Set(h.match(/href="\/jobs\/srchjob-pg\d+"/g) || []).size; const n1 = uniq(r.t), n2 = uniq(r2.t); log(n1 === 12 && n2 === 2, `jobs: 12 on page 1, the other 2 on page 2 (${n1}, ${n2})`);
  r = await get('/search?kind=jobs'); log(r.s === 200 && /View job/.test(r.t), 'jobs: choosing the kind with no words lists the newest');
  // ---- posts
  r = await get('/search?kind=posts&q=searchmarker'); log(text(r.t).includes('published searchmarker') && !text(r.t).includes('pending searchmarker'), 'posts: a published post is found and a pending one is not');
  r = await get('/search?kind=posts&q=searchmarker&type=IMAGE'); log(!text(r.t).includes('published searchmarker'), 'posts: the type filter narrows (no image posts here)');
  r = await get('/search?kind=posts&q=searchmarker&type=TEXT'); log(text(r.t).includes('published searchmarker'), 'posts: text posts only');
  // ---- suggestions
  r = await get('/api/search/suggest?q=zorb'); log(r.s === 200 && r.d.items.some((i) => i.kind === 'skill') && r.d.items.some((i) => i.kind === 'job'), 'suggest: skills and open jobs');
  log(!JSON.stringify(r.d).match(/@dev\.test|passwordHash|email/i) && r.d.items.every((i) => Object.keys(i).sort().join() === 'href,kind,label,sub'), 'suggest: only label, kind, sub and address come back');
  r = await get('/api/search/suggest?q=quillf'); log(r.d.items.some((i) => i.label === 'Quillfarm Labs' && i.href === '/@quillfarm-labs') && !JSON.stringify(r.d).includes('Quillhidden'), 'suggest: an approved startup, never a draft');
  r = await get(`/api/search/suggest?q=${encodeURIComponent(t3name.slice(0, 4))}`); log(r.d.items.some((i) => i.label === t4name && !/Lagos/.test(i.sub || '')), 'suggest: a member who keeps their profile private is found by name, and no private detail comes with it');
  r = await get('/api/search/suggest?q=z'); log(r.s === 200 && r.d.items.length === 0, 'suggest: one letter gives nothing');
  const t0 = Date.now(); await get('/api/search/suggest?q=data'); log(Date.now() - t0 < 1500, `suggest: answers quickly (${Date.now() - t0} ms)`);
  // ---- everyone who joined can be found by name; private details stay private
  r = await get(`/search?kind=people&q=${encodeURIComponent(t4name)}`); const t4handle = psql(`select p.handle from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t4@dev.test'`);
  log(link(r.t, t4handle) && text(r.t).includes(t4name), 'people: a member who keeps their profile private is found by name');
  log(!/Lagos|Zorbtest/.test(text(r.t).split(t4name)[1]?.slice(0, 600) ?? ''), 'people: and their place and skills are not shown');
  r = await get(`/@${t4handle}`); log(r.s === 200 && text(r.t).includes(t4name) && !/Lagos|Zorbtest/.test(text(r.t)) && /keeps the rest of their profile private/.test(text(r.t)), "people: their page shows the name and says the rest is private");
  r = await get(`/search?kind=people&q=${encodeURIComponent(t4handle)}`); log(link(r.t, t4handle), 'people: found by handle');
  psql(`update "Trainee" set "emailVerified"=false where email='t4@dev.test'`); r = await get(`/search?kind=people&q=${encodeURIComponent(t4name)}`); log(!link(r.t, t4handle), 'people: an account that never confirmed its email is not found'); psql(`update "Trainee" set "emailVerified"=true where email='t4@dev.test'`);
  const superName = psql(`select name from "User" where email='super@dev.test'`);
  for (const k of ['all', 'people']) { r = await get(`/search?kind=${k}&q=${encodeURIComponent(superName)}`, t0c); log(!text(r.t).includes(superName), `the super admin is never found (${k})`); }
  const staffName = psql(`select name from "User" where email='staff@dev.test'`); r = await get(`/search?q=${encodeURIComponent(staffName)}`, t0c); log(!text(r.t).includes(staffName), 'staff are never found');
  const orgName = psql(`select name from "TrainingOrganization" where email='org@dev.test'`); const orgHandle = psql(`select p.handle from "Profile" p join "TrainingOrganization" o on o.id=p."trainingOrganizationId" where o.email='org@dev.test'`);
  psql(`update "OrganizationPublicProfile" set "publicEnabled"=false where "trainingOrganizationId"=(select id from "TrainingOrganization" where email='org@dev.test')`);
  r = await get(`/search?kind=organizations&q=${encodeURIComponent(orgName)}`); log(link(r.t, orgHandle), 'organizations: an approved one is found by name even before its public page is on');
  psql(`update "OrganizationPublicProfile" set "publicEnabled"=true where "trainingOrganizationId"=(select id from "TrainingOrganization" where email='org@dev.test')`);
  // ---- comments
  const p3 = psql(`select p.id from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t3@dev.test'`), p4 = psql(`select p.id from "Profile" p join "Trainee" t on t.id=p."traineeId" where t.email='t4@dev.test'`);
  psql(`insert into "Post"(id,"authorProfileId",body,status,visibility,"publishedAt","updatedAt") values ('srchpost1','${p3}','A public thread about lanterns','PUBLISHED','PUBLIC',now(),now()),('srchpost2','${p3}','A members-only thread','PUBLISHED','MEMBERS',now(),now()),('srchpost3','${p3}','A draft thread','DRAFT','PUBLIC',null,now())`);
  psql(`insert into "PostComment"(id,"postId","authorProfileId",body,status) values ('srchc1','srchpost1','${p4}','What a zibberword insight, thank you','VISIBLE'),('srchc2','srchpost1','${p4}','a removed zibberword remark','REMOVED'),('srchc3','srchpost2','${p4}','a members zibberword remark','VISIBLE'),('srchc4','srchpost3','${p4}','a draft zibberword remark','VISIBLE')`);
  r = await get('/search?kind=comments&q=zibberword');
  log(text(r.t).includes('What a zibberword insight') && /href="\/post\/srchpost1#comment-srchc1"/.test(r.t), 'comments: a public comment is found by its words and links to the conversation');
  log(!text(r.t).includes('removed zibberword') && !text(r.t).includes('members zibberword') && !text(r.t).includes('draft zibberword'), 'comments: a removed one, one on a members-only post (for a visitor) and one on a draft are not shown');
  r = await get('/search?kind=comments&q=zibberword', t0c); log(text(r.t).includes('members zibberword') && !text(r.t).includes('removed zibberword') && !text(r.t).includes('draft zibberword'), 'comments: a signed-in member also sees comments on members-only posts');
  r = await get('/search?q=zibberword'); log(/Comments/.test(text(r.t)) && text(r.t).includes('What a zibberword insight'), 'all: comments appear in the overall results');
  log(text(r.t).includes(t4name), 'comments: who wrote it is shown');

  // ---- hostile input
  r = await get('/search?q=' + encodeURIComponent('<script>alert(1)</script>') + '&kind=people&skill=' + encodeURIComponent('"><img src=x onerror=alert(1)>')); log(r.s === 200 && !r.t.includes('<script>alert(1)</script>') && !r.t.includes('<img src=x onerror'), 'hostile text is escaped, never echoed as markup');
  r = await get('/search?q=' + 'a'.repeat(5000) + '&page=999999&kind=%27%3BDROP%20TABLE'); log(r.s === 200, 'oversized or odd parameters are tamed');
  // ---- empty states
  r = await get('/search?kind=people&q=qqqqzzzznotaword'); log(/Nothing found/.test(text(r.t)) && /Browse organizations/.test(text(r.t)) && /Search everything/.test(text(r.t)), 'empty: clear guidance and ways out');
  r = await get('/search'); log(/at least two letters/.test(text(r.t)), 'no search yet: says how to start');
  // ---- switches
  const flagCall = (b) => fetch(B + '/api/admin/ecosystem', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: sa }, body: JSON.stringify(b) });
  await flagCall({ ecosystemPublicJobsEnabled: false }); r = await get('/search?kind=jobs&q=zorbtest'); log(!text(r.t).includes('Zorbtest Analyst'), 'switch: with public jobs off, jobs are not searched');
  r = await get('/api/search/suggest?q=zorb'); log(!r.d.items.some((i) => i.kind === 'job'), 'switch: nor suggested');
  await flagCall({ ecosystemPublicJobsEnabled: true });
  await flagCall({ ecosystemPublicTraineesEnabled: false }); r = await get('/search?kind=people&q=zorbtest'); log(!text(r.t).includes(t3name), 'switch: with the trainee directory off, members are not searched');
  await flagCall({ ecosystemPublicTraineesEnabled: true });
  // ---- header search box is the suggesting one
  r = await get('/'); log(/role="combobox"/.test(r.t) && /Search people, jobs, startups/.test(r.t), 'the header search is the new suggesting box');
  cleanup(); clearThrottle();
})().catch((e) => { console.error(e); try { cleanup(); } catch {} process.exit(1); });
