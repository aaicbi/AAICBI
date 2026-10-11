// A stand-in for api.anthropic.com for testing: answers /v1/messages with a canned tool call.
const http = require('http'); const fs = require('fs');
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    let j = {}; try { j = JSON.parse(body); } catch {}
    fs.appendFileSync('/tmp/fakeclaude.log', JSON.stringify({ url: req.url, key: req.headers['x-api-key'], body: j }) + '\n');
    const mode = (() => { try { return fs.readFileSync('/tmp/fakeclaude.mode', 'utf8').trim(); } catch { return 'ok'; } })();
    if (mode === 'error') { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'secret internal detail sk-ant-xyz' } })); }
    const tool = (j.tools && j.tools[0] && j.tools[0].name) || '';
    const user = (j.messages && j.messages[0] && j.messages[0].content) || '';
    let input;
    if (mode === 'garbage') input = { nonsense: true };
    else if (tool === 'submit_review') {
      const qs = [...String(user).matchAll(/^Q(\d+): "([^"]+)"/gm)].map((m) => ({ ref: 'Q' + m[1], text: m[2] }));
      const find = (re) => qs.find((q) => re.test(q.text));
      const items = [];
      const a = find(/invite/); if (a) items.push({ ref: a.ref, action: 'draft_answer', confidence: 'medium', rationale: 'Asked often by employers; no existing answer covers teams.', verifyBeforeApproving: ['Can employers add teammates at all today?'], draft: { question: 'How do I invite another employer to my team?', answer: 'Employers cannot add teammates yet. Message the platform team from Messages and we will help.', category: 'Organizations and teams', navHref: '/employer/messages', navLabel: 'Open Messages', target: 'nav:/employer/messages', roles: ['employer', 'wizard'], relatedQuestions: ['Can I add a colleague to my account?'], keywords: ['teammate'] } });
      const b = find(/profile picture/); if (b) items.push({ ref: b.ref, action: 'draft_answer', confidence: 'high', rationale: 'Simple settings question.', draft: { question: 'How do I change my profile picture?', answer: 'Open Settings and upload a new Profile Picture under Your account. It costs ₦500 and lasts 30 days.', navHref: '/trainee/does-not-exist', target: 'made-up-control', roles: ['trainee'] } });
      const c = find(/account/); if (c) items.push({ ref: c.ref, action: 'merge_into_existing', confidence: 'high', rationale: 'Same as the existing account answer.', mergeRef: 'A1' });
      const d = find(/exam|answers/); if (d) items.push({ ref: d.ref, action: 'reject', confidence: 'high', rationale: 'Asks for exam answers; the guide must not give them.' });
      const e = find(/refund/); if (e) items.push({ ref: e.ref, action: 'needs_human', confidence: 'low', rationale: 'Depends on a payment policy I was not given.' });
      items.push({ ref: 'Q99', action: 'draft_answer', confidence: 'high', rationale: 'not a real reference', draft: { question: 'x', answer: 'an answer that should be ignored entirely' } });
      input = { items };
    } else input = { advice: 'Most unanswered questions come from the employer dashboard. That suggests team and account tasks are hard to find or missing. Check the labels there and whether employers can add colleagues at all.', nextSteps: ['Review the employer dashboard menu labels', 'Write an answer about teams'] };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_fake', type: 'message', role: 'assistant', model: j.model, content: [{ type: 'tool_use', id: 'tu_1', name: tool, input }], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }));
  });
}).listen(4599, '127.0.0.1');
