const { B, log, launch, device, signedIn, cookiesFor } = require('./lib.cjs');
const psql = (q) => require('child_process').execFileSync('/usr/lib/postgresql/16/bin/psql', ['-h','127.0.0.1','-p','5544','-U','dev','-d','aaicbi_dev','-At','-c',q]).toString().trim();
(async () => {
  const fd = () => { const f = new FormData(); f.append('file', new Blob(['hello'], { type: 'text/plain' }), 'a.txt'); return f; };
  let r = await fetch(B + '/api/org/profile/cover', { method: 'POST', body: fd() });
  log(r.status === 401 || r.status === 403, `a visitor cannot upload a cover (${r.status})`);
  const ck = (await cookiesFor('/api/auth/training-org-login', 'org@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await fetch(B + '/api/org/profile/cover', { method: 'POST', headers: { Cookie: ck }, body: fd() });
  log(r.status === 400, `a file that is not a picture is refused (${r.status})`);
  const t = (await cookiesFor('/api/auth/trainee-login', 't0@dev.test')).map((c) => `${c.name}=${c.value}`).join('; ');
  r = await fetch(B + '/api/org/profile/cover', { method: 'POST', headers: { Cookie: t }, body: fd() });
  log(r.status === 401 || r.status === 403, `a member cannot upload an organization cover (${r.status})`);
  const br = await launch();
  const ctx = await signedIn(br, device('Desktop Chrome'), '/api/auth/training-org-login', 'org@dev.test');
  const p = await ctx.newPage(); p.setDefaultTimeout(20000);
  // The real upload needs cloud storage, which a local run does not have; the picture's address is stood in.
  const fake = 'https://example.com/cover-test.png';
  await p.route('**/api/org/profile/cover', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: fake }) }));
  await p.goto(B + '/admin/organization/profile', { waitUntil: 'load' }).catch(() => {});
  await p.getByText('Cover picture').waitFor().catch(() => {});
  let found = await p.getByText('Cover picture').count();
  if (!found) { const links = await p.locator('a[href*="profile"]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))); console.log('links', links.slice(0, 10)); }
  log(found > 0, 'the profile page shows "Cover picture", with an upload button');
  log((await p.getByLabel('Cover image URL').count()) === 0, 'there is no web-address box any more');
  await p.setInputFiles('#org-cover-file', { name: 'c.png', mimeType: 'image/png', buffer: Buffer.from(await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; c.getContext('2d').fillRect(0, 0, 800, 400); const b = await new Promise((r) => c.toBlob(r, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); })) });
  await p.getByRole('button', { name: 'Use this picture' }).click();
  await p.getByAltText('Your cover picture').waitFor();
  log(true, 'after choosing a picture it appears as a preview');
  await p.getByRole('button', { name: 'Save' }).click();
  await p.waitForTimeout(1500);
  log(psql(`select count(*) from "OrganizationPublicProfile" where "coverUrl"='${fake}'`) === '1', 'pressing Save keeps the picture on the organization page');
  await br.close();
  psql(`update "OrganizationPublicProfile" set "coverUrl"=null where "coverUrl"='${fake}'`);
})().catch((e) => { console.error(e); process.exit(1); });
