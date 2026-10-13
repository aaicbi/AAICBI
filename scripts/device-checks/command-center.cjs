// Command Center end to end against the private test database and a stand-in for the Claude API
// (fake-claude-stream.cjs on port 4599): conversations, streaming, formatting, attachments, the three
// autonomy levels, approval cards, access limits, and the screens on desktop and phone.
const { B, log, launch, device, cookiesFor, signedIn, results, clearThrottle } = require('./lib.cjs');
const { PrismaClient } = require('/home/user/AAICBI/node_modules/@prisma/client');
const JSZip = require('/home/user/AAICBI/node_modules/jszip');
const fs = require('fs');
const prisma = new PrismaClient();
const jar = (c) => c.map((x) => `${x.name}=${x.value}`).join('; ');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(cookie, { message, conversationId, level, files = [], abortAfterText } = {}) {
  const form = new FormData();
  form.set('message', message ?? '');
  if (conversationId) form.set('conversationId', conversationId);
  if (level) form.set('level', String(level));
  for (const f of files) form.append('files', f);
  const controller = new AbortController();
  const res = await fetch(B + '/api/admin/loop/chat', { method: 'POST', headers: { Cookie: cookie }, body: form, signal: controller.signal });
  if (!res.ok) return { status: res.status, json: await res.json().catch(() => null), events: [] };
  const events = [];
  let text = '';
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).split('\n').find((l) => l.startsWith('data: ')); buf = buf.slice(i + 2);
        if (!line) continue; const ev = JSON.parse(line.slice(6)); events.push(ev); if (ev.type === 'text') text += ev.delta;
        if (abortAfterText && text.length >= abortAfterText) { controller.abort(); throw new Error('aborted'); }
      }
    }
  } catch (e) { if (e.message !== 'aborted' && e.name !== 'AbortError') throw e; }
  return { status: 200, events, text, meta: events.find((e) => e.type === 'meta'), cards: events.filter((e) => e.type === 'action').map((e) => e.card) };
}
const api = async (cookie, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const pptx = async () => { const z = new JSZip(); z.file('ppt/slides/slide1.xml', '<p:sld xmlns:a="a"><a:p><a:r><a:t>Welcome to automation</a:t></a:r></a:p></p:sld>'); return z.generateAsync({ type: 'nodebuffer' }); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  fs.writeFileSync('/tmp/fakeclaude-stream.log', ''); clearThrottle();
  const sa = jar(await cookiesFor('/api/auth/login', 'super@dev.test'));
  const staff = jar(await cookiesFor('/api/auth/login', 'staff@dev.test'));
  const staffUser = await prisma.user.findUnique({ where: { email: 'super@dev.test' } });
  await prisma.loopConversation.deleteMany({ where: { userId: staffUser.id } });

  // seed two modules to work on
  const old = await prisma.course.findMany({ where: { title: 'Command check course' } });
  for (const c of old) await prisma.course.delete({ where: { id: c.id } });
  const course = await prisma.course.create({ data: { title: 'Command check course', status: 'PUBLISHED', published: true, isFree: true, createdById: staffUser.id } });
  const modA = await prisma.module.create({ data: { courseId: course.id, title: 'CC Module Alpha', order: 0 } });
  const modB = await prisma.module.create({ data: { courseId: course.id, title: 'CC Module Beta', order: 1 } });
  const modC = await prisma.module.create({ data: { courseId: course.id, title: 'CC Module Gamma', order: 2 } });

  // ---------- access ----------
  let r = await chat(staff, { message: 'hello' });
  log(r.status === 403 || r.status === 401, 'an admin who is not a Super Admin cannot use the Command Center chat');
  r = await api(staff, 'GET', '/api/admin/loop/conversations');
  log(r.status === 403 || r.status === 401, 'nor list its conversations');
  r = await chat('', { message: 'hello' });
  log(r.status === 401, 'nor a signed-out visitor');

  // ---------- streaming and saving ----------
  r = await chat(sa, { message: 'hello' });
  const first = r.meta.conversationId;
  const kinds = r.events.map((e) => e.type);
  log(kinds[0] === 'meta' && kinds.filter((k) => k === 'text').length > 3 && kinds[kinds.length - 1] === 'done', 'a reply streams in pieces: meta, several text chunks, then done');
  log(/\*\*bold\*\*/.test(r.text) && /\| Name \| Count \|/.test(r.text), 'the reply keeps its Markdown (bold, table)');
  let list = await api(sa, 'GET', '/api/admin/loop/conversations');
  log(list.json.conversations.some((c) => c.id === first && c.title === 'hello'), 'the conversation is saved, titled from the first message');
  let conv = await api(sa, 'GET', `/api/admin/loop/conversations/${first}`);
  log(conv.json.messages.length === 2 && conv.json.messages[1].text.startsWith('Hello!'), 'reloading it gives both messages back');

  // memory across turns: the second request must include the first exchange
  await chat(sa, { message: 'and again', conversationId: first });
  const lines = fs.readFileSync('/tmp/fakeclaude-stream.log', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const lastReq = lines[lines.length - 1];
  log(lastReq.messages.length >= 3 && lastReq.messages[0].role === 'user' && lastReq.messages[1].role === 'assistant', 'later turns replay the earlier conversation to Claude');
  log(lastReq.tools.includes('save_learning_objectives') && lastReq.tools.includes('read_module_materials') && !lastReq.tools.includes('analyze_module_materials'), 'Claude is offered the module-reading tools and actions, not the old fixed ones');

  // rename and delete
  r = await api(sa, 'PATCH', `/api/admin/loop/conversations/${first}`, { title: 'My first chat' });
  log(r.status === 200 && r.json.title === 'My first chat', 'a chat can be renamed');

  // ---------- attachments ----------
  const txt = new File(['Module notes: triggers start workflows.'], 'notes.txt', { type: 'text/plain' });
  r = await chat(sa, { message: 'please read this', files: [txt] });
  log(/notes\.txt/.test(r.text) && /triggers start workflows/.test(r.text), 'a text file attached to the chat is read and used');
  const deck = new File([await pptx()], 'deck.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  r = await chat(sa, { message: 'what is in this deck', files: [deck] });
  log(/deck\.pptx/.test(r.text) && /Welcome to automation/.test(r.text), 'a PowerPoint attached to the chat is read slide by slide');
  const png = new File([PNG], 'shot.png', { type: 'image/png' });
  r = await chat(sa, { message: 'look at this', files: [png] });
  log(/IMAGE-BLOCK-PRESENT/.test(r.text), 'a picture is shown to Claude as a picture');
  const big = new File([Buffer.alloc(4.5 * 1024 * 1024)], 'big.txt', { type: 'text/plain' });
  r = await chat(sa, { message: 'x', files: [big] });
  log(r.status === 400 && /4 MB/.test(r.json.error), 'files over 4 MB in total are refused with a plain reason');
  const bad = new File([Buffer.from([0, 1, 2, 3, 0, 0])], 'thing.bin', { type: 'application/octet-stream' });
  r = await chat(sa, { message: 'x', files: [bad] });
  log(r.status === 400 && /thing\.bin/.test(r.json.error), 'an unreadable file type is refused, naming the file');

  // ---------- autonomy levels ----------
  const countObj = (moduleId) => prisma.moduleLearningObjective.count({ where: { moduleId } });
  // level 1: everything waits
  r = await chat(sa, { message: 'OBJ:CC Module Alpha.', level: 1 });
  log(r.cards.length === 1 && r.cards[0].status === 'PENDING' && r.cards[0].kind === 'save_learning_objectives', 'level 1: a change becomes an approval card');
  log((await countObj(modA.id)) === 0, 'level 1: nothing is saved before approval');
  log(/waiting for your approval/.test(r.text), 'level 1: Loop says it is waiting, not done');
  const cardId = r.cards[0].id;
  r = await api(sa, 'POST', `/api/admin/loop/actions/${cardId}`, { decision: 'approve' });
  log(r.status === 200 && r.json.status === 'EXECUTED' && r.json.result.saved === 2 && (await countObj(modA.id)) === 2, 'approving runs exactly what the card described');
  r = await api(sa, 'POST', `/api/admin/loop/actions/${cardId}`, { decision: 'approve' });
  log(r.json.status === 'EXECUTED' && (await countObj(modA.id)) === 2, 'approving twice changes nothing more');
  // decline
  r = await chat(sa, { message: 'OBJ:CC Module Beta.', level: 1 });
  r = await api(sa, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'reject' });
  log(r.json.status === 'REJECTED' && (await countObj(modB.id)) === 0, 'declining does nothing');
  // level 2: low-risk runs, high-risk asks
  r = await chat(sa, { message: 'OBJ:CC Module Beta.', level: 2 });
  log(r.cards.length === 1 && r.cards[0].status === 'EXECUTED' && r.cards[0].autoExecuted === true && (await countObj(modB.id)) === 2, 'level 2: a low-risk change happens at once and is marked as automatic');
  r = await chat(sa, { message: 'MSG: tell them', level: 2 });
  log(r.cards.length === 1 && r.cards[0].status === 'PENDING' && r.cards[0].kind === 'send_message', 'level 2: a message to people still waits for approval');
  const before = await prisma.loopBroadcast.count();
  log(before === (await prisma.loopBroadcast.count()), 'level 2: no message went out');
  r = await api(sa, 'POST', `/api/admin/loop/actions/${r.cards[0].id}`, { decision: 'approve' });
  log(r.json.status === 'EXECUTED' && (await prisma.loopBroadcast.count()) === before + 1, 'approving the message sends it, recorded with who authorised it');
  const bc = await prisma.loopBroadcast.findFirst({ orderBy: { sentAt: 'desc' } });
  log(bc.authorizedById === staffUser.id && bc.recipientDescription === 'Super admins', 'the broadcast record names the authoriser and the real recipients');
  // level 3: even the message runs at once (small audience)
  r = await chat(sa, { message: 'MSG: tell them again', level: 3 });
  log(r.cards.length === 1 && r.cards[0].status === 'EXECUTED' && r.cards[0].autoExecuted === true, 'level 3: a message to a small audience goes out at once');
  r = await chat(sa, { message: 'OBJ:CC Module Gamma.', level: 3 });
  log(r.cards[0].status === 'EXECUTED' && (await countObj(modC.id)) === 2, 'level 3: objectives are saved at once');
  const ledger = await prisma.loopPendingAction.findMany({ where: { userId: staffUser.id } });
  log(ledger.length >= 6 && ledger.every((a) => a.input && a.summary), 'every action, run or not, is recorded with its exact input');
  conv = await api(sa, 'GET', `/api/admin/loop/conversations/${r.meta.conversationId}`);
  log(conv.json.level === 3 && conv.json.messages[1].actions.length === 1, 'the chat remembers its level and shows its action cards when reopened');
  list = await api(sa, 'GET', '/api/admin/loop/conversations');
  log(list.json.defaultLevel === 3, 'the last level chosen becomes the default for new chats');

  // ---------- stop ----------
  r = await chat(sa, { message: 'SLOW please', level: 1, abortAfterText: 40 });
  await sleep(800);
  conv = await api(sa, 'GET', `/api/admin/loop/conversations`);
  const slowId = r.meta.conversationId;
  const saved = await api(sa, 'GET', `/api/admin/loop/conversations/${slowId}`);
  log(saved.json.messages[1].text.length > 0 && saved.json.messages[1].text.length < 900, 'stopping a reply keeps what was written so far');

  // ---------- delete ----------
  r = await api(sa, 'DELETE', `/api/admin/loop/conversations/${first}`);
  log(r.status === 200 && (await prisma.loopConversation.count({ where: { id: first } })) === 0, 'a chat can be deleted');

  // ---------- screens ----------
  await prisma.loopConversation.deleteMany({ where: { userId: staffUser.id } });
  // the test messages above notified this account; clear them so toasts do not cover the screen
  await prisma.userNotification.deleteMany({ where: { recipientId: staffUser.id } }).catch(() => prisma.userNotification.deleteMany({}));
  clearThrottle(); // the API checks above used up the chat's own message limit
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome', { viewport: { width: 1280, height: 860 } }), '/api/auth/login', 'super@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${B}/admin/command`, { waitUntil: 'load' });
  await p.getByRole('heading', { name: 'How can I help today?' }).waitFor();
  log((await p.getByTestId('suggestion').count()) === 4, 'an empty chat greets you and offers four starting prompts');
  await p.screenshot({ path: '/tmp/dev/cc-empty.png' });

  await p.locator('#loop-input').fill('hello there');
  await p.locator('#loop-input').press('Enter');
  await p.getByTestId('assistant-message').first().waitFor();
  await p.locator('[data-testid=assistant-message] strong').first().waitFor();
  log(true, 'Enter sends, and the reply appears');
  await p.locator('[data-testid=assistant-message] table').waitFor();
  await p.locator('[data-testid=assistant-message] a[href="/admin/dashboard"]').waitFor();
  const html = await p.getByTestId('assistant-message').first().innerHTML();
  log(/<strong/.test(html) && /<li/.test(html) && /<table/.test(html) && /<h3/.test(html) && /<code/.test(html), 'the reply is formatted: bold, list, table, heading and code');
  log(/href="\/admin\/dashboard"/.test(html), 'links in a reply work');
  await p.waitForFunction(() => document.querySelector('[data-testid=send]'));
  await p.locator('nav[aria-label="Your chats"] button', { hasText: 'hello there' }).first().waitFor();
  log(true, 'the chat shows up in the sidebar');

  // level picker
  await p.getByTestId('level-picker').click();
  await p.getByTestId('level-3').click();
  log(/Autonomous/.test(await p.getByTestId('level-picker').innerText()), 'the level picker switches between the three levels');
  await p.getByTestId('level-picker').click();
  await p.getByTestId('level-1').click();

  // attachment chip and action card in the UI
  await p.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Some notes for Loop') });
  await p.getByRole('list', { name: 'Attached files' }).getByText('notes.txt').waitFor();
  log(true, 'an attached file shows as a chip that can be removed');
  await p.locator('#loop-input').fill('OBJ:CC Module Beta. use the notes');
  await p.getByTestId('send').click();
  await p.getByTestId('action-card').first().waitFor();
  const card = p.getByTestId('action-card').first();
  log(/Waiting for your approval/.test(await card.innerText()) || (await card.getAttribute('data-status')) === 'EXECUTED', 'a change shows as a card in the chat');
  await p.screenshot({ path: '/tmp/dev/cc-chat.png' });

  // rename + delete through the menu
  await p.locator('nav[aria-label="Your chats"] button[aria-label^="Options for"]').first().click({ force: true });
  await p.getByRole('button', { name: 'Rename' }).click();
  await p.getByLabel('Chat name').fill('Renamed chat');
  await p.getByLabel('Chat name').press('Enter');
  await p.locator('nav[aria-label="Your chats"] button', { hasText: 'Renamed chat' }).waitFor();
  log(true, 'a chat can be renamed from the sidebar');
  await p.locator('nav[aria-label="Your chats"] button[aria-label^="Options for"]').first().click({ force: true });
  await p.getByRole('button', { name: 'Delete' }).click();
  await p.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await p.getByRole('heading', { name: 'How can I help today?' }).waitFor();
  log(true, 'a chat can be deleted from the sidebar');

  // stop button
  await p.locator('#loop-input').fill('SLOW');
  await p.getByTestId('send').click();
  await p.getByTestId('stop').waitFor();
  await p.getByTestId('stop').click();
  await p.getByTestId('send').waitFor();
  log(true, 'the Stop button ends a reply and the send button returns');
  log(errors.length === 0, 'no page errors on desktop' + (errors.length ? ': ' + errors[0] : ''));

  // phone
  const pctx = await signedIn(br, device('iPhone 13'), '/api/auth/login', 'super@dev.test');
  const pp = await pctx.newPage(); pp.setDefaultTimeout(20000);
  await pp.goto(`${B}/admin/command`, { waitUntil: 'load' });
  await pp.getByRole('heading', { name: 'How can I help today?' }).waitFor();
  await pp.getByRole('button', { name: 'Open chats' }).click();
  await pp.getByRole('dialog', { name: 'Your chats' }).waitFor();
  log(true, 'on a phone the chat list opens as a drawer');
  await pp.screenshot({ path: '/tmp/dev/cc-phone-drawer.png' });
  await pp.getByRole('button', { name: 'Close chats' }).click();
  await pp.locator('#loop-input').fill('hello');
  await pp.getByTestId('send').click();
  await pp.locator('[data-testid=assistant-message] table').waitFor();
  const over = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  log(over <= 1, 'no sideways scrolling at phone width');
  await pp.screenshot({ path: '/tmp/dev/cc-phone.png' });
  await br.close();

  await prisma.$disconnect();
  const fails = results.filter((x) => !x[0]).length;
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
