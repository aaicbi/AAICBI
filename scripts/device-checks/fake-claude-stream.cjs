// A stand-in for api.anthropic.com's streaming /v1/messages, scripted by keywords in the person's message,
// so the Command Center can be exercised end to end without the real service.
const http = require('http'); const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
async function textReply(res, text, model, delay = 25) {
  send(res, 'message_start', { type: 'message_start', message: { id: 'msg_fake', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 } } });
  send(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  const parts = text.match(/[\s\S]{1,14}/g) || [''];
  for (const p of parts) { send(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: p } }); await sleep(delay); }
  send(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
  send(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } });
  send(res, 'message_stop', { type: 'message_stop' }); res.end();
}
function toolReply(res, name, input, model, id) {
  send(res, 'message_start', { type: 'message_start', message: { id: 'msg_fake', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 } } });
  send(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name, input: {} } });
  send(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } });
  send(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
  send(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 20 } });
  send(res, 'message_stop', { type: 'message_stop' }); res.end();
}
const blocksOf = (c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', async () => {
    let j = {}; try { j = JSON.parse(body); } catch {}
    fs.appendFileSync('/tmp/fakeclaude-stream.log', JSON.stringify({ url: req.url, model: j.model, stream: j.stream, system: typeof j.system === 'string' ? j.system : JSON.stringify(j.system || ''), tools: (j.tools || []).map((t) => t.name), messages: (j.messages || []).map((m) => ({ role: m.role, blocks: blocksOf(m.content).map((b) => ({ type: b.type, text: b.text ? String(b.text).slice(0, 300) : undefined, name: b.name })) })) }) + '\n');
    if (!j.stream) {
      // The question bank's calls (writer and reviewer) are not streamed. Behave like a reviewer: find the answer unless the
      // question says TRAP, and call a question ambiguous when it says AMBIG.
      const sys = typeof j.system === 'string' ? j.system : JSON.stringify(j.system || '');
      const user = blocksOf(((j.messages || [])[0] || {}).content || '').map((b) => b.text || '').join('\n');
      const items = [...user.matchAll(/^(\d+)\) (?:Objective: .*\n)?(?:Question: )?(.*)$/gm)].map((m) => ({ i: Number(m[1]), text: m[2] }));
      let out;
      if (/You write scenario-based/.test(sys)) out = { questions: [{ question: 'What starts a workflow?', options: ['A trigger', 'A filter'], correct_option_index: 0, explanation: 'A trigger starts it.', topic: 'Triggers' }] };
      else if (/independently determine|work out the correct answer yourself/.test(sys)) out = { verifications: items.map((t) => ({ index: t.i, correct_option_index: /TRAP|WRONG/.test(t.text) ? 1 : 0 })) };
      else out = { results: items.map((t) => ({ index: t.i, aligned: true, alignmentReason: null, ambiguous: /AMBIG/.test(t.text), ambiguityReason: /AMBIG/.test(t.text) ? 'Two options fit.' : null })) };
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: 'msg_fake', type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const msgs = j.messages || [];
    // the human's message for this turn, and how many tool rounds have happened since
    let humanIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user' && !blocksOf(msgs[i].content).every((b) => b.type === 'tool_result')) { humanIdx = i; break; } }
    const human = blocksOf(msgs[humanIdx].content);
    const text = human.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const stage = Math.floor((msgs.length - 1 - humanIdx) / 2);
    const lastResult = msgs.length - 1 > humanIdx ? JSON.stringify(blocksOf(msgs[msgs.length - 1].content)) : '';
    let m;
    if ((m = text.match(/OBJ:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      const name = m[1].trim();
      if (stage === 0) return toolReply(res, 'find_module', { query: name }, j.model, 'tu_find');
      if (stage === 1) return toolReply(res, 'save_learning_objectives', { moduleQuery: name, objectives: [`Explain the basics of ${name}`, `Apply ${name} in practice`] }, j.model, 'tu_save');
      return textReply(res, /awaitingApproval/.test(lastResult) ? "I've prepared the objectives. They are **waiting for your approval**." : 'Done. I saved the objectives for that module.', j.model);
    }
    if ((m = text.match(/GAME:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'create_game', { title: m[1].trim(), format: 'MATCHING', description: 'Match the terms.' }, j.model, 'tu_cg');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'The game is ready and waiting for your approval.' : 'I created the game.', j.model);
    }
    if ((m = text.match(/ITEMS:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      const mod = m[1].trim();
      if (stage === 0) return toolReply(res, 'get_game_items', { moduleQuery: mod, format: 'MATCHING' }, j.model, 'tu_gi');
      if (stage === 1) return toolReply(res, 'add_game_items', { moduleQuery: mod, objectiveQuery: 'trigger', format: 'MATCHING', items: [
        { prompt: 'Match the automation terms', pairs: [{ left: 'Trigger', right: 'Starts a workflow' }, { left: 'Action', right: 'A step it performs' }, { left: 'Filter', right: 'Stops unwanted runs' }] },
        { prompt: 'Match the app terms', pairs: [{ left: 'Webhook', right: 'A message sent to a URL' }, { left: 'Connector', right: 'Links two apps' }, { left: 'Run', right: 'One execution of a workflow' }, { left: 'Task', right: 'One unit of work' }] },
        { prompt: 'Too few pairs', pairs: [{ left: 'Only', right: 'One' }] } ] }, j.model, 'tu_add');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'I wrote the items and they are waiting for your approval.' : 'I added the draft items. Try them in the preview, then approve.', j.model);
    }
    if ((m = text.match(/REQ:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'log_change_request', { title: m[1].trim(), details: 'Please change this page so the list shows module numbers.', page: '/admin/studio' }, j.model, 'tu_req');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'The request is waiting for your approval.' : 'Saved as a change request. Approve it on the Change requests page.', j.model);
    }
    if ((m = text.match(/PEOPLE:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'search_people', { query: m[1].trim() }, j.model, 'tu_sp');
      return textReply(res, /permission/.test(lastResult) ? 'I am not allowed to look people up for you.' : 'Here are the people I found.', j.model);
    }
    if ((m = text.match(/BANK:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'get_bank_questions', { moduleQuery: m[1].trim() }, j.model, 'tu_bank');
      return textReply(res, /writtenBy/.test(lastResult) ? 'BANK-READ: ' + (lastResult.match(/reviewedBy[^,]*/) || [''])[0].replace(/\\/g, '') : 'I could not read the bank.', j.model);
    }
    if ((m = text.match(/BANKAPPROVE:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'approve_bank_questions', { moduleQuery: m[1].trim() }, j.model, 'tu_bapp');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'The approval is waiting for you.' : 'Approved.', j.model);
    }
    if ((m = text.match(/APPROVE:([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'approve_game_items', { moduleQuery: m[1].trim(), format: 'MATCHING' }, j.model, 'tu_ap');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'The approval is waiting for you.' : 'Approved.', j.model);
    }
    if ((m = text.match(/ASSIGN:([A-Za-z0-9 ]+?)\|([A-Za-z0-9 ]+?)(?:\.|$|\n)/))) {
      if (stage === 0) return toolReply(res, 'assign_game', { gameQuery: m[1].trim(), moduleQuery: m[2].trim(), live: true }, j.model, 'tu_as');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'Assigned, waiting for your approval to go live.' : 'Assigned and live.', j.model);
    }
    if (/MSG:/.test(text)) {
      if (stage === 0) return toolReply(res, 'resolve_recipients', { scope: 'ROLE', role: 'SUPER_ADMIN', description: 'Super admins' }, j.model, 'tu_res');
      if (stage === 1) return toolReply(res, 'send_message', { subject: 'Hello team', body: 'A test message from Loop.', category: 'ANNOUNCEMENT' }, j.model, 'tu_send');
      return textReply(res, /awaitingApproval/.test(lastResult) ? 'The message is ready and waiting for your approval.' : 'The message was sent.', j.model);
    }
    if (/SLOW/.test(text)) return textReply(res, 'This is a long answer that keeps going. '.repeat(30), j.model, 120);
    if (human.some((b) => b.type === 'image')) return textReply(res, 'IMAGE-BLOCK-PRESENT: I can see the picture.', j.model);
    if ((m = text.match(/Attached file “([^”]+)”/))) return textReply(res, `I read the attachment named ${m[1]}. It says: ${(text.split(':\n')[1] || '').slice(0, 60)}`, j.model);
    return textReply(res, 'Hello! Here is **bold** text and `code`.\n\n## A heading\n\n- item one\n- item two\n\n| Name | Count |\n|---|---|\n| Trainees | 12 |\n\nSee [the dashboard](/admin/dashboard).', j.model);
  });
}).listen(4599, '127.0.0.1');
