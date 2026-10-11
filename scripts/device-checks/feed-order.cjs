const { B, log, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async()=>{
 const c=(await cookiesFor('/api/auth/trainee-login','t0@dev.test')).map(x=>`${x.name}=${x.value}`).join('; ');
 const r=await fetch(B+'/api/posts',{method:'POST',headers:{'Content-Type':'application/json',Cookie:c},body:JSON.stringify({title:'TITLEX',body:'BODYX text',youtubeUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',submit:true})});
 const id=(await r.json()).id;
 const h=(await (await fetch(B+'/feed',{headers:{Cookie:c}})).text()).replace(/<!-- -->/g,'');
 const art=h.slice(h.indexOf('id="post-'+id+'"'));
 const v=art.indexOf('dQw4w9WgXcQ'), t=art.indexOf('<h2'), b=art.indexOf('BODYX');
 log(v > 0 && t > v && b > t, `the feed shows the video, then the title, then the text (${v}, ${t}, ${b})`);
 psql(`delete from "Post" where id='${id}'`);
})();
