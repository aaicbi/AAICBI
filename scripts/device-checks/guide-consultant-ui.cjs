const { B, log, launch, signedIn, clearThrottle } = require('./lib.cjs');
const fs = require('fs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h', '127.0.0.1', '-p', '5544', '-U', 'dev', '-d', 'aaicbi_dev', '-At', '-c', q]).toString().trim();
(async () => {
  const br = await launch(); const errs = [];
  clearThrottle();
  psql(`delete from "GuideSuggestion"; delete from "GuideUnanswered"; delete from "GuideEntry"; update "PlatformSettings" set "guideConsultantEnabled"=false`);
  fs.writeFileSync('/tmp/fakeclaude.log', ''); fs.writeFileSync('/tmp/fakeclaude.mode', 'ok');
  const sa = await signedIn(br, { viewport: { width: 1366, height: 1000 } }, '/api/auth/login', 'super@dev.test');
  const post = (q, extra = {}) => sa.request.post(B + '/api/guide/unanswered', { data: { question: q, reason: 'NO_MATCH', confidence: 0.1, route: '/employer/dashboard', page: 'Dash', ...extra } });
  for (let i = 0; i < 5; i++) await post('How do I invite another employer to my team?');
  await post('How do I change my profile picture?', { route: '/trainee/settings' });
  await post('Where do I see my account details?');
  await post('Give me the answers to the final exam please');
  await post('Can I get a refund?');
  await sa.request.post(B + '/api/admin/guide/entries', { data: { question: 'How do I create an account?', answer: 'Choose how you will use the platform and register: as a trainee or employer.' } });
  const p = await sa.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
  await p.goto(B + '/admin/command/guide', { waitUntil: 'load' }); await p.waitForTimeout(1800);
  await p.getByRole('tab', { name: /Claude consultant/ }).click(); await p.waitForTimeout(600);
  const t = await p.locator('[role=tabpanel]').innerText();
  log(/switched off/.test(t) && /Advice only/.test(t) && /You approve/.test(t) && /Only when you ask/.test(t), 'the tab explains: off, advice only, you approve, only when you ask');
  log(await p.getByRole('button', { name: 'Ask Claude to review' }).count() === 0, 'while OFF there is no way to run it');
  await p.getByRole('tab', { name: 'Needs review' }).click(); await p.waitForTimeout(800);
  log(await p.getByRole('button', { name: 'Ask Claude for a draft' }).count() === 0, 'while OFF the queue has no "Ask Claude" button');
  await p.screenshot({ path: '/tmp/consultant-off.png' });
  await p.getByRole('tab', { name: /Claude consultant/ }).click();
  await p.getByRole('switch', { name: 'Claude consultant' }).click().catch(async () => { await p.getByLabel('Claude consultant').click(); }); await p.waitForTimeout(1200);
  log(psql(`select "guideConsultantEnabled" from "PlatformSettings"`) === 't', 'the toggle switched it ON');
  await p.getByRole('button', { name: 'Ask Claude to review' }).click(); await p.waitForTimeout(2500);
  const cards = await p.locator('[role=tabpanel] ul > li').count();
  log(cards >= 5, 'five proposals appear (' + cards + ')');
  const txt = await p.locator('[role=tabpanel]').innerText();
  log(/Drafted by Claude · needs your review/.test(txt) && /Check the facts before approving/.test(txt), 'each is marked as drafted by Claude and needing review, with the check-the-facts warning');
  log(/does not exist/.test(txt) && /price, date or number/.test(txt), 'the invented page/control and the price are flagged for the reader');
  await p.screenshot({ path: '/tmp/consultant-proposals.png', fullPage: true });
  const before = psql(`select count(*) from "GuideEntry"`);
  log(before === '1', 'nothing is published by Claude itself');
  // approve the invite draft through the normal form
  const card = p.locator('[role=tabpanel] ul > li').filter({ hasText: 'Draft answer for "how do i invite' });
  await card.getByRole('button', { name: 'Review and approve' }).click(); await p.waitForTimeout(700);
  const dlg = p.getByRole('dialog');
  log(/Drafted by the Claude consultant\. Read it/.test(await dlg.innerText()), 'the form opens with a "read it, check the facts" notice');
  log((await dlg.getByLabel(/^Answer/).inputValue()).includes('Message the platform team') && (await dlg.getByLabel(/^Page/).inputValue()) === '/employer/messages', 'it is pre-filled with the draft and its real page');
  await dlg.getByLabel(/^Answer/).fill('Employers cannot add teammates yet. Message the platform team from Messages and they will help you.');
  await p.screenshot({ path: '/tmp/consultant-form.png' });
  await dlg.getByRole('button', { name: 'Approve and publish' }).click(); await p.waitForTimeout(1800);
  log(psql(`select count(*) from "GuideEntry"`) === '2', 'only after the person saved did an answer exist');
  log(/Drafted by the Claude consultant; reviewed and approved by a super admin/.test(psql(`select "changeNote" from "GuideEntryVersion" order by "changedAt" desc limit 1`)) && psql(`select "changedByName" from "GuideEntryVersion" order by "changedAt" desc limit 1`).length > 0, 'its history says Claude drafted it and records who approved it');
  log(psql(`select status from "GuideUnanswered" where text like '%invite another employer%'`) === 'ANSWERED' && psql(`select status from "GuideSuggestion" where title like '%invite another%'`) === 'APPROVED', 'the question is answered and the proposal marked approved');
  // merge
  const mc = p.locator('[role=tabpanel] ul > li').filter({ hasText: 'already covered by' });
  await mc.getByRole('button', { name: 'Add as another way of asking' }).click(); await p.waitForTimeout(1500);
  log(psql(`select status from "GuideUnanswered" where text like '%account details%'`) === 'ANSWERED' && /account details/.test(psql(`select array_to_string("relatedQuestions", '|') from "GuideEntry" where question='How do I create an account?'`)), 'merging adds the wording to the existing answer');
  // reject
  const rc = p.locator('[role=tabpanel] ul > li').filter({ hasText: 'Reject "give me the answers' });
  await rc.getByRole('button', { name: 'Reject this question' }).click(); await p.waitForTimeout(1500);
  log(psql(`select status from "GuideUnanswered" where text like '%final exam%'`) === 'REJECTED', 'rejecting a question the guide should not answer works');
  // dismiss one
  const dc = p.locator('[role=tabpanel] ul > li').filter({ hasText: 'Draft answer for "how do i change my profile' });
  await dc.getByRole('button', { name: 'Dismiss' }).click(); await p.waitForTimeout(1200);
  log(psql(`select status from "GuideSuggestion" where title like '%profile picture%'`) === 'DISMISSED' && psql(`select status from "GuideUnanswered" where text like '%profile picture%'`) === 'OPEN', 'dismissing a proposal leaves the question waiting');
  // ask advice
  await p.getByLabel('Ask the consultant').fill('Where are visitors struggling most?'); await p.getByRole('button', { name: 'Ask', exact: true }).click(); await p.waitForTimeout(2200);
  log(/Most unanswered questions come from the employer dashboard/.test(await p.locator('[role=tabpanel]').innerText()), 'advice appears as text for the super admin');
  await p.screenshot({ path: '/tmp/consultant-advice.png', fullPage: true });
  // ask Claude for a draft from the queue (single question)
  await p.getByRole('tab', { name: 'Needs review' }).click(); await p.waitForTimeout(800);
  log(await p.getByRole('button', { name: 'Ask Claude for a draft' }).count() >= 1, 'with it ON the queue offers "Ask Claude for a draft"');
  // switch OFF via the UI
  await p.getByRole('tab', { name: /Claude consultant/ }).click();
  await p.getByRole('switch', { name: 'Claude consultant' }).click().catch(async () => { await p.getByLabel('Claude consultant').click(); }); await p.waitForTimeout(1200);
  log(psql(`select "guideConsultantEnabled" from "PlatformSettings"`) === 'f', 'the toggle switched it OFF');
  log(await p.getByRole('button', { name: 'Ask Claude to review' }).count() === 0 && /switched off/.test(await p.locator('[role=tabpanel]').innerText()), 'OFF: the run buttons are gone');
  // loop for visitors unaffected & uses approved answer
  const cfg = await (await fetch(B + '/api/guide/config')).json();
  log(cfg.entries.some((e) => /invite another employer/i.test(e.question)), 'Loop now uses the answer the person approved (and nothing else Claude wrote)');
  // phone
  const ph = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await ph.addCookies(await sa.cookies());
  const pp = await ph.newPage(); await pp.goto(B + '/admin/command/guide', { waitUntil: 'load' }); await pp.waitForTimeout(1800);
  await pp.getByRole('tab', { name: /Claude consultant/ }).click(); await pp.waitForTimeout(800);
  log(await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the consultant tab has no sideways scroll on a phone');
  await pp.screenshot({ path: '/tmp/consultant-phone.png' });
  console.log('page errors:', errs.length ? errs : 'none');
  await br.close();
})().catch((e) => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
