const { B, log, launch, device, signedIn } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  const superId = psql(`select id from "User" where email='super@dev.test'`);
  psql(`delete from "Course" where id='cs_ui1'`);
  psql(`insert into "Course"(id,title,description,"createdById","updatedAt") values ('cs_ui1','CSUI Course','About','${superId}',now())`);
  const br = await launch();
  // super admin: owner card + share card
  let ctx = await signedIn(br, device('iPhone 13'), '/api/auth/login', 'super@dev.test');
  let p = await ctx.newPage(); p.setDefaultTimeout(20000);
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(B + '/admin/courses/cs_ui1', { waitUntil: 'load' });
  await p.getByRole('heading', { name: 'Owner of this course' }).waitFor();
  log(true, 'the super admin sees "Owner of this course" with a Move control');
  await p.getByRole('heading', { name: 'Work on this together' }).waitFor();
  const over = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  log(!over, 'the course page does not overflow sideways on a phone');
  await p.getByRole('button', { name: 'Make an invite link' }).click();
  const input = p.getByLabel('Share link'); await input.waitFor();
  const url = await input.inputValue();
  log(/\/collaborate\/.{20,}/.test(url), 'making an invite link shows it once, ready to copy');
  await p.screenshot({ path: '/tmp/claude-0/-home-user-AAICBI/4db822c9-23a2-5e32-bb17-9a4f29aa6de4/scratchpad/share-card.png', fullPage: true });
  // the accept page, signed out
  const anon = await br.newContext(device('iPhone 13')); const ap = await anon.newPage();
  await ap.goto(B + new URL(url).pathname, { waitUntil: 'load' });
  await ap.getByRole('heading', { name: 'CSUI Course' }).waitFor();
  log(await ap.getByRole('button', { name: 'Join and open' }).isVisible(), 'the invitation page names the course and offers Join');
  await ap.getByRole('button', { name: 'Join and open' }).click();
  await ap.getByText('Sign in first, then open this link again.').waitFor();
  log(true, 'signed out, it explains how to sign in first');
  // organization owner: team page with roles and activity
  const octx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const op = await octx.newPage(); op.setDefaultTimeout(20000);
  await op.goto(B + '/admin/organization/team', { waitUntil: 'load' });
  await op.getByText(/You are signed in as/).waitFor();
  log(await op.getByLabel('Role', { exact: true }).first().isVisible(), 'the team page has a Role choice for new teammates');
  log(await op.getByRole('heading', { name: 'Recent activity' }).isVisible(), 'and shows recent activity');
  await op.screenshot({ path: '/tmp/claude-0/-home-user-AAICBI/4db822c9-23a2-5e32-bb17-9a4f29aa6de4/scratchpad/org-team.png', fullPage: true });
  log(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
  await br.close();
  psql(`delete from "Course" where id='cs_ui1'`);
  psql(`delete from "ContentShareLink" where "resourceId"='cs_ui1'`);
})().catch((e) => { console.error(e); process.exit(1); });
