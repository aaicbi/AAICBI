const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const call = async (p, c) => { const r = await fetch(B + p, { headers: c ? { Cookie: c } : {} }); return { s: r.status, t: await r.text() }; };
(async () => {
  clearThrottle();
  psql(`delete from "Startup" where name like 'Panel check %'`);
  psql(`insert into "Startup"(id,name,tagline,industry,stage,status,"createdById","updatedAt") values ('pc1','Panel check Approved','Visible tagline','Fintech','MVP','APPROVED','x',now()),('pc2','Panel check Draft','hidden','Fintech','IDEA','DRAFT','x',now()),('pc3','Panel check Pending','hidden','Fintech','IDEA','PENDING','x',now())`);
  let r = await call('/');
  log(r.s === 200 && /Startup showcase/.test(r.t) && /Panel check Approved/.test(r.t), 'an approved startup is in the showcase');
  log(!/Panel check Draft|Panel check Pending/.test(r.t), 'draft and pending startups are not shown');
  log(/How AAICBI works/.test(r.t) && /Explore AAICBI/.test(r.t), 'a visitor gets "How AAICBI works" and the collapsible phone section');
  log(!/sample|example/i.test((r.t.match(/Startup showcase[\s\S]{0,800}/) || [''])[0]), 'no placeholders in the panels');
  log(/Career opportunities/.test(r.t) === (parseInt(psql(`select count(*) from "JobPosting" where status='APPROVED' and "closingDate" > now()`), 10) > 0), 'the jobs panel appears only when there are open jobs');
  const c = await cookiesFor('/api/auth/trainee-login', 't0@dev.test');
  r = await call('/', c.map((x) => `${x.name}=${x.value}`).join('; '));
  log(r.s === 200 && /Startup showcase/.test(r.t) && !/How AAICBI works/.test(r.t), 'a signed-in person sees the panels without the introduction');
  r = await call('/feed'); log(r.s === 200 && /Startup showcase/.test(r.t), '/feed has the panels too');
  psql(`delete from "Startup" where name like 'Panel check %'`);
})().catch((e) => { console.error(e); process.exit(1); });
