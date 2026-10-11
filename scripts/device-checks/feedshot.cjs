const { B, launch, signedIn, device, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const api = (m,p,c,b)=>fetch(B+p,{method:m,headers:{'Content-Type':'application/json',Cookie:c},body:b?JSON.stringify(b):undefined}).then(r=>r.json().catch(()=>({})));
(async()=>{
 psql(`delete from "Post" where "legacyEducationPostId" is null; update "Trainee" set "profileVisibility"='PUBLIC' where email in ('t0@dev.test','t1@dev.test')`);
 const sa=jar(await cookiesFor('/api/auth/login','super@dev.test')); const t0=jar(await cookiesFor('/api/auth/trainee-login','t0@dev.test')); const t1=jar(await cookiesFor('/api/auth/trainee-login','t1@dev.test'));
 for (const [c,b] of [[t0,'Shipped a clinic stock dashboard this week. #python #data'],[t1,'Notes from todays #data workshop: clean first, chart later.']]) { const r=await api('POST','/api/posts',c,{body:b,submit:true}); await api('POST',`/api/admin/review/posts/${r.id}`,sa,{action:'approve'}); if(c===t0){ await api('POST',`/api/posts/${r.id}/react`,t1,{kind:'CELEBRATE'}); await api('POST',`/api/posts/${r.id}/comments`,t1,{body:'Nice work!'}); } }
 const br=await launch(); const errs=[];
 const dctx=await br.newContext({viewport:{width:1280,height:900}}); await dctx.addCookies([{name:'aaicbi_cookie_consent',value:'declined',url:B}]); const d=await dctx.newPage(); d.on('pageerror',e=>errs.push(e.message.slice(0,90)));
 await d.goto(B+'/feed',{waitUntil:'load'}); await d.waitForTimeout(2500); await d.screenshot({path:'/tmp/fd-desktop-visitor.png'});
 await d.getByRole('button',{name:/Like|React/i}).first().click().catch(()=>{}); await d.waitForTimeout(1200); await d.screenshot({path:'/tmp/fd-gate.png'});
 const m=await signedIn(br,device('iPhone 13'),'/api/auth/trainee-login','t1@dev.test'); const p=await m.newPage(); p.on('pageerror',e=>errs.push(e.message.slice(0,90)));
 await p.goto(B+'/feed',{waitUntil:'load'}); await p.waitForTimeout(2500); await p.screenshot({path:'/tmp/fd-phone.png'});
 console.log('overflow',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1), errs.length?errs:'no page errors');
 psql(`delete from "Post" where "legacyEducationPostId" is null; update "Trainee" set "profileVisibility"='PRIVATE' where email in ('t0@dev.test','t1@dev.test'); delete from "Follow"`); await br.close();
})().catch(e=>{console.error(e);process.exit(1)});
