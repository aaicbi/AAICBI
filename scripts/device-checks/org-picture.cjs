const { B, log, launch, device, signedIn, cookiesFor, clearThrottle } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
const MIGRATION = require('fs').readFileSync(require('path').join(__dirname, '../../prisma/migrations/20261103090000_org_picture_from_profile_picture/migration.sql'), 'utf8').replace(/^--.*$/gm, '');
(async () => {
  clearThrottle();
  const pic = 'https://example.com/org-picture.png';
  const orgId = psql(`select id from "TrainingOrganization" where email='org@dev.test'`);
  const staff = psql(`select "staffUserId" from "TrainingOrganization" where id='${orgId}'`);
  // publish the organization page
  psql(`insert into "OrganizationPublicProfile"(id,"trainingOrganizationId",slug,"publicEnabled","updatedAt") values ('opp_pic','${orgId}','northwind-pic',true,now()) on conflict ("trainingOrganizationId") do update set "publicEnabled"=true`);
  const slug = psql(`select slug from "OrganizationPublicProfile" where "trainingOrganizationId"='${orgId}'`);
  // an organization that uploaded its profile picture, but has no organization picture
  psql(`update "User" set "avatarUrl"='${pic}' where id='${staff}'`); psql(`update "TrainingOrganization" set "logoUrl"=null where id='${orgId}'`);
  const page = async (path) => { const r = await fetch(B + path); return (await r.text()).replace(/<!-- -->/g, ''); };
  let h = await page(`/organizations/${slug}`);
  log(!h.includes(`src="${pic}"`), 'before the fix: the public page shows a letter, not the picture');
  // the migration copies the profile picture across
  psql(MIGRATION);
  log(psql(`select "logoUrl" from "TrainingOrganization" where id='${orgId}'`) === pic, 'the migration copies the uploaded profile picture to the organization');
  h = await page(`/organizations/${slug}`);
  log(h.includes(`src="${pic}"`), 'the organization page now shows the picture');
  const handle = psql(`select handle from "Profile" where "trainingOrganizationId"='${orgId}'`);
  if (handle) { h = await page(`/@${handle}`); log(h.includes(`src="${pic}"`), 'the profile page (@handle) shows the picture too'); }
  h = await page('/organizations'); log(h.includes(`src="${pic}"`), 'the organizations list shows it');
  // an organization that already has one is left alone
  psql(`update "TrainingOrganization" set "logoUrl"='https://example.com/own.png' where id='${orgId}'`); psql(MIGRATION);
  log(psql(`select "logoUrl" from "TrainingOrganization" where id='${orgId}'`) === 'https://example.com/own.png', 'an organization that already has a picture keeps it');
  psql(`update "TrainingOrganization" set "logoUrl"='${pic}' where id='${orgId}'`);

  // the upload endpoint
  const fd = () => { const f = new FormData(); f.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt'); return f; };
  let r = await fetch(B + '/api/org/profile/logo', { method: 'POST', body: fd() }); log(r.status === 401 || r.status === 403, `a visitor cannot set the picture (${r.status})`);
  const ck = (await cookiesFor('/api/auth/training-org-login', 'org@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await fetch(B + '/api/org/profile/logo', { method: 'POST', headers: { Cookie: ck }, body: fd() }); log(r.status === 400, `a file that is not a picture is refused (${r.status})`);
  const t = (await cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await fetch(B + '/api/org/profile/logo', { method: 'POST', headers: { Cookie: t }, body: fd() }); log(r.status === 401 || r.status === 403, `a member cannot set an organization's picture (${r.status})`);

  // removing it brings the letter back, and the account picture goes with it
  r = await fetch(B + '/api/org/profile/logo', { method: 'DELETE', headers: { Cookie: ck } }); log(r.status === 200, 'the organization can remove its picture');
  log(psql(`select "logoUrl" is null from "TrainingOrganization" where id='${orgId}'`) === 't' && psql(`select "avatarUrl" is null from "User" where id='${staff}'`) === 't', 'removing it clears both the public picture and the account picture');

  // the form
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  await p.route('**/api/org/profile/logo', (route) => route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logoUrl: pic }) }) : route.continue());
  await p.route(pic, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await p.goto(B + '/admin/organization/profile', { waitUntil: 'load' });
  await p.getByText('Organization picture').first().waitFor();
  log(true, 'the page has an "Organization picture" section');
  const png = Buffer.from(await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; c.getContext('2d').fillRect(0, 0, 600, 400); const b = await new Promise((r2) => c.toBlob(r2, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); }));
  await p.locator('input[type=file]').first().setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  const frame = p.getByTestId('image-frame'); await frame.waitFor();
  const fb = await frame.boundingBox();
  log(Math.abs(fb.width - fb.height) < 3, 'the editor opens with a square frame to place the logo');
  await p.getByRole('button', { name: 'Use this picture' }).click();
  await p.locator(`img[src="${pic}"]`).first().waitFor();
  log(true, 'after uploading, the picture appears in the form and in the preview of the public page');
  psql(`update "User" set "avatarUrl"=null where id='${staff}'`); psql(`update "TrainingOrganization" set "logoUrl"=null where id='${orgId}'`);
  psql(`delete from "OrganizationPublicProfile" where id='opp_pic'`);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
