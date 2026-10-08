const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const j = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d = null; try { d = await r.json(); } catch {} return { s: r.status, d }; };
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const emp = jar(await cookiesFor('/api/auth/employer-login', 'employer@dev.test'));
  const tr = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  // clean slate for this run
  const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
  psql('delete from "GuideUnanswered"; delete from "GuideEntry"; delete from "GuideDailyStat"');

  // 1. three wordings, different kinds of account and pages
  const ask = (c, q, extra = {}) => j('POST', '/api/guide/unanswered', c, { question: q, reason: 'NO_MATCH', confidence: 0.1, route: '/trainee/courses/cmuznki4u000ip61x2v21ycrq?x=1', page: 'My Courses', context: ['hello there', 'what is this'], ...extra });
  await ask(null, 'How do I message an employer?');
  await ask(tr, 'Where can I chat with an employer?');
  await ask(tr, 'How can I send a message to an employer? my email is ada@example.com');
  await ask(emp, 'How do I change my profile picture?', { route: '/employer/dashboard' });
  const q1 = await j('GET', '/api/admin/guide/unanswered', sa);
  const rows = q1.d.questions;
  const grouped = rows.find((r) => /employer/.test(r.text) && /message|chat/.test(r.text));
  log(q1.s === 200 && rows.length === 2, `three wordings grouped into one topic (${rows.length} rows)`);
  log(grouped.asked === 3 && grouped.variants.length === 2, `topic counts 3 asks and keeps the other 2 wordings (${JSON.stringify(grouped.variants)})`);
  log(grouped.roleCounts.visitor === 1 && grouped.roleCounts.trainee === 2, 'kind of account is read from the session, not the browser: ' + JSON.stringify(grouped.roleCounts));
  log(grouped.lastRoute === '/trainee/courses/[id]' && grouped.feature === 'trainee/courses', `route has its id removed (${grouped.lastRoute}, area ${grouped.feature})`);
  log(!JSON.stringify(rows).includes('ada@example') && !JSON.stringify(rows).includes('cmuznki4u'), 'no email address or record id is kept');
  log(['HIGH', 'MEDIUM', 'LOW'].includes(grouped.priority) && grouped.reason === 'NO_MATCH' && grouped.confidence === 0.1, `priority ${grouped.priority}, reason, confidence recorded`);

  // 2. only a super admin can manage; the public cannot read the queue
  for (const [who, c] of [['visitor', null], ['trainee', tr], ['employer', emp]]) {
    const r = await j('GET', '/api/admin/guide/unanswered', c);
    log([401, 403].includes(r.s), `${who} cannot read the review queue (${r.s})`);
  }
  // 3. nothing becomes knowledge until approved
  let cfg = (await j('GET', '/api/guide/config', null)).d;
  log(!cfg.entries.some((e) => /employer/.test(e.question) && e.source === 'custom'), 'an unapproved question is not in the bot knowledge');

  // 4. approve with navigation, related questions, role
  const approve = await j('POST', `/api/admin/guide/unanswered/${grouped.id}`, sa, { action: 'answer', question: 'How do I message an employer?', answer: 'Employers you have applied to, or who introduced themselves, appear in Messages.', category: 'Messaging', navHref: '/trainee/messages', navLabel: 'Open Messages', target: 'nav:/trainee/messages', roles: ['trainee'], relatedQuestions: [], keywords: [], links: [], enabled: true });
  log(approve.s === 201, 'approved the answer (201)');
  cfg = (await j('GET', '/api/guide/config', null)).d;
  const entry = cfg.entries.find((e) => e.source === 'custom' && /message an employer/i.test(e.question));
  log(!!entry && entry.navHref === '/trainee/messages' && entry.target === 'nav:/trainee/messages' && entry.roles[0] === 'trainee', 'approved answer is now in the bot knowledge with its destination and audience');
  log(entry.relatedQuestions.length === 2, 'the other wordings were added as related questions: ' + JSON.stringify(entry.relatedQuestions));
  const after = (await j('GET', '/api/admin/guide/unanswered?status=ANSWERED', sa)).d.questions.find((r) => r.id === grouped.id);
  log(after && after.status === 'ANSWERED' && after.entryId && after.reviewedAt, 'question marked answered with reviewer date and link to the answer');

  // 5. versions
  const id = entry.dbId;
  const edit = await j('PUT', `/api/admin/guide/entries/${id}`, sa, { question: 'How do I message an employer?', answer: 'Open Messages from the menu. Employers appear once you apply or accept an introduction.', category: 'Messaging', navHref: '/trainee/messages', navLabel: 'Open Messages', target: 'nav:/trainee/messages', roles: ['trainee'], relatedQuestions: entry.relatedQuestions, keywords: [], links: [], enabled: true, changeNote: 'Clearer wording' });
  log(edit.d.version === 2, 'edit saved as version 2');
  const off = await j('PUT', `/api/admin/guide/entries/${id}`, sa, { question: 'How do I message an employer?', answer: 'Open Messages from the menu. Employers appear once you apply or accept an introduction.', category: 'Messaging', navHref: '/trainee/messages', roles: ['trainee'], relatedQuestions: [], enabled: false });
  log(off.d.version === 3, 'disabling is version 3');
  cfg = (await j('GET', '/api/guide/config', null)).d;
  log(!cfg.entries.some((e) => e.dbId === id), 'a disabled answer is not used by the bot');
  const vs = (await j('GET', `/api/admin/guide/entries/${id}/versions`, sa)).d.versions;
  log(vs.length === 3 && vs[2].action === 'CREATED' && vs[1].changeNote === 'Clearer wording' && vs[0].action === 'DISABLED' && vs.every((v) => v.changedByName), `history keeps 3 versions with who changed them (${vs.map((v) => v.action).join(', ')})`);
  const rest = await j('POST', `/api/admin/guide/entries/${id}/restore`, sa, { version: 1 });
  log(rest.d.version === 4, 'restoring version 1 creates version 4');
  cfg = (await j('GET', '/api/guide/config', null)).d;
  const back = cfg.entries.find((e) => e.dbId === id);
  log(back && /Employers you have applied to/.test(back.answer) && back.enabled !== false, 'the restored answer is live again with the original text');
  const vs2 = (await j('GET', `/api/admin/guide/entries/${id}/versions`, sa)).d.versions;
  log(vs2.length === 4 && vs2[0].action === 'RESTORED', 'history was not rewritten (4 versions, latest RESTORED)');

  // 6. review actions
  await ask(null, 'Can I change the dashboard background colour?');
  await ask(null, 'Is there dark mode on the employer page?');
  const list = (await j('GET', '/api/admin/guide/unanswered', sa)).d.questions;
  const a = list.find((r) => /background/.test(r.text)); const b = list.find((r) => /dark mode/.test(r.text)); const c = list.find((r) => /profile picture/.test(r.text));
  log((await j('POST', `/api/admin/guide/unanswered/${a.id}`, sa, { action: 'reject', note: 'cosmetic' })).s === 200, 'reject with a reason');
  log((await j('POST', `/api/admin/guide/unanswered/${b.id}`, sa, { action: 'review' })).s === 200, 'start review');
  log((await j('POST', `/api/admin/guide/unanswered/${c.id}`, sa, { action: 'categorize', category: 'Account and sign in' })).s === 200, 'set a category');
  const m = await j('POST', `/api/admin/guide/unanswered/${b.id}`, sa, { action: 'merge', intoQuestionId: c.id });
  const c2 = (await j('GET', '/api/admin/guide/unanswered?category=Account%20and%20sign%20in', sa)).d.questions[0];
  log(m.s === 200 && c2.asked === 2 && c2.variants.some((v) => /dark mode/.test(v)), 'merge into another question adds the counts and keeps the wording');
  const rej = (await j('GET', '/api/admin/guide/unanswered?status=REJECTED', sa)).d.questions[0];
  log(rej && rej.reviewNote === 'cosmetic' && rej.reviewedAt, 'rejected question kept with reason and date');
  const filt = (await j('GET', '/api/admin/guide/unanswered?status=ANSWERED&q=message', sa)).d.questions;
  log(filt.length === 1, 'search and status filters work');

  // 7. asked again after being answered goes back to the queue
  await ask(null, 'How can I chat to an employer?');
  const again = (await j('GET', '/api/admin/guide/unanswered?status=OPEN', sa)).d.questions.find((r) => r.id === grouped.id);
  log(!!again && again.asked >= 4, 'an answered question asked again is reopened for review: ' + (again ? again.reviewNote : 'not found'));

  // 8. stats and metrics
  await j('POST', '/api/guide/event', tr, { type: 'answered', entryId: id });
  await j('POST', '/api/guide/event', tr, { type: 'helpful' });
  await j('POST', '/api/guide/event', null, { type: 'navigation' });
  await j('POST', '/api/guide/event', tr, { type: 'tour' });
  const ov = (await j('GET', '/api/admin/guide', sa)).d;
  log(ov.metrics.answered >= 1 && ov.metrics.helpful >= 1 && ov.metrics.navigations >= 1 && ov.metrics.tours >= 1, 'daily counters feed the overview ' + JSON.stringify({ q: ov.metrics.questions, a: ov.metrics.answered, u: ov.metrics.unanswered, rate: ov.metrics.resolutionRate }));
  log(ov.entries.find((e) => e.id === id).served === 1, 'answer usage is counted');
  log(ov.metrics.struggles.length > 0, 'struggle areas listed: ' + JSON.stringify(ov.metrics.struggles));
  const abuse = await j('POST', '/api/guide/event', tr, { type: 'drop table' });
  log(abuse.s === 204 || abuse.s === 200, 'a bad event is ignored');
  const hist = (await j('GET', '/api/admin/guide/history', sa)).d;
  log(hist.changes.length >= 4 && hist.decided.length >= 3, `learning history lists ${hist.changes.length} changes and ${hist.decided.length} decisions`);
  const bad = await j('POST', '/api/admin/guide/entries', sa, { question: 'x y z question', answer: 'a valid long enough answer', navHref: 'https://evil.com' });
  log(bad.s === 400, 'an off-site destination is refused by the server');
  const bad2 = await j('POST', '/api/admin/guide/entries', emp, { question: 'x y z question', answer: 'a valid long enough answer' });
  log([401, 403].includes(bad2.s), 'an employer cannot write answers');
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
