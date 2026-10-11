const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const call = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, redirect: 'manual' }); const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch {} return { s: r.status, d, t: t.replace(/<!-- -->/g, '') }; };
(async () => {
  clearThrottle();
  const t0 = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  const t1 = jar(await cookiesFor('/api/auth/trainee-login', 't1@dev.test'));
  const long = Array.from({ length: 30 }, (_, i) => `Line ${i} of a long write up`).join('\n');
  let r = await call('POST', '/api/posts', t0, { title: 'TECH OVER YOUR FUTURE', body: long, youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', submit: true });
  const A = r.d.id; log(!!A, `post made (${r.s})`);
  const st = psql(`select status from "Post" where id='${A}'`);
  log(st === 'PUBLISHED', `a clean post publishes at once (${st})`);
  r = await call('GET', `/post/${A}`, t1);
  const html = r.t;
  log(r.s === 200, 'the post page opens');
  const art = html.indexOf('<article'), iv = html.indexOf('dQw4w9WgXcQ', art), it = html.indexOf('<h2', art), ib = html.indexOf('Line 0 of', art);
  log(iv > 0 && it > iv && ib > it, 'order: video first, then the title, then the text');
  log(html.includes('Dislike') && html.includes('aria-label="Comment"') && html.includes('aria-label="Share"') && html.includes('aria-label="Save"'), 'the post page has Like, Dislike, Comment, Save and Share');
  log(html.includes('aria-label="Comments"') || html.includes('Write a comment'), 'comments (and the box to write one) are open on the post page');
  // dislike works and replaces a like
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: 'LIKE' }); log(r.s === 200, 'like');
  r = await call('POST', `/api/posts/${A}/react`, t1, { kind: 'DISLIKE' }); log(r.s === 200, 'dislike');
  log(psql(`select kind from "PostReaction" where "postId"='${A}'`) === 'DISLIKE' && psql(`select count(*) from "PostReaction" where "postId"='${A}'`) === '1', 'a dislike replaces the like; one reaction per person');
  r = await call('GET', `/post/${A}`, t1); log(/Dislike\s*1/.test(r.t), 'the dislike count shows');
  // comment + reply
  r = await call('POST', `/api/posts/${A}/comments`, t1, { body: 'Great post' }); const C = r.d.id || r.d.comment?.id; log(r.s < 300, 'comment');
  r = await call('POST', `/api/posts/${A}/comments`, t0, { body: 'Thanks!', parentId: C }); log(r.s < 300, 'reply');
  // a visitor can read, not act
  r = await call('GET', `/post/${A}`, null); log(r.s === 200 && r.t.includes('Create an account to join the conversation') || r.t.includes('Write a comment'), 'a visitor can read the post and is invited to join');
  r = await call('POST', `/api/posts/${A}/react`, null, { kind: 'DISLIKE' }); log(r.s === 401, 'a visitor cannot react');
  psql(`delete from "Post" where id='${A}'`);
})().catch((e) => { console.error(e); process.exit(1); });
