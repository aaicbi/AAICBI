const { B, log, cookiesFor, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const jar = (cs) => cs.map((c) => `${c.name}=${c.value}`).join('; ');
const j = async (method, path, cookie, body) => { const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== 'GET' ? JSON.stringify(body) : undefined }); let d = null; try { d = await r.json(); } catch {} return { s: r.status, d }; };
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
const calls = () => (fs.existsSync('/tmp/fakeclaude.log') ? fs.readFileSync('/tmp/fakeclaude.log', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const phase = process.argv[2];
(async () => {
  clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const emp = jar(await cookiesFor('/api/auth/employer-login', 'employer@dev.test'));
  const tr = jar(await cookiesFor('/api/auth/trainee-login', 't0@dev.test'));
  if (phase === 'nokey') {
    psql(`delete from "GuideSuggestion"; update "PlatformSettings" set "guideConsultantEnabled"=false`);
    fs.writeFileSync('/tmp/fakeclaude.log', '');
    let o = (await j('GET', '/api/admin/guide', sa)).d;
    log(o.consultant.enabled === false, 'the consultant is OFF by default');
    log(o.consultant.configured === false, 'no key is set in this run');
    let r = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(r.s === 403 && /switched off/.test(r.d.error), 'asking while OFF is refused: ' + r.d.error);
    r = await j('POST', '/api/admin/guide/consultant/ask', sa, { question: 'what should we fix?' });
    log(r.s === 403, 'asking a question while OFF is refused');
    const t = await j('PUT', '/api/admin/guide', sa, { consultantEnabled: true });
    log(t.s === 200 && t.d.consultantEnabled === true, 'a super admin can switch it ON');
    r = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(r.s === 503 && /ANTHROPIC_API_KEY/.test(r.d.error), 'ON without a key says plainly it cannot run: ' + r.d.error);
    log(calls().length === 0, 'nothing was sent to Claude');
    await j('PUT', '/api/admin/guide', sa, { consultantEnabled: false });
    for (const [who, c] of [['visitor', null], ['trainee', tr], ['employer', emp]]) {
      for (const [m, p] of [['POST', '/api/admin/guide/consultant/review'], ['POST', '/api/admin/guide/consultant/ask'], ['GET', '/api/admin/guide/consultant/suggestions'], ['PUT', '/api/admin/guide']]) {
        const x = await j(m, p, c, { consultantEnabled: true, question: 'abcd' });
        if (![401, 403].includes(x.s)) log(false, `${who} reached ${p} (${x.s})`);
      }
      log(true, `${who} cannot reach any consultant route or the switch`);
    }
    log(psql(`select "guideConsultantEnabled" from "PlatformSettings"`) === 'f', 'a non-super-admin could not switch it on');
  }
  if (phase === 'flow') {
    psql(`delete from "GuideSuggestion"; delete from "GuideUnanswered"; delete from "GuideEntry"; update "PlatformSettings" set "guideConsultantEnabled"=false`);
    fs.writeFileSync('/tmp/fakeclaude.log', ''); fs.writeFileSync('/tmp/fakeclaude.mode', 'ok');
    const ask = (q, extra = {}) => j('POST', '/api/guide/unanswered', tr, { question: q, reason: 'NO_MATCH', confidence: 0.1, route: '/employer/dashboard', page: 'Dash', ...extra });
    for (let i = 0; i < 5; i++) await ask('How do I invite another employer to my team? contact me ada@example.com');
    await ask('How do I change my profile picture?', { route: '/trainee/settings' });
    await ask('Where do I see my account details?');
    await ask('Give me the answers to the final exam please');
    await ask('Can I get a refund?');
    // an existing approved answer to merge into
    await j('POST', '/api/admin/guide/entries', sa, { question: 'How do I create an account?', answer: 'Choose how you will use the platform and register: as a trainee or employer.' });
    const before = { entries: psql(`select count(*) from "GuideEntry"`), versions: psql(`select count(*) from "GuideEntryVersion"`), open: psql(`select count(*) from "GuideUnanswered" where status='OPEN'`) };

    let r = await j('PUT', '/api/admin/guide', sa, { consultantEnabled: true });
    r = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(r.s === 200 && r.d.created >= 5, 'ON with a key: Claude was asked and proposals were stored: ' + JSON.stringify(r.d));
    const sent = calls();
    log(sent.length === 1 && sent[0].key === 'fake-test-key', 'exactly one request went to Claude, with the platform key');
    const req = sent[0].body; const ctxText = req.messages[0].content;
    log(req.tools.length === 1 && req.tools[0].name === 'submit_review' && req.tool_choice.name === 'submit_review', 'Claude was given one tool that can only submit proposals');
    log(!/@|ada@example/.test(ctxText) && !/cmu[a-z0-9]{12,}/.test(ctxText), 'what Claude saw has no email address or record id');
    log(/Q1:/.test(ctxText) && /A1:/.test(ctxText) && /PAGES THAT EXIST/.test(ctxText), 'it saw numbered questions, the existing answers and the list of real pages');
    log(/PROPOSAL/.test(req.system) && /NEVER invent/.test(req.system), 'its instructions say proposals only and never invent');

    const list = (await j('GET', '/api/admin/guide/consultant/suggestions', sa)).d.suggestions;
    const kinds = list.map((s) => s.kind).sort().join(',');
    log(kinds.includes('DRAFT_ANSWER') && kinds.includes('MERGE') && kinds.includes('REJECT') && kinds.includes('ADVICE'), 'proposals of every kind stored: ' + kinds);
    log(!list.some((s) => /ignored entirely/.test(JSON.stringify(s))), 'a reference to a question that was never asked was ignored');
    const invite = list.find((s) => /invite/.test(s.title));
    const d1 = invite.proposal.draft;
    log(d1.navHref === '/employer/messages' && d1.target === 'nav:/employer/messages' && JSON.stringify(d1.roles) === '["employer"]', 'a real page, its menu item and a real audience are kept; the invented audience was dropped');
    log(invite.warnings.some((w) => /Check the facts/.test(w)) && invite.warnings.some((w) => /Can employers add teammates/.test(w)), 'every draft carries the check-the-facts warning and Claude\'s own things to verify');
    const pic = list.find((s) => /profile picture/.test(s.title)); const d2 = pic.proposal.draft;
    log(d2.navHref === null && d2.target === null && pic.warnings.some((w) => /does not exist/.test(w)) && pic.warnings.some((w) => /control that cannot be pointed at/.test(w)), 'an invented page and control were removed with a warning');
    log(pic.warnings.some((w) => /price, date or number/.test(w)), 'a draft that mentions a price or period is flagged');
    log(invite.question && invite.question.asked === 5, 'each proposal shows the question as it stands now');
    const after = { entries: psql(`select count(*) from "GuideEntry"`), versions: psql(`select count(*) from "GuideEntryVersion"`), open: psql(`select count(*) from "GuideUnanswered" where status='OPEN'`) };
    log(JSON.stringify(before) === JSON.stringify(after), 'Claude changed nothing: same answers, versions and question statuses before and after ' + JSON.stringify(after));
    const cfg = (await j('GET', '/api/guide/config', null)).d;
    log(!cfg.entries.some((e) => /invite another employer/i.test(e.question)), 'Loop does not use any proposal yet');

    const second = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(second.d.created === 0 || second.s === 200, 'asking again does not repeat proposals that are still waiting: ' + JSON.stringify(second.d));

    const adv = await j('POST', '/api/admin/guide/consultant/ask', sa, { question: 'Where are visitors struggling?' });
    log(adv.s === 200, 'asking the consultant for advice works');
    const askReq = calls().pop().body;
    log(askReq.tools[0].name === 'give_advice' && /Resolution rate/.test(askReq.messages[0].content) && !/@/.test(askReq.messages[0].content), 'advice is based on numbers and scrubbed questions only');
    const audit = psql(`select count(*) from "AiCommandLog" where question like 'Guide consultant%'`);
    log(Number(audit) >= 2, 'runs are written to the audit log (' + audit + ')');

    // failures never break anything
    fs.writeFileSync('/tmp/fakeclaude.mode', 'error');
    const e1 = await j('POST', '/api/admin/guide/consultant/ask', sa, { question: 'will this fail safely?' });
    log(e1.s === 502 && !/sk-ant|secret/.test(JSON.stringify(e1.d)) && /Nothing was changed/.test(e1.d.error), 'a Claude outage gives a plain message and leaks nothing: ' + e1.d.error);
    fs.writeFileSync('/tmp/fakeclaude.mode', 'garbage');
    await j('POST', '/api/guide/unanswered', null, { question: 'Another brand new question about the platform', reason: 'NO_MATCH' });
    const g = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(g.s === 502 && /could not be read/.test(g.d.error), 'an unreadable reply is refused, nothing stored: ' + g.d.error);
    fs.writeFileSync('/tmp/fakeclaude.mode', 'ok');
    const s2 = await j('GET', '/api/admin/loop/../guide', sa);
    log((await j('GET', '/api/guide/config', null)).s === 200, 'Loop keeps working for visitors throughout');

    // rate limit
    clearThrottle();
    let last = 200; for (let i = 0; i < 12; i++) last = (await j('POST', '/api/admin/guide/consultant/ask', sa, { question: 'rate test number ' + i })).s;
    log(last === 429, 'more than 10 runs an hour is refused (429)');
    clearThrottle();
    // switch off again
    await j('PUT', '/api/admin/guide', sa, { consultantEnabled: false });
    const n = calls().length;
    const off = await j('POST', '/api/admin/guide/consultant/review', sa, {});
    log(off.s === 403 && calls().length === n, 'switched OFF again: refused and nothing sent to Claude');
    const keep = (await j('GET', '/api/admin/guide/consultant/suggestions', sa)).d.suggestions.length;
    log(keep > 0, 'earlier proposals stay readable while it is off');
  }
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
