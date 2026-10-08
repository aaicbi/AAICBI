const { B, log, launch, device, signedIn } = require('./lib.cjs');
const { execFileSync } = require('child_process');
const sql = (q) => execFileSync('psql', [...(process.env.PSQL_ARGS || '-h 127.0.0.1 -p 5544 -U dev -d aaicbi_dev').split(' '), '-At', '-c', q]).toString().trim();
(async () => {
  sql(`delete from "EducationPost" where "submittedByTrainee" = true`); sql(`delete from "OrganizationReport"`);
  const br = await launch();
  const errors = [];
  // ---------- trainee: Explore + post two videos
  let ctx = await signedIn(br, device('Pixel 7'), '/api/auth/trainee-login', 't0@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', e => errors.push(e.message));
  await p.goto(B + '/trainee/explore', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  const tiles = await p.locator('main a').allInnerTexts();
  console.log('   explore:', JSON.stringify(tiles.map(t => t.split('\n')[0])));
  for (const t of ['Jobs and opportunities', 'Training organizations', 'Trainee videos', 'Events']) log(tiles.some(x => x.startsWith(t)), 'Explore offers: ' + t);
  log(tiles.some(x => x.startsWith('Share a video')) && tiles.some(x => x.startsWith('Report a concern')), 'Explore offers Share a video and Report a concern');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/explore-phone.png' });
  await p.goto(B + '/trainee/videos', { waitUntil: 'load' }); await p.waitForTimeout(1000);
  const submit = async (title, url) => {
    await p.getByLabel('Training organization').selectOption({ label: 'Northwind Academy' });
    await p.getByLabel('Video title').fill(title);
    await p.getByLabel('YouTube link').fill(url);
    await p.getByRole('button', { name: 'Send for review' }).click();
    await p.waitForTimeout(1200);
  };
  await submit('My data cleaning demo', 'https://youtu.be/dQw4w9WgXcQ');
  log(await p.getByText('Waiting for your organization').first().isVisible(), 'trainee posts a video: status "Waiting for your organization"');
  await submit('My second project', 'https://youtu.be/9bZkp7q19f0');
  const orgNotice = sql(`select count(*) from "UserNotification" where type='EDUCATION_TRAINEE_SUBMISSION' and "recipientType"='TRAINING_ORG'`);
  log(Number(orgNotice) >= 2, 'organization is notified in its own bell (' + orgNotice + ')');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/trainee-videos-phone.png', fullPage: true });
  // duplicate refused
  await p.getByLabel('Training organization').selectOption({ label: 'Northwind Academy' });
  await p.getByLabel('Video title').fill('Duplicate'); await p.getByLabel('YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await p.getByRole('button', { name: 'Send for review' }).click(); await p.waitForTimeout(800);
  log(await p.getByText(/already posted this video/).isVisible(), 'posting the same video twice is refused');

  // ---------- organization decides (desktop browser, like a laptop user)
  const octx = await signedIn(br, { viewport: { width: 1280, height: 900 } }, '/api/auth/training-org-login', 'org@dev.test');
  const op = await octx.newPage(); op.setDefaultTimeout(20000);
  await op.goto(B + '/admin/education', { waitUntil: 'load' }); await op.waitForTimeout(1500);
  log(await op.getByRole('heading', { name: 'Videos trainees sent you' }).isVisible(), 'organization sees "Videos trainees sent you"');
  const rows = op.locator('section[aria-labelledby="trainee-sent"] > div > div');
  const first = op.locator('text=My data cleaning demo').first();
  const card = first.locator('xpath=ancestor::div[.//button[normalize-space()="Approve"]][1]');
  await card.getByRole('button', { name: 'Approve' }).click(); await op.waitForTimeout(1200);
  log(sql(`select status from "EducationPost" where title='My data cleaning demo'`) === 'PENDING_REVIEW', 'org approves: unverified org -> goes to AAICBI for the final check (PENDING_REVIEW)');
  const second = op.locator('text=My second project').first().locator('xpath=ancestor::div[.//button[normalize-space()="Decline"]][1]');
  await second.getByRole('button', { name: 'Decline' }).isDisabled().then(d => log(d, 'Decline is disabled until a reason is written'));
  await second.getByLabel(/Note to the trainee/).fill('Please add captions and re-record the audio.');
  await second.getByRole('button', { name: 'Decline' }).click(); await op.waitForTimeout(1200);
  log(sql(`select status from "EducationPost" where title='My second project'`) === 'ORG_DECLINED', 'org declines with a reason -> ORG_DECLINED');
  const tn = sql(`select title from "UserNotification" where type='EDUCATION_ORG_DECISION' and "recipientType"='TRAINEE' order by "createdAt" desc limit 1`);
  log(/did not approve/.test(tn), 'trainee is told about the decline: ' + tn);

  // ---------- trainee escalates the declined video
  await p.goto(B + '/trainee/videos', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  log(await p.getByText(/Please add captions/).isVisible(), 'trainee sees the organization\'s reason');
  const dcard = p.locator('text=My second project').first().locator('xpath=ancestor::div[.//button[contains(.,"Send to AAICBI for review")]][1]');
  await dcard.getByRole('button', { name: 'Send to AAICBI for review' }).click();
  await p.getByLabel('What is the problem?').fill('I think the decision was unfair; the audio is fine.');
  await p.getByRole('button', { name: 'Send to AAICBI', exact: true }).click(); await p.waitForTimeout(1200);
  const e = sql(`select status || ' | ' || coalesce("escalationNote",'') from "EducationPost" where title='My second project'`);
  log(/^PENDING_REVIEW \| I think/.test(e), 'escalated: ' + e);

  // ---------- trainee reports an organization
  await p.goto(B + '/trainee/report', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.getByLabel('Organization').selectOption({ label: 'Northwind Academy' });
  await p.getByLabel('What happened?').selectOption({ value: 'UNFAIR_TREATMENT' });
  await p.getByLabel('Tell us what happened').fill('My assessment was marked down without explanation and my questions were ignored.');
  await p.getByRole('button', { name: 'Send report' }).click(); await p.waitForTimeout(1200);
  log(await p.getByText('Your reports').isVisible(), 'report is sent and listed for the trainee');
  await p.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/report-phone.png', fullPage: true });
  // the organization must never see it
  const orgApis = ['/api/org/education-posts', '/api/org/insights', '/api/org/profile'];
  let leaked = false; for (const a of orgApis) { const t = await (await octx.request.get(B + a)).text(); if (/UNFAIR_TREATMENT|My assessment was marked down|OrganizationReport/.test(t)) leaked = true; }
  log(!leaked, 'organization endpoints never reveal the report');

  // ---------- super admin: queue and reports
  const sctx = await signedIn(br, { viewport: { width: 1280, height: 900 } }, '/api/auth/login', 'super@dev.test');
  const sp = await sctx.newPage(); sp.setDefaultTimeout(20000);
  await sp.goto(B + '/admin/ecosystem', { waitUntil: 'load' }); await sp.waitForTimeout(2000);
  log(await sp.getByText(/Sent to AAICBI by the trainee: I think the decision was unfair/).isVisible(), 'super admin queue marks the escalated video with the trainee\'s reason');
  log(await sp.getByText(/Organization said: Please add captions/).isVisible(), 'super admin also sees what the organization said');
  log(await sp.getByRole('heading', { name: /Reports about organizations \(1\)/ }).isVisible(), 'super admin sees the report');
  log(await sp.getByText(/Reported by Amara Nwosu/).isVisible(), 'super admin sees who reported');
  await sp.screenshot({ path: (process.env.OUT_DIR || '/tmp') + '/superadmin-ecosystem.png', fullPage: false });
  await sp.getByRole('button', { name: 'Mark resolved' }).click(); await sp.waitForTimeout(1200);
  log(sql(`select status from "OrganizationReport" limit 1`) === 'RESOLVED', 'super admin resolves the report');
  const rn = sql(`select title from "UserNotification" where type='ORG_REPORT_UPDATE' order by "createdAt" desc limit 1`);
  log(rn === 'Update on your report', 'trainee is notified: ' + rn);
  // approve the escalated video
  const vcard = sp.locator('text=My second project').first().locator('xpath=ancestor::div[.//button[normalize-space()="Approve"]][1]');
  await vcard.getByRole('button', { name: 'Approve' }).click(); await sp.waitForTimeout(1200);
  log(sql(`select status from "EducationPost" where title='My second project'`) === 'PUBLISHED', 'super admin approves the escalated video -> PUBLISHED');
  console.log('page errors:', errors.length ? errors : 'none');
  await br.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 700)); process.exit(1); });
